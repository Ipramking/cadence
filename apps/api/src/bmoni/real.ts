import { SandboxBmoniClient } from "./sandbox.js";

let client: SandboxBmoniClient | null = null;

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
