"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CadenceWave } from "@/components/CadenceWave";
import { login, signup, setToken } from "@/lib/api";
import { cacheUser } from "@/lib/session";

type Mode = "signup" | "login";

export default function Auth() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function proceed() {
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!mail || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Password needs at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const res =
        mode === "signup"
          ? await signup({ email: mail, password, name: name.trim() || undefined, phone: phone.trim() || undefined })
          : await login({ email: mail, password });
      setToken(res.token);
      const s = cacheUser(res.user);
      router.push(s.onboarded ? "/app" : "/onboarding");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("409")) setError("That email is already registered — sign in instead.");
      else if (msg.includes("401")) setError("Wrong email or password.");
      else if (msg.includes("400")) setError("Check your email and password and try again.");
      else setError("Couldn't reach Cadence — the server may be waking up. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <div className="h-5 w-8">
          <CadenceWave bars={8} />
        </div>
        <span className="text-lg font-bold tracking-tight">Cadence</span>
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">
        Find your <span className="display text-primary2">rhythm</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "signup"
          ? "Create your account to set up your money. No card, no bank branch."
          : "Welcome back — sign in to your money agent."}
      </p>

      <div className="card mt-8">
        {mode === "signup" && (
          <>
            <label className="label">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Okafor"
              className="mt-1.5 w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-primary"
            />
          </>
        )}

        <label className={`label ${mode === "signup" ? "mt-4" : ""} block`}>Email</label>
        <input
          value={email}
          type="email"
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ada@example.com"
          className="mt-1.5 w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-primary"
        />

        {mode === "signup" && (
          <>
            <label className="label mt-4 block">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08145997956"
              className="mt-1.5 w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-primary"
            />
          </>
        )}

        <label className="label mt-4 block">Password</label>
        <input
          value={password}
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && proceed()}
          placeholder="••••••••"
          className="mt-1.5 w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-primary"
        />

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <button onClick={proceed} disabled={busy} className="btn-primary mt-6 w-full disabled:opacity-60">
          {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        {mode === "signup" ? "Already have an account?" : "New to Cadence?"}{" "}
        <button
          onClick={() => {
            setError(null);
            setMode(mode === "signup" ? "login" : "signup");
          }}
          className="text-primary2 underline-offset-2 hover:underline"
        >
          {mode === "signup" ? "Sign in" : "Create one"}
        </button>
      </p>
    </main>
  );
}
