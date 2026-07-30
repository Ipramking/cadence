"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onboardUser } from "@/lib/api";
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

  useEffect(() => {
    if (!isSignedIn()) {
      router.replace("/auth");
      return;
    }
    setS(getSession());
  }, [router]);

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
