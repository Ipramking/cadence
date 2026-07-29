import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok" }));

// Feature routes are registered here as they land:
//   app.register(walletRoutes, { prefix: "/wallets" });
//   app.register(inflowRoutes, { prefix: "/inflows" });
//   app.register(ruleRoutes,   { prefix: "/rules" });

const port = Number(process.env.PORT ?? 4000);

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`api listening on :${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
