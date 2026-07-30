import type { FastifyRequest } from "fastify";
import { privateKeyToAccount } from "viem/accounts";
import { prisma } from "./db.js";
import { SandboxBmoniClient } from "./bmoni/sandbox.js";
import { ownerContext, sandbox, type OwnerContext } from "./bmoni/real.js";
import { decrypt, userIdFromAuthHeader } from "./auth/service.js";

export interface BmoniCtx {
  client: SandboxBmoniClient;
  owner: OwnerContext | null;
  /** App user id, or "demo" for the shared fallback account. */
  userId: string;
  bmoniUserId: string;
}

/**
 * Resolve the BMONI account for a request: the signed-in user's own account
 * when a valid token is present, otherwise the funded demo account so the
 * public demo keeps working during the auth migration.
 */
export async function resolveBmoni(req: FastifyRequest): Promise<BmoniCtx | null> {
  const uid = userIdFromAuthHeader(req.headers.authorization);
  if (uid) {
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (user?.bmoniUserId) {
      let owner: OwnerContext | null = null;
      if (user.ownerKeyEnc) {
        try {
          const account = privateKeyToAccount(decrypt(user.ownerKeyEnc) as `0x${string}`);
          owner = {
            userId: user.bmoniUserId,
            account,
            wallets: [
              ...(user.cngnWalletId ? [{ currency: "CNGN", id: user.cngnWalletId, address: user.cngnAddress ?? "" }] : []),
              ...(user.usdbWalletId ? [{ currency: "USDB", id: user.usdbWalletId, address: user.usdbAddress ?? "" }] : []),
            ],
          };
        } catch {
          owner = null;
        }
      }
      return { client: new SandboxBmoniClient(user.bmoniUserId), owner, userId: uid, bmoniUserId: user.bmoniUserId };
    }
  }
  const s = sandbox();
  if (s) return { client: s, owner: ownerContext(), userId: "demo", bmoniUserId: process.env.BMONI_USER_ID ?? "" };
  return null;
}

/** The app user id if signed in (for scoping receipts), else null. */
export function appUserId(req: FastifyRequest): string | null {
  return userIdFromAuthHeader(req.headers.authorization);
}
