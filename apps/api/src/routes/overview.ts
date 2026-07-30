import type { FastifyInstance } from "fastify";
import { bmoniClient } from "../services/bmoni/provider.js";
import { resolveBmoni } from "../userBmoni.js";

/**
 * Live dashboard summary: wallets (from the product provider) and the current
 * USD/NGN rate (from the caller's live BMONI account).
 */
export async function overviewRoutes(app: FastifyInstance): Promise<void> {
  app.get("/overview", async (req) => {
    const ctx = await resolveBmoni(req);
    const [wallets, rate] = await Promise.all([
      bmoniClient.listWallets(),
      (ctx?.client ?? bmoniClient).getRate("USD", "NGN"),
    ]);
    return { wallets, rate };
  });
}
