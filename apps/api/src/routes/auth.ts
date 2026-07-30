import type { FastifyInstance, FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { provisionSandboxUser } from "../bmoni/onboard.js";
import {
  encrypt,
  hashPassword,
  hashSecret,
  signToken,
  userIdFromAuthHeader,
  verifyPassword,
} from "../auth/service.js";

export function requireUserId(req: FastifyRequest): string | null {
  return userIdFromAuthHeader(req.headers.authorization);
}

/** The safe, client-facing view of a user (no secrets). */
export function sanitize(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    autonomy: u.autonomy,
    planEnabled: u.planEnabled,
    onboarded: u.onboarded,
    hasPin: !!u.pinHash,
    hasSafeWord: !!u.safeWordHash,
    bmoniUserId: u.bmoniUserId,
    cngnAddress: u.cngnAddress,
    usdbAddress: u.usdbAddress,
  };
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  phone: z.string().optional(),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string() });
const onboardSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  autonomy: z.enum(["manual", "hybrid", "automatic"]).optional(),
  planEnabled: z.boolean().optional(),
  pin: z.string().optional(),
  safeWord: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/signup", async (req, reply) => {
    const p = signupSchema.safeParse(req.body);
    if (!p.success) return reply.status(400).send({ error: "Enter a valid email and a password of 6+ characters." });
    const email = p.data.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      return reply.status(409).send({ error: "That email is already registered — sign in instead." });
    }
    const user = await prisma.user.create({
      data: { email, passwordHash: hashPassword(p.data.password), name: p.data.name, phone: p.data.phone },
    });
    return { token: signToken(user.id), user: sanitize(user) };
  });

  app.post("/auth/login", async (req, reply) => {
    const p = loginSchema.safeParse(req.body);
    if (!p.success) return reply.status(400).send({ error: "Enter your email and password." });
    const user = await prisma.user.findUnique({ where: { email: p.data.email.toLowerCase() } });
    if (!user || !verifyPassword(p.data.password, user.passwordHash)) {
      return reply.status(401).send({ error: "Wrong email or password." });
    }
    return { token: signToken(user.id), user: sanitize(user) };
  });

  app.get("/receipts", async (req, reply) => {
    const uid = requireUserId(req);
    if (!uid) return reply.status(401).send({ error: "Not signed in" });
    const receipts = await prisma.receipt.findMany({
      where: { userId: uid },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return {
      receipts: receipts.map((r) => ({
        id: r.id,
        reference: r.reference,
        txType: r.txType,
        recipient: r.recipient,
        amountMinor: r.amountMinor,
        currency: r.currency,
        at: r.createdAt.toISOString(),
      })),
    };
  });

  app.get("/auth/me", async (req, reply) => {
    const uid = requireUserId(req);
    const user = uid ? await prisma.user.findUnique({ where: { id: uid } }) : null;
    if (!user) return reply.status(401).send({ error: "Not signed in" });
    return { user: sanitize(user) };
  });

  // Provision the user's real BMONI account + wallets, save prefs, mark onboarded.
  app.post("/auth/onboard", async (req, reply) => {
    const uid = requireUserId(req);
    const user = uid ? await prisma.user.findUnique({ where: { id: uid } }) : null;
    if (!user) return reply.status(401).send({ error: "Not signed in" });

    const parsed = onboardSchema.safeParse(req.body ?? {});
    const prefs = parsed.success ? parsed.data : {};

    // Prefer the name/phone entered during onboarding — BMONI matches test
    // tokens on the phone the account is provisioned with.
    const name = prefs.name?.trim() || user.name || undefined;
    const phone = prefs.phone?.trim() || user.phone || undefined;

    // Provision the user's own BMONI wallets — best effort, time-capped. If it
    // fails or is slow, we still onboard them; money endpoints fall back to the
    // shared funded demo account, so the experience is never blocked.
    let bmoniFields: Record<string, unknown> = {};
    let provisioned = !!user.bmoniUserId;
    if (!user.bmoniUserId) {
      try {
        const timeout = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("provision timeout")), 18000),
        );
        const prov = await Promise.race([
          provisionSandboxUser({ name, email: user.email, phone }),
          timeout,
        ]);
        const cngn = prov.wallets.find((w) => w.currency === "CNGN");
        const usdb = prov.wallets.find((w) => w.currency === "USDB");
        bmoniFields = {
          bmoniUserId: prov.bmoniUserId,
          ownerKeyEnc: encrypt(prov.ownerPrivateKey),
          cngnWalletId: cngn?.id,
          usdbWalletId: usdb?.id,
          cngnAddress: cngn?.address,
          usdbAddress: usdb?.address,
        };
        provisioned = true;
      } catch (e) {
        req.log.error({ err: e }, "BMONI provisioning failed — onboarding on demo account");
      }
    }

    const updated = await prisma.user.update({
      where: { id: uid! },
      data: {
        ...bmoniFields,
        name,
        phone,
        autonomy: prefs.autonomy ?? user.autonomy,
        planEnabled: prefs.planEnabled ?? user.planEnabled,
        pinHash: prefs.pin ? hashSecret(prefs.pin) : user.pinHash,
        safeWordHash: prefs.safeWord ? hashSecret(prefs.safeWord) : user.safeWordHash,
        onboarded: true,
      },
    });
    return { user: sanitize(updated), provisioned };
  });

  // Update preferences only — never provisions (used after onboarding + settings).
  app.put("/auth/prefs", async (req, reply) => {
    const uid = requireUserId(req);
    const user = uid ? await prisma.user.findUnique({ where: { id: uid } }) : null;
    if (!user) return reply.status(401).send({ error: "Not signed in" });
    const parsed = onboardSchema.safeParse(req.body ?? {});
    const p = parsed.success ? parsed.data : {};
    const updated = await prisma.user.update({
      where: { id: uid! },
      data: {
        name: p.name?.trim() || user.name,
        phone: p.phone?.trim() || user.phone,
        autonomy: p.autonomy ?? user.autonomy,
        planEnabled: p.planEnabled ?? user.planEnabled,
        pinHash: p.pin ? hashSecret(p.pin) : user.pinHash,
        safeWordHash: p.safeWord ? hashSecret(p.safeWord) : user.safeWordHash,
        onboarded: true,
      },
    });
    return { user: sanitize(updated) };
  });
}
