import type { FastifyInstance } from "fastify";
import { sandbox } from "../bmoni/real.js";

/**
 * Direct window onto the real BMONI sandbox account — used to demonstrate a
 * genuinely funded transaction. Balances come straight from BMONI; the convert
 * runs a real exchange and reports balances before and after so the movement
 * is visible.
 */
export async function liveRoutes(app: FastifyInstance): Promise<void> {
  app.get("/live/balances", async () => {
    const real = sandbox();
    if (!real) return { configured: false, wallets: [] };
    return { configured: true, wallets: await real.listWallets() };
  });

  app.post("/live/convert", async (req) => {
    const real = sandbox();
    if (!real) return { configured: false };
    const body = (req.body ?? {}) as { amountUsd?: number };
    const usd = Math.min(10, Math.max(1, Math.round(body.amountUsd ?? 5)));

    const before = await real.listWallets();
    const tx = await real.convert({
      amount: { minor: usd * 100, currency: "USD" },
      to: "NGN",
    });
    const after = await real.listWallets();

    return { configured: true, amountUsd: usd, tx, before, after };
  });
}
