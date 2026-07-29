import fs from "node:fs";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { SandboxBmoniClient } from "./sandbox.js";

let client: SandboxBmoniClient | null = null;

export interface OwnerContext {
  userId: string;
  account: PrivateKeyAccount;
  wallets: { currency: string; id: string; address: string }[];
}

/**
 * Loads the provisioned sandbox owner (key + wallets) from the gitignored
 * .bmoni-user.json. Needed to sign real send/transfer proposals. Returns null
 * if no user has been provisioned.
 */
export function ownerContext(): OwnerContext | null {
  // Env-first (hosting): owner key + user id come from environment.
  const envKey = process.env.BMONI_OWNER_KEY;
  const envUser = process.env.BMONI_USER_ID;
  if (envKey && envUser) {
    return {
      userId: envUser,
      account: privateKeyToAccount(envKey as `0x${string}`),
      wallets: [],
    };
  }
  // File fallback (local dev): read the provisioned user.
  try {
    const path = new URL("../../.bmoni-user.json", import.meta.url);
    const data = JSON.parse(fs.readFileSync(path, "utf8"));
    return {
      userId: data.bmoniUserId,
      account: privateKeyToAccount(data.ownerPrivateKey),
      wallets: data.wallets,
    };
  } catch {
    return null;
  }
}

/**
 * The real BMONI sandbox client, used for genuine FX rate + conversion calls
 * regardless of the configured product provider. This keeps money-movement on
 * live BMONI rails while the rest of the product can run on rich mock data.
 * Returns null when no sandbox user is configured (callers fall back).
 */
export function sandbox(): SandboxBmoniClient | null {
  if (client) return client;
  const uid = process.env.BMONI_USER_ID;
  if (!uid || !process.env.BMONI_API_KEY) return null;
  client = new SandboxBmoniClient(uid);
  return client;
}
