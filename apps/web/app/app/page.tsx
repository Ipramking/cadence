"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { CadenceWave } from "@/components/CadenceWave";
import { isSignedIn } from "@/lib/session";
import {
  getLiveBalances,
  getOverview,
  getTransactions,
  getWallets,
  previewInflow,
  runLiveConvert,
  runLiveSend,
  sendAgentCommand,
  type ApiTransaction,
  type InflowPreview,
  type LiveBalances,
  type OverviewWallet,
} from "@/lib/api";
import {
  activity as mockActivity,
  savedVsBankMinor,
  wallets as mockWallets,
  type ActivityView,
  type Risk,
  type WalletView,
} from "@/lib/mock";

const PURPOSE_LABEL: Record<string, string> = {
  main: "Main balance",
  salary: "Monthly salary",
  goal: "Savings goal",
  family: "Family support",
  hedge: "USD hedge",
  reserve: "Reserve",
};

function mapWallet(w: OverviewWallet): WalletView {
  return {
    name: w.name,
    purpose: PURPOSE_LABEL[w.purpose] ?? w.purpose,
    currency: w.balance.currency as WalletView["currency"],
    balanceMinor: w.balance.minor,
    accent: w.purpose === "goal" || w.purpose === "hedge" ? "gold" : undefined,
  };
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function mapTx(t: ApiTransaction): ActivityView {
  const sym = t.amount.currency === "USD" ? "$" : t.amount.currency === "NGN" ? "₦" : "";
  const flagged = (t.metadata?.risk as Risk) ?? (t.status === "flagged" ? "high" : "clear");
  const reason = t.metadata?.riskReasons?.[0];
  const detail = flagged !== "clear" && reason ? reason : `${t.type} · ${t.status}`;
  return {
    id: t.id,
    title: t.counterparty ? `Payment from ${t.counterparty}` : `${t.type} transaction`,
    detail,
    amount: `${t.type === "inflow" ? "+" : ""}${sym}${(t.amount.minor / 100).toLocaleString()}`,
    risk: flagged,
    time: relTime(t.occurredAt),
  };
}

const riskStyles: Record<Risk, string> = {
  clear: "text-primary bg-primary-soft",
  watch: "text-warn bg-[rgba(230,178,77,0.14)]",
  high: "text-danger bg-[rgba(247,109,109,0.14)]",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Dashboard() {
  const router = useRouter();
  useEffect(() => {
    if (!isSignedIn()) router.replace("/auth");
  }, [router]);

  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [preview, setPreview] = useState<InflowPreview | null>(null);
  const [agentText, setAgentText] = useState("");
  const [agentReply, setAgentReply] = useState<string | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [liveWallets, setLiveWallets] = useState<WalletView[] | null>(null);
  const [liveActivity, setLiveActivity] = useState<ActivityView[] | null>(null);
  const [liveBal, setLiveBal] = useState<LiveBalances | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveMsg, setLiveMsg] = useState<string | null>(null);

  function refreshLive() {
    getLiveBalances().then(setLiveBal).catch(() => setLiveBal(null));
  }

  async function runLive() {
    if (liveBusy) return;
    setLiveBusy(true);
    setLiveMsg(null);
    try {
      const r = await runLiveConvert(5);
      setLiveMsg(
        `Converted $${r.amountUsd} → ₦${(r.tx.amount.minor / 100).toLocaleString()} at ₦${r.tx.metadata.rate} on BMONI.`,
      );
      setLiveBal({ configured: true, wallets: r.after });
    } catch {
      setLiveMsg("Live conversion failed — check the sandbox.");
    }
    setLiveBusy(false);
  }

  async function runSend() {
    if (liveBusy) return;
    setLiveBusy(true);
    setLiveMsg(null);
    try {
      const r = await runLiveSend(1);
      setLiveMsg(
        r.result.ok
          ? "Sent $1 on BMONI — proposal signed and submitted."
          : `Send needs a funded wallet (${r.result.step}${r.result.error ? ": " + r.result.error : ""}).`,
      );
      setLiveBal({ configured: true, wallets: r.after });
    } catch {
      setLiveMsg("Live send failed — check the sandbox.");
    }
    setLiveBusy(false);
  }

  async function sendAgent() {
    const text = agentText.trim();
    if (!text || agentBusy) return;
    setAgentBusy(true);
    setAgentReply(null);
    try {
      const res = await sendAgentCommand(text);
      setAgentReply(res.reply);
      setAgentText("");
    } catch {
      setAgentReply("I couldn't reach the agent just now — try again.");
    }
    setAgentBusy(false);
  }

  useEffect(() => {
    getOverview().then((o) => setRate(o.rate.rate)).catch(() => setRate(null));
    getWallets()
      .then((ws) => setLiveWallets(ws.length ? ws.map(mapWallet) : null))
      .catch(() => setLiveWallets(null));
    getTransactions(25)
      .then((ts) => {
        if (!ts.length) return setLiveActivity(null);
        const rank: Record<Risk, number> = { high: 2, watch: 1, clear: 0 };
        const mapped = ts.map(mapTx).sort((a, b) => rank[b.risk] - rank[a.risk]);
        setLiveActivity(mapped.slice(0, 7));
      })
      .catch(() => setLiveActivity(null));
    refreshLive();
  }, []);

  const usdLive = liveBal?.wallets.find((w) => w.currency === "USD");
  const ngnLive = liveBal?.wallets.find((w) => w.currency === "NGN");
  const walletList = liveWallets ?? mockWallets;
  const activityList = liveActivity ?? mockActivity;

  const stages = [
    { label: "Guarded", note: "Verified — not the overpayment pattern" },
    {
      label: "Routed",
      note: preview
        ? `Converted at ₦${preview.rate.toFixed(2)}/$ — saved ${formatMoney(preview.savedVsBankMinor, "NGN")} vs bank`
        : "Routed via the cheapest path",
    },
    {
      label: "Allocated",
      note: preview
        ? `${formatMoney(preview.receivesMinor, "NGN")} → salary, rent vault, home`
        : "Salary ₦180k · Rent ₦120k · Home ₦40k",
    },
  ];

  async function runPipeline() {
    if (running) return;
    setRunning(true);
    setStep(-1);
    setPreview(null);
    try {
      setPreview(await previewInflow(500));
    } catch {
      // API offline — fall back to the static narrative
    }
    for (let i = 0; i < stages.length; i++) {
      await sleep(650);
      setStep(i);
    }
    setRunning(false);
  }

  const heroSaved = preview?.savedVsBankMinor ?? savedVsBankMinor;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-9">
              <CadenceWave bars={9} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Cadence</h1>
              <p className="text-sm text-muted">Your cross-border money, on autopilot.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/setup" className="text-sm text-muted transition hover:text-ink">
              Plan
            </Link>
            <span className="chip">
              <span className="h-1.5 w-1.5 rounded-full bg-dollar" />
              {rate ? `₦${rate.toFixed(2)}/$ live` : "sandbox · test data"}
            </span>
          </div>
        </div>
      </header>

      {/* Hero + pipeline */}
      <section className="mb-6 grid gap-4 md:grid-cols-5">
        <div className="card md:col-span-2 flex flex-col justify-between">
          <span className="label">Saved vs your bank{preview ? " · this payment" : " · this quarter"}</span>
          <div className="mt-3">
            <div className="stat text-4xl text-naira">{formatMoney(heroSaved, "NGN")}</div>
            <p className="mt-2 text-sm text-muted">
              Smarter routing and timing on every dollar you receive.
            </p>
          </div>
        </div>

        <div className="card md:col-span-3">
          <div className="flex items-center justify-between">
            <span className="label">Incoming payment</span>
            <button onClick={runPipeline} disabled={running} className="btn-primary px-3.5 py-1.5">
              {running ? "Working…" : "Simulate $500"}
            </button>
          </div>
          <ol className="mt-4 space-y-2.5">
            {stages.map((s, i) => {
              const active = step >= i;
              return (
                <li
                  key={s.label}
                  className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                    active ? "border-border bg-surface2" : "border-transparent opacity-40"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      active ? "bg-primary text-white" : "bg-surface2 text-muted"
                    }`}
                  >
                    {active ? "✓" : i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted">{s.note}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Wallets */}
      <section className="mb-6">
        <h2 className="label mb-3">Wallets</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {walletList.map((w) => {
            const pct = w.goal
              ? Math.min(100, Math.round((w.balanceMinor / w.goal.targetMinor) * 100))
              : null;
            return (
              <div key={w.name} className="card">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{w.name}</span>
                  <span className="text-xs text-muted">{w.currency}</span>
                </div>
                <div className={`mt-2 stat ${w.accent === "gold" ? "text-naira" : ""}`}>
                  {formatMoney(w.balanceMinor, w.currency)}
                </div>
                <p className="mt-1 text-xs text-muted">{w.purpose}</p>
                {pct !== null && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
                    <div className="h-full rounded-full bg-naira" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Live BMONI account */}
      {liveBal?.configured && (
        <section className="mb-6">
          <h2 className="label mb-3">Live BMONI account · real sandbox</h2>
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-8">
                <div>
                  <span className="label">USDB</span>
                  <div className="stat">${((usdLive?.balance.minor ?? 0) / 100).toLocaleString()}</div>
                </div>
                <div>
                  <span className="label">CNGN</span>
                  <div className="stat">₦{((ngnLive?.balance.minor ?? 0) / 100).toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={runLive} disabled={liveBusy} className="btn-primary px-4 py-2">
                  {liveBusy ? "…" : "Convert $5 live"}
                </button>
                <button onClick={runSend} disabled={liveBusy} className="btn-ghost px-4 py-2">
                  Send $1 live
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">
              {liveMsg ??
                "Balances read live from BMONI. Fund the sandbox wallets to move real value."}
            </p>
          </div>
        </section>
      )}

      {/* Activity */}
      <section className="mb-24">
        <h2 className="label mb-3">Recent activity</h2>
        <div className="card divide-y divide-border p-0">
          {activityList.map((a) => (
            <div key={a.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="truncate text-xs text-muted">{a.detail}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${riskStyles[a.risk]}`} style={{ fontFamily: "var(--font-mono)" }}>
                {a.risk}
              </span>
              <div className="w-24 text-right">
                <p className="text-sm" style={{ fontFamily: "var(--font-mono)" }}>{a.amount}</p>
                <p className="text-xs text-muted">{a.time}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Agent bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto max-w-5xl px-5 py-3">
          {agentReply && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm">
              <span className="mt-0.5 text-dollar">✦</span>
              <p className="text-ink">{agentReply}</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              value={agentText}
              onChange={(e) => setAgentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendAgent()}
              disabled={agentBusy}
              placeholder="Tell Cadence what to do — “send home ₦60k this month”"
              className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-dollar disabled:opacity-60"
            />
            <button onClick={sendAgent} disabled={agentBusy || !agentText.trim()} className="btn-primary px-4 py-2.5">
              {agentBusy ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
