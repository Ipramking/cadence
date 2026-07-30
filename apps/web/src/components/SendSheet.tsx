"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { agentAct, payAgent, type AgentRoute } from "@/lib/api";
import { addReceipt, getSession, rememberRecipient, type Receipt } from "@/lib/session";

/** Manual payment sheet — reused by the Manual and Hybrid homes. */
export function SendSheet({ onClose, onPaid }: { onClose: () => void; onPaid?: (r: Receipt) => void }) {
  const session = getSession();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [route, setRoute] = useState<AgentRoute | null>(null);
  const [phase, setPhase] = useState<"form" | "review" | "done">("form");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const amountMinor = Math.round(parseFloat(amount || "0") * 100);

  async function review() {
    if (!recipient.trim() || amountMinor <= 0) return;
    setBusy(true);
    try {
      const r = await agentAct(`pay ${parseFloat(amount)} ${currency} to ${recipient}`, "USD");
      setRoute(r.route ?? null);
    } catch {
      setRoute(null);
    }
    setPhase("review");
    setBusy(false);
  }

  async function confirm() {
    const pin = session?.pin;
    const safe = session?.safeWord?.toLowerCase();
    if ((pin || safe) && secret.trim().toLowerCase() !== pin && secret.trim().toLowerCase() !== safe) {
      setErr("That didn't match your PIN or safe-word.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await payAgent({ recipient, amountMinor, currency, sourceCurrency: "USD" });
      if (res.ok && res.receipt) {
        addReceipt(res.receipt);
        rememberRecipient(recipient);
        onPaid?.(res.receipt);
        setPhase("done");
      } else {
        setErr("Payment failed — try again.");
      }
    } catch {
      setErr("Payment failed — try again.");
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border border-border bg-bg p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Send money</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>

        {phase === "form" && (
          <div className="space-y-3">
            <div>
              <label className="label">To</label>
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Name or @handle"
                className="mt-1.5 w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="label">Amount</label>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="flex-1 rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
                <div className="flex overflow-hidden rounded-xl border border-border">
                  {(["NGN", "USD"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={`px-3 text-sm ${currency === c ? "bg-primary text-white" : "bg-surface2 text-muted"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={review} disabled={busy || !recipient.trim() || amountMinor <= 0} className="btn-primary mt-2 w-full">
              {busy ? "…" : "Review"}
            </button>
          </div>
        )}

        {phase === "review" && (
          <div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-muted">To</span>
                <span className="font-medium">{recipient}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-muted">Amount</span>
                <span className="stat text-xl">{formatMoney(amountMinor, currency)}</span>
              </div>
              {route && (
                <p className="mt-2 rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
                  Paid from your dollars — {formatMoney(route.sourceMinor, "USD")} converted at ₦{route.rate}/$ via BMONI.
                </p>
              )}
            </div>
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="PIN or safe-word to confirm"
              className="mt-3 w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            {err && <p className="mt-1 text-xs text-danger">{err}</p>}
            <button onClick={confirm} disabled={busy} className="btn-primary mt-3 w-full">
              {busy ? "Sending…" : `Confirm & pay ${formatMoney(amountMinor, currency)}`}
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-success">✓</div>
            <p className="font-medium">Sent {formatMoney(amountMinor, currency)} to {recipient}</p>
            <button onClick={onClose} className="btn-ghost mt-5 w-full">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
