import type { FastifyInstance } from "fastify";
import { bmoniClient } from "../services/bmoni/provider.js";
import { sandbox } from "../bmoni/real.js";

/**
 * Live dashboard summary: the account's wallets (from the product provider)
 * and the current USD/NGN rate (from live BMONI when configured).
 */
export async function overviewRoutes(app: FastifyInstance): Promise<void> {
  app.get("/overview", async () => {
    const real = sandbox();
    const [wallets, rate] = await Promise.all([
      bmoniClient.listWallets(),
      (real ?? bmoniClient).getRate("USD", "NGN"),
    ]);
    return { wallets, rate };
  });
}
