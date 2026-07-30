"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getRules, updateRule, type Rule } from "@/lib/api";

const KIND_META: Record<Rule["kind"], { title: string; blurb: string }> = {
  salary: { title: "Monthly salary", blurb: "Paid to you as a steady wage" },
  goal: { title: "Savings goal", blurb: "Fills a vault like rent" },
  family: { title: "Family support", blurb: "Sent home each cycle" },
  hedge: { title: "USD hedge", blurb: "Held against naira devaluation" },
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

  const total = useMemo(
    () => Object.values(pct).reduce((a, b) => a + b, 0),
    [pct],
  );
  const remainder = Math.max(0, 100 - total);
  const over = total > 100;

  async function save() {
    if (!rules || over || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all(
        rules
          .filter((r) => r.percentage !== pct[r.id])
          .map((r) => updateRule(r.id, { percentage: pct[r.id] })),
      );
      setSaved(true);
    } catch {
      // leave the UI as-is on failure
    }
    setSaving(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-8">
        <Link href="/app" className="text-sm text-muted hover:text-ink">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Your money plan</h1>
        <p className="mt-1 text-sm text-muted">
          Decide how each incoming dollar is split. Anything left over stays in your main balance.
        </p>
      </header>

      {rules === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <div className="space-y-3">
            {rules.map((r) => {
              const meta = KIND_META[r.kind];
              return (
                <div key={r.id} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{meta.title}</p>
                      <p className="text-xs text-muted">{meta.blurb}</p>
                    </div>
                    <span className="stat text-accent">{pct[r.id] ?? 0}%</span>
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
                    className="mt-3 w-full accent-[var(--accent)]"
                  />
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="card mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Allocated</span>
              <span className={over ? "text-danger" : "text-ink"}>{total}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface2">
              <div
                className={`h-full rounded-full ${over ? "bg-danger" : "bg-accent"}`}
                style={{ width: `${Math.min(100, total)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {over
                ? "Over 100% — reduce a slice to save."
                : `${remainder}% stays in your main balance.`}
            </p>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={save}
              disabled={over || saving}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-black transition disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save plan"}
            </button>
            {saved && <span className="text-sm text-accent">✓ Saved</span>}
          </div>
        </>
      )}
    </main>
  );
}
