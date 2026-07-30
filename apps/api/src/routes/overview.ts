import type { FastifyInstance } from "fastify";
import { bmoniClient } from "../services/bmoni/provider.js";
import { resolveBmoni } from "../userBmoni.js";
import { SIM_RATE } from "../sim.js";

/**
 * Live dashboard summary: wallets (from the product provider) and the current
 * USD/NGN rate. The rate falls back to a fixed simulated rate if BMONI is
 * unreachable, so the dashboard never fails on a rate lookup.
 */
export async function overviewRoutes(app: FastifyInstance): Promise<void> {
  app.get("/overview", async (req) => {
    const ctx = await resolveBmoni(req);
    const [wallets, rate] = await Promise.all([
      bmoniClient.listWallets().catch(() => []),
      (ctx?.client ?? bmoniClient)
        .getRate("USD", "NGN")
        .catch(() => ({ from: "USD", to: "NGN", rate: SIM_RATE, asOf: new Date().toISOString() })),
    ]);
    return { wallets, rate };
  });
}
