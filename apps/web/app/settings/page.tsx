"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { freezeAgent, getPolicy, updatePolicy, onboardUser, type Policy } from "@/lib/api";
import {
  getSession,
  isSignedIn,
  signOut,
  updateSession,
  type Autonomy,
  type Session,
} from "@/lib/session";

const AUTONOMY: { key: Autonomy; label: string }[] = [
  { key: "automatic", label: "Automatic" },
  { key: "hybrid", label: "Hybrid" },
  { key: "manual", label: "Manual" },
];

export default function Settings() {
  const router = useRouter();
  const [s, setS] = useState<Session | null>(null);
  const [saved, setSaved] = useState(false);
  const [pol, setPol] = useState<Policy | null>(null);

  useEffect(() => {
    if (!isSignedIn()) {
      router.replace("/auth");
      return;
    }
    setS(getSession());
    getPolicy()
      .then((r) => setPol(r.policy))
      .catch(() => {});
  }, [router]);

  function patchPol(p: Partial<Policy>) {
    setPol((prev) => (prev ? { ...prev, ...p } : prev));
    updatePolicy(p)
      .then((r) => setPol(r.policy))
      .catch(() => {});
  }

  function toggleFreeze() {
    if (!pol) return;
    const next = !pol.agentFrozen;
    setPol({ ...pol, agentFrozen: next });
    freezeAgent(next)
      .then((r) => setPol(r.policy))
      .catch(() => {});
  }

  function patch(p: Partial<Session>) {
    const next = updateSession(p);
    setS(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
    // Persist server-side prefs (best-effort — local mirror already updated).
    if (p.autonomy !== undefined || p.planEnabled !== undefined) {
      onboardUser({ autonomy: next.autonomy, planEnabled: next.planEnabled }).catch(() => {});
    }
  }

  if (!s) return null;

  return (
    <main className="mx-auto max-w-lg px-5 py-8">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/app" className="text-sm text-muted transition hover:text-ink">
          ← Home
        </Link>
        {saved && <span className="text-xs text-success">Saved</span>}
      </header>

      <h1 className="text-3xl font-bold tracking-tight">
        <span className="display text-primary2">Settings</span>
      </h1>

      {/* Autonomy */}
      <Section label="Agent autonomy" hint="Decides how much Cadence runs on its own.">
        <div className="grid grid-cols-3 gap-2">
          {AUTONOMY.map((a) => (
            <button
              key={a.key}
              onClick={() => patch({ autonomy: a.key })}
              className={`rounded-xl border p-2.5 text-sm transition ${
                s.autonomy === a.key ? "border-primary bg-primary-soft" : "border-border bg-surface"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Security */}
      <Section label="Security" hint="Asked before any payment.">
        <Field
          label="4-digit PIN"
          value={s.pin ?? ""}
          onChange={(v) => patch({ pin: v.replace(/\D/g, "").slice(0, 4) })}
          placeholder="••••"
        />
        <Field
          label="Safe-word"
          value={s.safeWord ?? ""}
          onChange={(v) => patch({ safeWord: v })}
          placeholder="a word only you know"
        />
      </Section>

      {/* Trust Architecture — guardrails + freeze */}
      <Section label="Agent guardrails" hint="Limits the agent runs inside — even in Automatic mode.">
        <div
          className={`flex items-center justify-between rounded-xl border p-3 ${
            pol?.agentFrozen ? "border-danger/50 bg-danger/10" : "border-border bg-surface"
          }`}
        >
          <div>
            <p className="text-sm font-medium">{pol?.agentFrozen ? "Agent is frozen" : "Freeze agent"}</p>
            <p className="text-xs text-muted">
              {pol?.agentFrozen ? "No payments can be made until you unfreeze." : "Instantly halt all agent money movement."}
            </p>
          </div>
          <button
            onClick={toggleFreeze}
            disabled={!pol}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              pol?.agentFrozen ? "bg-danger text-white" : "border border-border text-danger hover:bg-danger/10"
            }`}
          >
            {pol?.agentFrozen ? "Unfreeze" : "Freeze"}
          </button>
        </div>

        <CapField
          label="Per-payment limit ($)"
          hint="The most the agent may move in one payment. Above this needs you."
          minor={pol?.perPaymentCapMinor ?? null}
          onSave={(minor) => patchPol({ perPaymentCapMinor: minor })}
        />
        <CapField
          label="Daily limit ($)"
          hint="Total the agent may move per day."
          minor={pol?.dailyCapMinor ?? null}
          onSave={(minor) => patchPol({ dailyCapMinor: minor })}
        />

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
          <div>
            <p className="text-sm font-medium">Known recipients only</p>
            <p className="text-xs text-muted">Block payments to anyone you haven&apos;t paid before.</p>
          </div>
          <button
            onClick={() => pol && patchPol({ allowlistOnly: !pol.allowlistOnly })}
            disabled={!pol}
            className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${pol?.allowlistOnly ? "bg-primary" : "bg-surface2"}`}
            aria-label="Toggle known recipients only"
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white transition ${pol?.allowlistOnly ? "translate-x-5" : ""}`}
            />
          </button>
        </div>
      </Section>

      {/* Plan */}
      <Section label="Money plan" hint="How each incoming dollar is split.">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">
            {s.planEnabled ? "Plan is on" : "No plan set"}
          </span>
          <Link href="/setup" className="btn-ghost px-4 py-2 text-sm">
            Edit plan
          </Link>
        </div>
      </Section>

      {/* Profile */}
      <Section label="Profile">
        <Field label="Name" value={s.name} onChange={(v) => patch({ name: v })} />
        <Field label="Phone" value={s.phone ?? ""} onChange={(v) => patch({ phone: v })} />
      </Section>

      {/* Account */}
      <Section label="Account" hint="Your wallets stay; this only clears the session on this device.">
        <button
          onClick={() => {
            signOut();
            router.replace("/");
          }}
          className="btn-ghost w-full text-danger"
        >
          Sign out
        </button>
      </Section>
    </main>
  );
}

function CapField({
  label,
  hint,
  minor,
  onSave,
}: {
  label: string;
  hint?: string;
  minor: number | null;
  onSave: (minor: number | null) => void;
}) {
  const [text, setText] = useState(minor != null ? String(minor / 100) : "");
  // Keep in sync when the server value loads/changes.
  useEffect(() => {
    setText(minor != null ? String(minor / 100) : "");
  }, [minor]);

  function commit() {
    const n = parseFloat(text);
    onSave(text.trim() === "" || isNaN(n) ? null : Math.round(n * 100));
  }

  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <input
        value={text}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="No limit"
        className="mt-1.5 w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-primary"
      />
    </div>
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="label">{label}</h2>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-primary"
      />
    </div>
  );
}
