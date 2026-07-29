import { FastifyInstance } from "fastify";
import { bmoniClient } from "../services/bmoni/provider.js";

export async function walletRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const wallets = await bmoniClient.listWallets();
    return wallets;
  });
}
