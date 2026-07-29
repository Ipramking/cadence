import type { FastifyInstance } from "fastify";
import { bmoniClient } from "../services/bmoni/provider.js";

/**
 * Powers the dashboard's hero moment: takes an incoming USD amount, performs a
 * real conversion through the provider, and reports what the user receives and
 * saves versus a typical bank (assumed ~4% worse than mid-market).
 */
export async function pipelineRoutes(app: FastifyInstance): Promise<void> {
  app.post("/pipeline/preview", async (req) => {
    const body = (req.body ?? {}) as { amountUsd?: number };
    const usd = Math.min(100_000, Math.max(1, Math.round(body.amountUsd ?? 500)));
    const amount = { minor: usd * 100, currency: "USD" as const };

    const tx = await bmoniClient.convert({ amount, to: "NGN" });
    const rate = typeof tx.metadata?.rate === "number" ? tx.metadata.rate : 0;
    const receivesMinor = tx.amount.minor;
    const bankMinor = Math.round(receivesMinor * 0.96);

    return {
      amountUsd: usd,
      rate,
      currency: "NGN",
      receivesMinor,
      savedVsBankMinor: receivesMinor - bankMinor,
    };
  });
}
