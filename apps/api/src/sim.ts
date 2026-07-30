import type { FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import { prisma } from "./db.js";
import { userIdFromAuthHeader } from "./auth/service.js";

/** Fallback FX rate used in simulated mode (₦ per $). */
export const SIM_RATE = 1550;

/**
 * A signed-in user is in "simulated mode" when they have no real BMONI account
 * (provisioning was unavailable at onboarding). Their money then lives in local
 * simulated balances so the whole experience — wallets, convert, pay — still
 * works end-to-end. Returns the user when simulated, else null.
 */
export async function simUser(req: FastifyRequest): Promise<User | null> {
  const uid = userIdFromAuthHeader(req.headers.authorization);
  if (!uid) return null;
  const user = await prisma.user.findUnique({ where: { id: uid } });
  return user && !user.bmoniUserId ? user : null;
}

const addr = (tag: string) => `0xSIM${tag}${"0".repeat(30)}`;

/** Wallet list shaped exactly like the real provider's, from simulated balances. */
export function simWallets(user: Pick<User, "simUsdMinor" | "simNgnMinor">) {
  const now = new Date().toISOString();
  return [
    { id: "sim-usd", name: "Dollar wallet", purpose: "main" as const, currency: "USD", balance: { minor: user.simUsdMinor, currency: "USD" }, createdAt: now, address: addr("USDB") },
    { id: "sim-ngn", name: "Naira wallet", purpose: "main" as const, currency: "NGN", balance: { minor: user.simNgnMinor, currency: "NGN" }, createdAt: now, address: addr("CNGN") },
  ];
}

/** Simulate converting `usd` dollars → naira, persisting the new balances. */
export async function simConvert(user: User, usd: number) {
  const usdMinor = Math.round(usd * 100);
  const ngnMinor = Math.round(usdMinor * SIM_RATE);
  const before = simWallets(user);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      simUsdMinor: Math.max(0, user.simUsdMinor - usdMinor),
      simNgnMinor: user.simNgnMinor + ngnMinor,
    },
  });
  return {
    tx: { amount: { minor: ngnMinor, currency: "NGN" }, metadata: { rate: SIM_RATE } },
    before,
    after: simWallets(updated),
  };
}

/** Simulate an outbound send of `usd` dollars, persisting the deduction. */
export async function simSend(user: User, usd: number) {
  const usdMinor = Math.round(usd * 100);
  const before = simWallets(user);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { simUsdMinor: Math.max(0, user.simUsdMinor - usdMinor) },
  });
  return { result: { ok: true, step: "simulated" }, before, after: simWallets(updated) };
}

/**
 * Deduct a payment's USD-equivalent from a simulated user's dollar balance, so
 * the wallet reflects spending. No-op for real-BMONI or demo users.
 */
export async function simDeduct(req: FastifyRequest, usdMinor: number): Promise<void> {
  const user = await simUser(req);
  if (!user) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { simUsdMinor: Math.max(0, user.simUsdMinor - usdMinor) },
  });
}
