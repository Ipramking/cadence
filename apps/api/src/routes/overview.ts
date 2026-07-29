import type { FastifyInstance } from "fastify";
import { bmoniClient } from "../services/bmoni/provider.js";

/**
 * Live dashboard summary: the account's wallets and the current USD/NGN rate,
 * read straight from the active money provider.
 */
export async function overviewRoutes(app: FastifyInstance): Promise<void> {
  app.get("/overview", async () => {
    const [wallets, rate] = await Promise.all([
      bmoniClient.listWallets(),
      bmoniClient.getRate("USD", "NGN"),
    ]);
    return { wallets, rate };
  });
}
