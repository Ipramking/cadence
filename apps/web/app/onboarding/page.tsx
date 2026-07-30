"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkle } from "@/components/Sparkle";
import { getRules, updateRule, type Rule } from "@/lib/api";
import {
  completeOnboarding,
  getSession,
  isSignedIn,
  updateSession,
  type Autonomy,
} from "@/lib/session";

const WALLET_STEPS = [
  "Verifying your details",
  "Creating your USD wallet",
  "Creating your naira wallet",
  "Wallets ready",
];

const AUTONOMY: { key: Autonomy; title: string; blurb: string; tag?: string }[] = [
  {
    key: "automatic",
    title: "Automatic",
    blurb: "Cadence runs your money. You just chat — it converts, allocates and pays.",
    tag: "Recommended",
  },
  {
    key: "hybrid",
    title: "Hybrid",
    blurb: "Agent-first, with manual controls a tap away when you want them.",
  },
  {
    key: "manual",
    title: "Manual",
    blurb: "A classic banking view. You do everything yourself; the agent only assists.",
  },
];

const KIND_META: Record<Rule["kind"], string> = {
  salary: "Monthly salary",
  goal: "Savings goal",
  family: "Family support",
  hedge: "USD hedge",
};

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(-1);

  // KYC-lite
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bvn, setBvn] = useState("22222222222");

  // choices
  const [autonomy, setAutonomy] = useState<Autonomy>("automatic");
  const [planChoice, setPlanChoice] = useState<"none" | "self" | "ai" | null>(null);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [pct, setPct] = useState<Record<string, number>>({});
  const [pin, setPin] = useState("");
  const [safeWord, setSafeWord] = useState("");

  useEffect(() => {
    if (!isSignedIn()) {
      router.replace("/auth");
      return;
    }
    setName(getSession()?.name ?? "");
  }, [router]);

  // wallet-creation animation
  useEffect(() => {
    if (creating < 0) return;
    if (creating >= WALLET_STEPS.length) {
      const t = setTimeout(() => {
        setCreating(-1);
        setStep(1);
      }, 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCreating((c) => c + 1), 700);
    return () => clearTimeout(t);
  }, [creating]);

  // load plan rules when picking "self"
  useEffect(() => {
    if (planChoice !== "self" || rules) return;
    getRules()
      .then((rs) => {
        setRules(rs);
        setPct(Object.fromEntries(rs.map((r) => [r.id, r.percentage])));
      })
      .catch(() => setRules([]));
  }, [planChoice, rules]);

  const total = useMemo(() => Object.values(pct).reduce((a, b) => a + b, 0), [pct]);

  async function finish() {
    updateSession({
      name: name.trim() || "there",
      phone: phone.trim(),
      autonomy,
      planEnabled: planChoice === "self" || planChoice === "ai",
      pin: pin.trim() || undefined,
      safeWord: safeWord.trim() || undefined,
    });
    if (planChoice === "self" && rules) {
      try {
        await Promise.all(
          rules.filter((r) => r.percentage !== pct[r.id]).map((r) => updateRule(r.id, { percentage: pct[r.id] })),
        );
      } catch {
        /* best effort */
      }
    }
    completeOnboarding();
    router.push("/app");
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 py-8">
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-surface2"}`} />
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-center py-8">
        {/* Step 0 — KYC-lite */}
        {step === 0 && creating < 0 && (
          <div>
            <span className="eyebrow">Step one</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              Open your <span className="display text-primary2">account</span>
            </h1>
            <p className="mt-3 text-sm text-muted">
              We&apos;ll create your USD and naira wallets. Sandbox — use the test BVN.
            </p>
            <div className="mt-6 space-y-3">
              <Field label="Full name" value={name} onChange={setName} placeholder="Ada Okafor" />
              <Field label="Phone" value={phone} onChange={setPhone} placeholder="+234…" />
              <Field label="BVN (test)" value={bvn} onChange={setBvn} placeholder="22222222222" />
            </div>
            <button onClick={() => setCreating(0)} className="btn-primary mt-6 w-full">
              Create my account
            </button>
          </div>
        )}

        {/* wallet-creation animation */}
        {creating >= 0 && (
          <div>
            <span className="eyebrow">Setting up</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              Creating your <span className="display text-primary2">wallets</span>
            </h1>
            <ul className="mt-8 space-y-3">
              {WALLET_STEPS.map((label, i) => {
                const done = creating > i;
                return (
                  <li
                    key={label}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                      creating >= i ? "border-border bg-surface2" : "border-transparent opacity-40"
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
          </div>
        )}

        {/* Step 1 — autonomy */}
        {step === 1 && (
          <div>
            <span className="eyebrow">Step two</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              How much should Cadence <span className="display text-primary2">run?</span>
            </h1>
            <div className="mt-6 space-y-3">
              {AUTONOMY.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAutonomy(a.key)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    autonomy === a.key ? "border-primary bg-primary-soft" : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{a.title}</span>
                    {a.tag && <span className="pill">{a.tag}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{a.blurb}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} className="btn-primary mt-6 w-full">
              Continue
            </button>
          </div>
        )}

        {/* Step 2 — plan */}
        {step === 2 && (
          <div>
            <span className="eyebrow">Step three</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              A plan for every <span className="display text-primary2">dollar?</span>
            </h1>
            <p className="mt-3 text-sm text-muted">
              Split each incoming dollar into salary, goals, family and a hedge — or skip it.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {(["ai", "self", "none"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setPlanChoice(c)}
                  className={`rounded-xl border p-3 text-sm transition ${
                    planChoice === c ? "border-primary bg-primary-soft" : "border-border bg-surface"
                  }`}
                >
                  {c === "ai" ? "Let AI suggest" : c === "self" ? "I'll choose" : "Skip"}
                </button>
              ))}
            </div>

            {planChoice === "ai" && (
              <p className="mt-4 rounded-xl bg-surface2 p-3 text-sm text-muted">
                Cadence will suggest 50% salary · 20% rent · 15% family · 15% hedge — adjustable anytime.
              </p>
            )}
            {planChoice === "self" && rules && (
              <div className="mt-4 space-y-3">
                {rules.map((r) => (
                  <div key={r.id} className="card">
                    <div className="flex items-center justify-between text-sm">
                      <span>{KIND_META[r.kind]}</span>
                      <span className="stat text-base text-primary2">{pct[r.id] ?? 0}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pct[r.id] ?? 0}
                      onChange={(e) => setPct((p) => ({ ...p, [r.id]: Number(e.target.value) }))}
                      className="mt-2 w-full accent-[var(--primary)]"
                    />
                  </div>
                ))}
                <p className="text-xs text-muted">Allocated {total}%</p>
              </div>
            )}

            <button
              onClick={() => setStep(3)}
              disabled={planChoice === null}
              className="btn-primary mt-6 w-full"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 3 — security */}
        {step === 3 && (
          <div>
            <span className="eyebrow">Step four</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              Lock it to <span className="display text-primary2">you</span>
            </h1>
            <p className="mt-3 text-sm text-muted">
              Cadence asks for these before it moves money — so no one else can pay from your chat.
            </p>
            <div className="mt-6 space-y-3">
              <Field
                label="4-digit PIN"
                value={pin}
                onChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
              />
              <Field label="Safe-word" value={safeWord} onChange={setSafeWord} placeholder="a word only you know" />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Sparkle size={12} /> Used only when confirming payments.
            </div>
            <button onClick={finish} className="btn-primary mt-6 w-full">
              Enter Cadence
            </button>
          </div>
        )}
      </div>
    </main>
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
