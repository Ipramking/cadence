"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AllocationFlow, type FlowItem } from "@/components/AllocationFlow";
import { getRules, updateRule, type Rule } from "@/lib/api";

const META: Record<Rule["kind"], { title: string; blurb: string; dot: string }> = {
  salary: { title: "Monthly salary", blurb: "paid to you steadily", dot: "var(--primary)" },
  goal: { title: "Rent vault", blurb: "goal · due the 30th", dot: "var(--success)" },
  family: { title: "Send home", blurb: "family support", dot: "var(--warn)" },
  hedge: { title: "USD hedge", blurb: "against the naira", dot: "var(--primary-2)" },
};

export default function Setup() {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [pct, setPct] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getRules()
      .then((rs) => {
        setRules(rs);
        setPct(Object.fromEntries(rs.map((r) => [r.id, r.percentage])));
      })
      .catch(() => setRules([]));
  }, []);

  const total = useMemo(() => Object.values(pct).reduce((a, b) => a + b, 0), [pct]);
  const remainder = Math.max(0, 100 - total);
  const over = total > 100;

  const flowItems: FlowItem[] = useMemo(
    () =>
      (rules ?? [])
        .filter((r) => (pct[r.id] ?? 0) > 0)
        .map((r) => ({
          pct: pct[r.id] ?? 0,
          label: META[r.kind].title,
          sub: META[r.kind].blurb,
          dot: META[r.kind].dot,
        })),
    [rules, pct],
  );

  async function save() {
    if (!rules || over || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all(
        rules.filter((r) => r.percentage !== pct[r.id]).map((r) => updateRule(r.id, { percentage: pct[r.id] })),
      );
      setSaved(true);
    } catch {
      /* noop */
    }
    setSaving(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/app" className="text-sm text-muted transition hover:text-ink">← Home</Link>
        {saved && <span className="text-xs text-success">Saved</span>}
      </header>

      <h1 className="text-3xl font-bold tracking-tight">
        Your money <span className="display text-primary2">plan</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        How each incoming dollar is split. Whatever&apos;s left stays in your main balance.
      </p>

      {rules === null ? (
        <p className="mt-8 text-sm text-muted">Loading…</p>
      ) : (
        <>
          {/* live flow */}
          {flowItems.length > 0 && (
            <div className="card mt-6">
              <AllocationFlow amount="$1" items={flowItems} />
            </div>
          )}

          {/* sliders */}
          <div className="mt-4 space-y-3">
            {rules.map((r) => (
              <div key={r.id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{META[r.kind].title}</p>
                    <p className="text-xs text-muted">{META[r.kind].blurb}</p>
                  </div>
                  <span className="stat text-lg text-primary2">{pct[r.id] ?? 0}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pct[r.id] ?? 0}
                  onChange={(e) => {
                    setSaved(false);
                    setPct((p) => ({ ...p, [r.id]: Number(e.target.value) }));
                  }}
                  className="mt-3 w-full accent-[var(--primary)]"
                />
              </div>
            ))}
          </div>

          {/* total */}
          <div className="card mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Allocated</span>
              <span className={over ? "text-danger" : "text-ink"} style={{ fontVariantNumeric: "tabular-nums" }}>
                {total}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface2">
              <div className={`h-full rounded-full ${over ? "bg-danger" : "bg-primary"}`} style={{ width: `${Math.min(100, total)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {over ? "Over 100% — trim a slice to save." : `${remainder}% stays in your main balance.`}
            </p>
          </div>

          <button onClick={save} disabled={over || saving} className="btn-primary mt-5 w-full">
            {saving ? "Saving…" : "Save plan"}
          </button>
        </>
      )}
    </main>
  );
}
