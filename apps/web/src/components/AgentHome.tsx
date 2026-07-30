"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { Rings } from "@/components/Rings";
import { Sparkle } from "@/components/Sparkle";
import {
  agentAct,
  parsePaymentImage,
  payAgent,
  type AgentRoute,
} from "@/lib/api";
import {
  addReceipt,
  getReceipts,
  getSession,
  rememberRecipient,
  type Receipt,
} from "@/lib/session";

interface Pending {
  recipient: string;
  amountMinor: number;
  currency: "USD" | "NGN";
  route?: AgentRoute | null;
  note?: string;
}

interface Msg {
  id: string;
  role: "agent" | "user";
  kind: "text" | "confirm" | "receipt";
  text?: string;
  pending?: Pending;
  receipt?: Receipt;
  done?: boolean;
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());

export function AgentHome({ autonomy = "automatic" }: { autonomy?: string }) {
  const session = getSession();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: "hello",
      role: "agent",
      kind: "text",
      text: `Hi ${session?.name ?? "there"}. Tell me what to do — “pay ₦20,000 to Musa”, “what's my balance”, or send a screenshot of a bill.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const started = msgs.some((m) => m.role === "user");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  function push(m: Omit<Msg, "id">) {
    setMsgs((x) => [...x, { id: uid(), ...m }]);
  }

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    setInput("");
    push({ role: "user", kind: "text", text });
    setBusy(true);
    try {
      const r = await agentAct(text, "USD");
      push({ role: "agent", kind: "text", text: r.reply });
      if (r.intent === "pay" && r.needsConfirm && r.recipient && r.amountMinor && r.currency) {
        push({
          role: "agent",
          kind: "confirm",
          pending: {
            recipient: r.recipient,
            amountMinor: r.amountMinor,
            currency: r.currency,
            route: r.route,
          },
        });
      }
    } catch {
      push({ role: "agent", kind: "text", text: "I couldn't reach the network just now — try again." });
    }
    setBusy(false);
  }

  async function onFile(file: File) {
    setBusy(true);
    push({ role: "user", kind: "text", text: `📎 ${file.name}` });
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] ?? "";
      const parsed = await parsePaymentImage(base64, file.type || "image/png");
      if (parsed.recipient && parsed.amountMinor && parsed.currency) {
        push({ role: "agent", kind: "text", text: `Read a bill for ${parsed.recipient}. Confirm to pay.` });
        let route: AgentRoute | null = null;
        if (parsed.currency !== "USD") {
          const r = await agentAct(
            `pay ${parsed.amountMinor / 100} ${parsed.currency} to ${parsed.recipient}`,
            "USD",
          );
          route = r.route ?? null;
        }
        push({
          role: "agent",
          kind: "confirm",
          pending: {
            recipient: parsed.recipient,
            amountMinor: parsed.amountMinor,
            currency: parsed.currency,
            route,
            note: parsed.note,
          },
        });
      } else {
        push({ role: "agent", kind: "text", text: "I couldn't read clear payment details from that image." });
      }
    } catch {
      push({ role: "agent", kind: "text", text: "That image didn't process — try a clearer screenshot." });
    }
    setBusy(false);
  }

  async function confirmPay(msgId: string, p: Pending, secret: string): Promise<string | null> {
    const pin = session?.pin;
    const safe = session?.safeWord?.toLowerCase();
    if ((pin || safe) && secret.trim().toLowerCase() !== pin && secret.trim().toLowerCase() !== safe) {
      return "That didn't match. Try your PIN or safe-word.";
    }
    const res = await payAgent({
      recipient: p.recipient,
      amountMinor: p.amountMinor,
      currency: p.currency,
      sourceCurrency: "USD",
      note: p.note,
    });
    if (!res.ok || !res.receipt) return "Payment failed — try again.";
    const receipt: Receipt = { ...res.receipt };
    addReceipt(receipt);
    rememberRecipient(p.recipient);
    setMsgs((x) => x.map((m) => (m.id === msgId ? { ...m, done: true } : m)));
    push({ role: "agent", kind: "receipt", receipt });
    return null;
  }

  return (
    <div className="relative mx-auto flex h-full max-w-2xl flex-col px-4">
      <div className="pointer-events-none absolute -right-24 -top-16 opacity-40">
        <Rings size={220} progress={0.6} spin />
      </div>

      {/* header */}
      <header className="relative flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold tracking-tight">Cadence</span>
          <span className="chip">{autonomy}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/wallet" className="btn-ghost px-3 py-1.5 text-xs">
            Wallet
          </Link>
          <button onClick={() => setShowReceipts(true)} className="btn-ghost px-3 py-1.5 text-xs">
            Receipts
          </button>
          <Link href="/settings" className="btn-ghost px-3 py-1.5 text-xs">
            Settings
          </Link>
        </div>
      </header>

      {/* body */}
      {!started ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-7 px-2 pb-10 text-center">
          <div className="float">
            <Rings size={92} progress={0.66} spin />
          </div>
          <div className="rise">
            <h1 className="text-3xl font-bold tracking-tight">
              Hi {session?.name ?? "there"}.{" "}
              <span className="display text-primary2">What are we doing?</span>
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Pay anyone in any currency, check a balance, or scan a bill — just tell me.
            </p>
          </div>
          <div className="rise flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => send(s.text)}
                className="chip transition hover:border-primary hover:text-primary2"
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="rise w-full max-w-xl">
            <Composer input={input} setInput={setInput} onSend={send} onAttach={onFile} busy={busy} floating />
          </div>
        </div>
      ) : (
        <>
          <div className="relative flex-1 space-y-3 overflow-y-auto py-4">
            {msgs.map((m) =>
              m.kind === "text" ? (
                <Bubble key={m.id} role={m.role}>
                  {m.text}
                </Bubble>
              ) : m.kind === "confirm" && m.pending ? (
                <ConfirmCard key={m.id} p={m.pending} done={m.done} onConfirm={(secret) => confirmPay(m.id, m.pending!, secret)} />
              ) : m.kind === "receipt" && m.receipt ? (
                <ReceiptCard key={m.id} r={m.receipt} />
              ) : null,
            )}
            <div ref={endRef} />
          </div>
          <div className="pb-3">
            <Composer input={input} setInput={setInput} onSend={send} onAttach={onFile} busy={busy} />
          </div>
        </>
      )}

      {showReceipts && <ReceiptsDrawer onClose={() => setShowReceipts(false)} />}
    </div>
  );
}

const SUGGESTIONS = [
  { label: "What's my balance", text: "what's my balance" },
  { label: "Pay ₦20,000 to Musa", text: "pay ₦20,000 to Musa" },
  { label: "Convert $100 to naira", text: "convert $100 to naira" },
  { label: "Send ₦50,000 home", text: "send ₦50,000 home" },
];

function Composer({
  input,
  setInput,
  onSend,
  onAttach,
  busy,
  floating,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onAttach: (f: File) => void;
  busy: boolean;
  floating?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`flex items-center gap-2 ${
        floating
          ? "rounded-full border border-primary/40 bg-surface p-1.5 shadow-[0_12px_60px_-14px_rgba(91,91,246,0.65)]"
          : ""
      }`}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onAttach(e.target.files[0])}
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-muted transition hover:text-primary2"
        aria-label="Attach a bill"
      >
        📎
      </button>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        disabled={busy}
        placeholder="Tell Cadence what to do…"
        className={`h-11 flex-1 rounded-full px-4 text-sm outline-none placeholder:text-muted disabled:opacity-60 ${
          floating ? "bg-transparent" : "border border-border bg-surface focus:border-primary"
        }`}
      />
      <button onClick={() => onSend()} disabled={busy || !input.trim()} className="btn-primary h-11 px-5">
        {busy ? "…" : "Send"}
      </button>
    </div>
  );
}

function Bubble({ role, children }: { role: "agent" | "user"; children: React.ReactNode }) {
  const agent = role === "agent";
  return (
    <div className={`flex ${agent ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          agent ? "border border-border bg-surface" : "bg-primary text-white"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function ConfirmCard({
  p,
  done,
  onConfirm,
}: {
  p: Pending;
  done?: boolean;
  onConfirm: (secret: string) => Promise<string | null>;
}) {
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setErr(null);
    const e = await onConfirm(secret);
    if (e) setErr(e);
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-primary/40 bg-surface p-4">
      <div className="flex items-center gap-2">
        <Sparkle size={14} />
        <span className="label">Confirm payment</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-muted">To</span>
        <span className="font-medium">{p.recipient}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-muted">Amount</span>
        <span className="stat text-xl">{formatMoney(p.amountMinor, p.currency)}</span>
      </div>
      {p.route && (
        <p className="mt-2 rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
          Paid from your dollars — {formatMoney(p.route.sourceMinor, "USD")} converted at ₦
          {p.route.rate}/$ via BMONI.
        </p>
      )}
      {done ? (
        <p className="mt-3 text-sm text-success">✓ Sent</p>
      ) : (
        <>
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="PIN or safe-word to confirm"
            className="mt-3 w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {err && <p className="mt-1 text-xs text-danger">{err}</p>}
          <button onClick={go} disabled={busy} className="btn-primary mt-3 w-full">
            {busy ? "Sending…" : `Confirm & pay ${formatMoney(p.amountMinor, p.currency)}`}
          </button>
        </>
      )}
    </div>
  );
}

function ReceiptCard({ r }: { r: Receipt }) {
  return (
    <div className="rounded-2xl border border-border bg-surface2 p-4">
      <div className="flex items-center justify-between">
        <span className="label">Receipt</span>
        <span className="text-xs text-success">Settled</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-sm">{r.recipient}</span>
        <span className="stat text-lg">{formatMoney(r.amountMinor, r.currency as "USD" | "NGN")}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{new Date(r.at).toLocaleString()}</p>
    </div>
  );
}

function ReceiptsDrawer({ onClose }: { onClose: () => void }) {
  const receipts = getReceipts();
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-sm overflow-y-auto border-l border-border bg-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Receipts</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">Kept even after your chat clears.</p>
        <div className="mt-4 space-y-3">
          {receipts.length === 0 && <p className="text-sm text-muted">No payments yet.</p>}
          {receipts.map((r) => (
            <ReceiptCard key={r.id} r={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
