import Link from "next/link";
import { AllocationFlow } from "@/components/AllocationFlow";
import { Rings } from "@/components/Rings";
import { Sparkle } from "@/components/Sparkle";

const beats = [
  {
    title: "Guard",
    body: "Every incoming payment is checked against your pattern — overpayment scams and odd-hour transfers get flagged before a naira moves.",
  },
  {
    title: "Route",
    body: "Your dollars convert at the best live rate through BMONI, and you see exactly what you saved versus a bank on each one.",
  },
  {
    title: "Allocate",
    body: "What's left plays to your plan — a steady salary, goal vaults, family support, and a hedge against the naira sliding.",
  },
];

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* ambient */}
      <div className="pointer-events-none absolute -right-40 -top-24 opacity-70">
        <Rings size={420} progress={0.62} spin />
      </div>
      <Sparkle size={22} className="twinkle pointer-events-none absolute left-[8%] top-[38%]" />
      <Sparkle size={14} className="twinkle pointer-events-none absolute right-[12%] top-[62%]" />

      <main className="relative mx-auto max-w-6xl px-5">
        {/* Nav */}
        <nav className="flex items-center justify-between py-6">
          <span className="text-xl font-extrabold tracking-tight">Cadence</span>
          <div className="flex items-center gap-3">
            <span className="chip">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Live: BMONI sandbox
            </span>
            <Link href="/app" className="btn-primary px-4 py-2">
              Open app
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="grid items-center gap-12 py-14 md:grid-cols-2 md:py-20">
          <div>
            <span className="eyebrow">For freelancers paid in dollars</span>
            <h1 className="mt-5 text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
              Get paid in dollars.
              <br />
              <span className="display text-primary2">Live in rhythm.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              Cadence is an AI money agent for cross-border earners. The moment your
              dollars land, it guards them, converts at the best rate, and puts every
              one to work.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/auth" className="btn-primary">
                Get started
              </Link>
              <Link href="/app" className="btn-ghost">
                Watch it work
              </Link>
            </div>
          </div>

          {/* Signature: the allocation flow */}
          <div className="card">
            <div className="mb-5 flex items-center justify-between">
              <span className="label">Every dollar, allocated</span>
              <Sparkle size={14} />
            </div>
            <AllocationFlow />
          </div>
        </section>

        {/* The rhythm */}
        <section className="border-t border-border py-16">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-3xl tracking-tight sm:text-4xl">
              How every dollar <span className="display text-primary2">moves</span>
            </h2>
            <Rings size={64} progress={0.5} className="hidden shrink-0 sm:block" />
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {beats.map((b) => (
              <div key={b.title} className="card">
                <Sparkle size={16} className="mb-4" />
                <h3 className="display text-2xl">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Proof */}
        <section className="grid gap-8 border-t border-border py-16 sm:grid-cols-3">
          <div>
            <div className="stat text-3xl text-primary2">Real</div>
            <p className="mt-2 text-sm text-muted">
              Every conversion is a live BMONI sandbox call — not a mock.
            </p>
          </div>
          <div>
            <div className="stat text-3xl">USD + ₦</div>
            <p className="mt-2 text-sm text-muted">
              Managed stablecoin wallets, created with cryptographic proof of ownership.
            </p>
          </div>
          <div>
            <div className="stat text-3xl">AI</div>
            <p className="mt-2 text-sm text-muted">
              Anomaly detection and a natural-language agent that acts on your money.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-t border-border py-24 text-center">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50">
            <Rings size={280} progress={0.72} spin />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-xl text-4xl tracking-tight sm:text-5xl">
              Ready to find your <span className="display text-primary2">rhythm?</span>
            </h2>
            <div className="mt-8 flex justify-center">
              <Link href="/auth" className="btn-primary">
                Get started
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-border py-8 text-xs text-muted">
          Cadence · Intelligent money for cross-border earners
        </footer>
      </main>
    </div>
  );
}
