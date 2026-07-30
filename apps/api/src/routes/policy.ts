import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireUserId } from "./auth.js";

/** The client-facing view of a user's spending policy. */
export function policyView(u: {
  perPaymentCapMinor: number | null;
  dailyCapMinor: number | null;
  allowlistOnly: boolean;
  agentFrozen: boolean;
}) {
  return {
    perPaymentCapMinor: u.perPaymentCapMinor,
    dailyCapMinor: u.dailyCapMinor,
    allowlistOnly: u.allowlistOnly,
    agentFrozen: u.agentFrozen,
  };
}

export interface GuardResult {
  ok: boolean;
  code?: "frozen" | "over_payment_cap" | "over_daily_cap";
  message?: string;
  /** Whether an extra confirmation step (PIN + safe-word) is warranted. */
  stepUp?: boolean;
  limitMinor?: number;
}

/**
 * Enforce the signed-in user's spending guardrails for a payment of `amountMinor`
 * (USD minor). Demo (unauthenticated) requests are always allowed so the public
 * demo keeps working. Frozen agent → hard block; over a cap → block.
 */
export async function enforceGuardrails(
  req: FastifyRequest,
  amountMinor: number,
): Promise<GuardResult> {
  const uid = requireUserId(req);
  if (!uid) return { ok: true };
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) return { ok: true };

  if (user.agentFrozen) {
    return {
      ok: false,
      code: "frozen",
      message: "Your agent is frozen. Unfreeze it in Settings to move money.",
    };
  }

  if (user.perPaymentCapMinor != null && amountMinor > user.perPaymentCapMinor) {
    return {
      ok: false,
      code: "over_payment_cap",
      limitMinor: user.perPaymentCapMinor,
      message: `That's over your per-payment limit of ${(user.perPaymentCapMinor / 100).toLocaleString()}.`,
    };
  }

  if (user.dailyCapMinor != null) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const today = await prisma.receipt.aggregate({
      where: { userId: uid, createdAt: { gte: since } },
      _sum: { amountMinor: true },
    });
    const spent = today._sum.amountMinor ?? 0;
    if (spent + amountMinor > user.dailyCapMinor) {
      return {
        ok: false,
        code: "over_daily_cap",
        limitMinor: user.dailyCapMinor,
        message: `That would pass your daily limit of ${(user.dailyCapMinor / 100).toLocaleString()}.`,
      };
    }
  }

  return { ok: true };
}

const policySchema = z.object({
  perPaymentCapMinor: z.number().int().min(0).nullable().optional(),
  dailyCapMinor: z.number().int().min(0).nullable().optional(),
  allowlistOnly: z.boolean().optional(),
  agentFrozen: z.boolean().optional(),
});

export async function policyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/policy", async (req, reply) => {
    const uid = requireUserId(req);
    if (!uid) return reply.status(401).send({ error: "Not signed in" });
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return reply.status(401).send({ error: "Not signed in" });
    return { policy: policyView(user) };
  });

  app.put("/policy", async (req, reply) => {
    const uid = requireUserId(req);
    if (!uid) return reply.status(401).send({ error: "Not signed in" });
    const p = policySchema.safeParse(req.body ?? {});
    if (!p.success) return reply.status(400).send({ error: "Invalid policy" });
    const user = await prisma.user.update({ where: { id: uid }, data: p.data });
    return { policy: policyView(user) };
  });

  // Kill-switch — freeze or unfreeze all agent money movement.
  app.post("/policy/freeze", async (req, reply) => {
    const uid = requireUserId(req);
    if (!uid) return reply.status(401).send({ error: "Not signed in" });
    const body = (req.body ?? {}) as { frozen?: boolean };
    const user = await prisma.user.update({
      where: { id: uid },
      data: { agentFrozen: body.frozen ?? true },
    });
    return { policy: policyView(user) };
  });
}
