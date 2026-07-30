import Link from "next/link";
import { CadenceWave } from "@/components/CadenceWave";

const beats = [
  {
    beat: "one",
    title: "Guard",
    body: "Every incoming payment is checked against your pattern — overpayment scams and odd-hour transfers get flagged before a naira moves.",
  },
  {
    beat: "two",
    title: "Route",
    body: "Your dollars convert at the best live rate through BMONI, and you see exactly what you saved versus a bank on each one.",
  },
  {
    beat: "three",
    title: "Allocate",
    body: "What's left plays out to your plan — a steady salary, goal vaults, family support, and a hedge against the naira sliding.",
  },
];

export default function Landing() {
  return (
    <main className="mx-auto max-w-6xl px-5">
      {/* Nav */}
      <nav className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-8">
            <CadenceWave bars={8} />
          </div>
          <span className="text-lg font-bold tracking-tight">Cadence</span>
        </div>
        <Link href="/app" className="text-sm text-muted transition hover:text-ink">
          Open app →
        </Link>
      </nav>

      {/* Hero */}
      <section className="grid items-center gap-12 py-12 md:grid-cols-2 md:py-20">
        <div>
          <span className="eyebrow">For freelancers paid in dollars</span>
          <h1 className="mt-5 text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl">
            Get paid in dollars.
            <br />
            <span className="text-dollar">Live in rhythm.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            Cadence is an AI money agent for cross-border earners. The moment your
            dollars land, it guards them, converts at the best rate, and puts every
            one to work — salary, goals, family, and a hedge against the naira.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/auth" className="btn-primary">
              Get started
            </Link>
            <Link href="/app" className="btn-ghost">
              Watch it work
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted" style={{ fontFamily: "var(--font-mono)" }}>
            Real BMONI conversions · live FX · sandbox test funds
          </p>
        </div>

        {/* Signature */}
        <div className="card relative overflow-hidden p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-dollar" style={{ fontFamily: "var(--font-mono)" }}>
              $ in
            </span>
            <span className="text-naira" style={{ fontFamily: "var(--font-mono)" }}>
              ₦ steady
            </span>
          </div>
          <div className="mt-4 h-48">
            <CadenceWave bars={48} />
          </div>
          <p className="mt-5 text-sm text-muted">
            Irregular income, resolved into a steady beat.
          </p>
        </div>
      </section>

      {/* The rhythm */}
      <section className="border-t border-border py-16">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          How every dollar moves
        </h2>
        <p className="mt-3 max-w-lg text-muted">
          One agent, one pass — from the second a payment arrives to the moment it's
          working for you.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {beats.map((b) => (
            <div key={b.title} className="card">
              <div className="flex items-center gap-2 text-dollar">
                <div className="h-4 w-6">
                  <CadenceWave bars={5} />
                </div>
                <span className="text-xs uppercase tracking-[0.2em]" style={{ fontFamily: "var(--font-mono)" }}>
                  beat {b.beat}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Proof */}
      <section className="grid gap-6 border-t border-border py-16 sm:grid-cols-3">
        <div>
          <div className="stat text-3xl text-dollar">Real</div>
          <p className="mt-1 text-sm text-muted">Every conversion is a live BMONI sandbox call — not a mock.</p>
        </div>
        <div>
          <div className="stat text-3xl text-naira">USD + ₦</div>
          <p className="mt-1 text-sm text-muted">Managed stablecoin wallets, created with cryptographic proof of ownership.</p>
        </div>
        <div>
          <div className="stat text-3xl">AI</div>
          <p className="mt-1 text-sm text-muted">Anomaly detection and a natural-language agent that acts on your money.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20 text-center">
        <h2 className="mx-auto max-w-xl text-4xl font-extrabold tracking-tight">
          Ready to find your rhythm?
        </h2>
        <div className="mt-8 flex justify-center">
          <Link href="/auth" className="btn-primary">
            Get started
          </Link>
        </div>
        <p className="mt-16 text-xs text-muted" style={{ fontFamily: "var(--font-mono)" }}>
          Cadence · Intelligent money for cross-border earners
        </p>
      </section>
    </main>
  );
}
