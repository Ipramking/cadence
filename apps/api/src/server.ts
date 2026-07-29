import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { initBmoniClient } from "./services/bmoni/provider.js";
import { overviewRoutes } from "./routes/overview.js";
import { pipelineRoutes } from "./routes/pipeline.js";

import { walletRoutes } from "./routes/wallets.js";
import { transactionRoutes } from "./routes/transactions.js";
import { ruleRoutes } from "./routes/rules.js";
import { goalRoutes } from "./routes/goals.js";
import { inflowRoutes } from "./routes/inflows.js";

initBmoniClient();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok" }));
await app.register(overviewRoutes);
await app.register(pipelineRoutes);

// Register feature routes
await app.register(walletRoutes, { prefix: "/wallets" });
await app.register(transactionRoutes, { prefix: "/transactions" });
await app.register(ruleRoutes, { prefix: "/rules" });
await app.register(goalRoutes, { prefix: "/goals" });
await app.register(inflowRoutes, { prefix: "/inflows" });

const port = Number(process.env.PORT ?? 4000);

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`api listening on :${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
