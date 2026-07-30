"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CadenceWave } from "@/components/CadenceWave";
import { signIn, isOnboarded } from "@/lib/session";

export default function Auth() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function proceed() {
    signIn(name.trim() || "there", email.trim() || "you@example.com");
    router.push(isOnboarded() ? "/app" : "/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <div className="h-5 w-8">
          <CadenceWave bars={8} />
        </div>
        <span className="text-lg font-bold tracking-tight">Cadence</span>
      </Link>

      <h1 className="text-3xl font-extrabold tracking-tight">Find your rhythm</h1>
      <p className="mt-2 text-sm text-muted">
        Sign in to set up your money. No card, no bank branch.
      </p>

      <div className="card mt-8">
        <label className="label">Your name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ada"
          className="mt-1.5 w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-dollar"
        />
        <label className="label mt-4 block">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && proceed()}
          placeholder="ada@example.com"
          className="mt-1.5 w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-dollar"
        />
        <button onClick={proceed} className="btn-primary mt-6 w-full">
          Continue
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
        <button onClick={proceed} className="btn-ghost w-full">
          Continue with Google
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Demo sign-in — your session stays on this device.
      </p>
    </main>
  );
}
