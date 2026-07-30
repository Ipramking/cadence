"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CadenceWave } from "@/components/CadenceWave";
import { getRules, updateRule, type Rule } from "@/lib/api";
import { completeOnboarding, getSession, isSignedIn } from "@/lib/session";

const KIND_META: Record<Rule["kind"], { title: string; blurb: string }> = {
  salary: { title: "Monthly salary", blurb: "Paid to you as a steady wage" },
  goal: { title: "Savings goal", blurb: "Fills a vault like rent" },
  family: { title: "Family support", blurb: "Sent home each cycle" },
  hedge: { title: "USD hedge", blurb: "Held against naira devaluation" },
};

const WALLET_STEPS = [
  "Creating your USD wallet",
  "Creating your naira wallet",
  "Proving ownership with your key",
  "Wallets ready",
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("there");

  // wallet-creation animation
  const [walletStage, setWalletStage] = useState(0);

  // plan
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [pct, setPct] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSignedIn()) {
      router.replace("/auth");
      return;
    }
    setName(getSession()?.name || "there");
  }, [router]);

  // drive the wallet-creation animation when on step 1
  useEffect(() => {
    if (step !== 1) return;
    setWalletStage(0);
    const timers = WALLET_STEPS.map((_, i) =>
      setTimeout(() => setWalletStage(i + 1), 700 * (i + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [step]);

  // load rules when entering the plan step
  useEffect(() => {
    if (step !== 2 || rules) return;
    getRules()
      .then((rs) => {
        setRules(rs);
        setPct(Object.fromEntries(rs.map((r) => [r.id, r.percentage])));
      })
      .catch(() => setRules([]));
  }, [step, rules]);

  const total = useMemo(() => Object.values(pct).reduce((a, b) => a + b, 0), [pct]);
  const over = total > 100;

  async function finish() {
    if (over || saving) return;
    setSaving(true);
    try {
      if (rules) {
        await Promise.all(
          rules
            .filter((r) => r.percentage !== pct[r.id])
            .map((r) => updateRule(r.id, { percentage: pct[r.id] })),
        );
      }
    } catch {
      // keep going — the plan is saved best-effort
    }
    completeOnboarding();
    router.push("/app");
  }

  const walletsDone = walletStage >= WALLET_STEPS.length;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-5 py-10">
      {/* progress — three beats */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition ${
              i <= step ? "bg-dollar" : "bg-surface2"
            }`}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-center py-10">
        {step === 0 && (
          <div>
            <div className="mb-6 h-10 w-16">
              <CadenceWave bars={12} />
            </div>
            <span className="eyebrow">Beat one</span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">
              Let&apos;s set your <span className="display text-primary2">rhythm</span>, {name}.
            </h1>
            <p className="mt-4 text-muted">
              In two quick steps we&apos;ll spin up your wallets and decide how each
              incoming dollar is split. You can change it anytime.
            </p>
            <button onClick={() => setStep(1)} className="btn-primary mt-8">
              Begin
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <span className="eyebrow">Beat two</span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">
              Creating your <span className="display text-primary2">wallets</span>
            </h1>
            <p className="mt-4 text-muted">
              A dollar wallet and a naira wallet, secured with your own key.
            </p>
            <ul className="mt-8 space-y-3">
              {WALLET_STEPS.map((label, i) => {
                const done = walletStage > i;
                const active = walletStage === i;
                return (
                  <li
                    key={label}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                      done || active ? "border-border bg-surface2" : "border-transparent opacity-40"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                        done ? "bg-primary text-white" : "bg-surface2 text-muted"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className="text-sm">{label}</span>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => setStep(2)}
              disabled={!walletsDone}
              className="btn-primary mt-8"
            >
              {walletsDone ? "Continue" : "Working…"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <span className="eyebrow">Beat three</span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">
              Set your money <span className="display text-primary2">plan</span>
            </h1>
            <p className="mt-4 text-muted">
              How should each incoming dollar be split? The rest stays in your main
              balance.
            </p>

            {rules === null ? (
              <p className="mt-8 text-sm text-muted">Loading…</p>
            ) : (
              <div className="mt-8 space-y-3">
                {rules.map((r) => {
                  const meta = KIND_META[r.kind];
                  return (
                    <div key={r.id} className="card">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{meta.title}</p>
                          <p className="text-xs text-muted">{meta.blurb}</p>
                        </div>
                        <span className="stat text-dollar">{pct[r.id] ?? 0}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={pct[r.id] ?? 0}
                        onChange={(e) =>
                          setPct((p) => ({ ...p, [r.id]: Number(e.target.value) }))
                        }
                        className="mt-3 w-full accent-[var(--primary)]"
                      />
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-1 text-sm">
                  <span className="text-muted">Allocated</span>
                  <span className={over ? "text-danger" : "text-ink"} style={{ fontFamily: "var(--font-mono)" }}>
                    {total}%
                  </span>
                </div>
              </div>
            )}

            <button onClick={finish} disabled={over || saving} className="btn-primary mt-8">
              {saving ? "Saving…" : "Enter Cadence"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
