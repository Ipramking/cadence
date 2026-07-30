"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import { AgentHome } from "@/components/AgentHome";
import { SendSheet } from "@/components/SendSheet";
import { getWallets, type OverviewWallet } from "@/lib/api";

/** Agent-first, with quick manual controls docked at the top. */
export function HybridHome() {
  const [wallets, setWallets] = useState<OverviewWallet[]>([]);
  const [send, setSend] = useState(false);

  useEffect(() => {
    getWallets().then(setWallets).catch(() => setWallets([]));
  }, []);

  const usd = wallets.find((w) => w.balance.currency === "USD");
  const ngn = wallets.find((w) => w.balance.currency === "NGN");

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
          <div className="flex flex-1 gap-5">
            <div>
              <span className="label">USD</span>
              <div className="stat text-base">{usd ? formatMoney(usd.balance.minor, "USD") : "—"}</div>
            </div>
            <div>
              <span className="label">Naira</span>
              <div className="stat text-base">{ngn ? formatMoney(ngn.balance.minor, "NGN") : "—"}</div>
            </div>
          </div>
          <button onClick={() => setSend(true)} className="btn-primary px-4 py-2 text-sm">
            Send
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <AgentHome autonomy="hybrid" />
      </div>
      {send && <SendSheet onClose={() => setSend(false)} />}
    </div>
  );
}
