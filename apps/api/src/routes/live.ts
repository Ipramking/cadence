import type { FastifyInstance } from "fastify";
import { sandbox, ownerContext } from "../bmoni/real.js";
import { bmoniFetch } from "../bmoni/http.js";
import { liveSend } from "../bmoni/send.js";

/**
 * Direct window onto the real BMONI sandbox account — used to demonstrate a
 * genuinely funded transaction. Balances come straight from BMONI; the convert
 * runs a real exchange and reports balances before and after so the movement
 * is visible.
 */
export async function liveRoutes(app: FastifyInstance): Promise<void> {
  app.get("/live/balances", async () => {
    const real = sandbox();
    if (!real) return { configured: false, wallets: [] };
    const wallets = (await real.listWallets()) as (Awaited<
      ReturnType<typeof real.listWallets>
    >[number] & { address?: string })[];
    // Enrich with the on-chain smart-wallet addresses.
    try {
      const owner = ownerContext();
      if (owner) {
        const raw = await bmoniFetch<{ id: string; walletAddress: string }[]>(
          `/v1/users/${owner.userId}/smart-wallets/account/wallets`,
        );
        const byId = new Map(raw.map((w) => [w.id, w.walletAddress]));
        wallets.forEach((w) => (w.address = byId.get(w.id)));
      }
    } catch {
      /* addresses are best-effort */
    }
    return { configured: true, wallets };
  });

  app.post("/live/convert", async (req) => {
    const real = sandbox();
    if (!real) return { configured: false };
    const body = (req.body ?? {}) as { amountUsd?: number };
    const usd = Math.min(10, Math.max(1, Math.round(body.amountUsd ?? 5)));

    const before = await real.listWallets();
    const tx = await real.convert({
      amount: { minor: usd * 100, currency: "USD" },
      to: "NGN",
    });
    const after = await real.listWallets();

    return { configured: true, amountUsd: usd, tx, before, after };
  });

  // Fallback proof: a real send that moves USDB out (delivered as CNGN),
  // signed with the owner key. Use if exchange/convert turns out quote-only.
  app.post("/live/send", async (req) => {
    const real = sandbox();
    if (!real) return { configured: false };
    const body = (req.body ?? {}) as { amountUsd?: number };
    const usd = Math.min(10, Math.max(1, Math.round(body.amountUsd ?? 1)));

    const before = await real.listWallets();
    const result = await liveSend(usd);
    const after = await real.listWallets();

    return { configured: true, amountUsd: usd, result, before, after };
  });
}
