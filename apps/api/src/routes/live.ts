import type { FastifyInstance } from "fastify";
import { bmoniFetch } from "../bmoni/http.js";
import { liveSend } from "../bmoni/send.js";
import { resolveBmoni } from "../userBmoni.js";

/**
 * Live window onto the caller's BMONI account (their own when signed in, else
 * the funded demo account). Balances come straight from BMONI; convert/send run
 * real exchange/transfer and report balances so movement is visible.
 */
export async function liveRoutes(app: FastifyInstance): Promise<void> {
  app.get("/live/balances", async (req) => {
    const ctx = await resolveBmoni(req);
    if (!ctx) return { configured: false, wallets: [] };
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
  });

  app.post("/live/convert", async (req) => {
    const ctx = await resolveBmoni(req);
    if (!ctx) return { configured: false };
    const body = (req.body ?? {}) as { amountUsd?: number };
    const usd = Math.min(10, Math.max(1, Math.round(body.amountUsd ?? 5)));

    const before = await ctx.client.listWallets();
    const tx = await ctx.client.convert({ amount: { minor: usd * 100, currency: "USD" }, to: "NGN" });
    const after = await ctx.client.listWallets();

    return { configured: true, amountUsd: usd, tx, before, after };
  });

  // Real send that moves USDB out (delivered as CNGN), signed with the owner key.
  app.post("/live/send", async (req) => {
    const ctx = await resolveBmoni(req);
    if (!ctx) return { configured: false };
    const body = (req.body ?? {}) as { amountUsd?: number };
    const usd = Math.min(10, Math.max(1, Math.round(body.amountUsd ?? 1)));

    const before = await ctx.client.listWallets();
    const result = await liveSend(usd, ctx.owner);
    const after = await ctx.client.listWallets();

    return { configured: true, amountUsd: usd, result, before, after };
  });
}
