import { FastifyInstance } from "fastify";
import { bmoniClient } from "../services/bmoni/provider.js";

export async function transactionRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const query = request.query as Record<string, any> | undefined;
    const limit = query?.limit ? parseInt(query.limit) : undefined;
    const since = query?.since ? String(query.since) : undefined;
    const walletId = query?.walletId ? String(query.walletId) : undefined;

    const transactions = await bmoniClient.listTransactions({ limit, since, walletId });
    return transactions;
  });
}
