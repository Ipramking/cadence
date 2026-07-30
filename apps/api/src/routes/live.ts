import type { FastifyInstance } from "fastify";
import { bmoniFetch } from "../bmoni/http.js";
import { liveSend } from "../bmoni/send.js";
import { resolveBmoni } from "../userBmoni.js";
import { simUser, simWallets, simConvert, simSend } from "../sim.js";

/**
 * Live window onto the caller's money. The REAL BMONI account is the primary
 * path — balances/convert/send hit BMONI. Simulation is only a silent safety
 * net: if BMONI is momentarily unreachable, a signed-in user still sees seeded
 * balances so a demo never hard-breaks.
 */
export async function liveRoutes(app: FastifyInstance): Promise<void> {
  app.get("/live/balances", async (req) => {
    const ctx = await resolveBmoni(req);
    if (ctx) {
      try {
        const wallets = (await ctx.client.listWallets()) as (Awaited<
          ReturnType<typeof ctx.client.listWallets>
        >[number] & { address?: string })[];
        // Enrich with the on-chain smart-wallet addresses.
        try {
          const raw = await bmoniFetch<{ id: string; walletAddress: string }[]>(
            `/v1/users/${ctx.bmoniUserId}/smart-wallets/account/wallets`,
          );
          const byId = new Map(raw.map((w) => [w.id, w.walletAddress]));
          wallets.forEach((w) => (w.address = byId.get(w.id)));
        } catch {
          /* addresses are best-effort */
        }
        return { configured: true, wallets };
      } catch (e) {
        req.log.warn({ err: e }, "live/balances: BMONI unavailable — falling back to simulation");
      }
    }
    const sim = await simUser(req);
    if (sim) return { configured: true, simulated: true, wallets: simWallets(sim) };
    return { configured: false, wallets: [] };
  });

  app.post("/live/convert", async (req) => {
    const body = (req.body ?? {}) as { amountUsd?: number };
    const usd = Math.min(10, Math.max(1, Math.round(body.amountUsd ?? 5)));

    const ctx = await resolveBmoni(req);
    if (ctx) {
      try {
        const before = await ctx.client.listWallets();
        const tx = await ctx.client.convert({ amount: { minor: usd * 100, currency: "USD" }, to: "NGN" });
        const after = await ctx.client.listWallets();
        return { configured: true, amountUsd: usd, tx, before, after };
      } catch (e) {
        req.log.warn({ err: e }, "live/convert: BMONI unavailable — falling back to simulation");
      }
    }
    const sim = await simUser(req);
    if (sim) return { configured: true, simulated: true, amountUsd: usd, ...(await simConvert(sim, usd)) };
    return { configured: false };
  });

  // Real send that moves USDB out (delivered as CNGN), signed with the owner key.
  app.post("/live/send", async (req) => {
    const body = (req.body ?? {}) as { amountUsd?: number };
    const usd = Math.min(10, Math.max(1, Math.round(body.amountUsd ?? 1)));

    const ctx = await resolveBmoni(req);
    if (ctx) {
      try {
        const before = await ctx.client.listWallets();
        const result = await liveSend(usd, ctx.owner);
        const after = await ctx.client.listWallets();
        return { configured: true, amountUsd: usd, result, before, after };
      } catch (e) {
        req.log.warn({ err: e }, "live/send: BMONI unavailable — falling back to simulation");
      }
    }
    const sim = await simUser(req);
    if (sim) return { configured: true, simulated: true, amountUsd: usd, ...(await simSend(sim, usd)) };
    return { configured: false };
  });
}
