import "dotenv/config";
import fs from "node:fs";
import { provisionSandboxUser } from "../bmoni/onboard.js";

/**
 * One-time setup: provision a sandbox user + wallets and save the identifiers
 * to apps/api/.bmoni-user.json (gitignored). Copy the printed BMONI_USER_ID
 * into apps/api/.env, then set BMONI_PROVIDER=sandbox to run on live rails.
 */
const result = await provisionSandboxUser();

const out = new URL("../../.bmoni-user.json", import.meta.url);
fs.writeFileSync(out, JSON.stringify(result, null, 2));

console.log("Provisioned sandbox user.");
console.log(`BMONI_USER_ID=${result.bmoniUserId}`);
console.log("wallets:", result.wallets.map((w) => `${w.currency}=${w.id}`).join("  "));
console.log("saved -> apps/api/.bmoni-user.json");
