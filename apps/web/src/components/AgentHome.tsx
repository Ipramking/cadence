"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { Rings } from "@/components/Rings";
import { Sparkle } from "@/components/Sparkle";
import {
  agentChat,
  executeTx,
  parsePaymentImage,
  type AgentRoute,
  type ChatSlots,
  type ExecReceipt,
  type Payee,
  type Risk,
} from "@/lib/api";
import {
  addReceipt,
  getReceipts,
  getSession,
  rememberRecipient,
  type Receipt,
} from "@/lib/session";

const PAYABLE = new Set([
  "send",
  "transfer",
  "airtime",
  "data",
  "electricity",
  "cable",
  "internet",
  "education",
  "betting",
  "convert",
]);

const TX_TITLE: Record<string, string> = {
  send: "Send money",
  transfer: "Bank transfer",
  airtime: "Buy airtime",
  data: "Buy data",
  electricity: "Electricity bill",
  cable: "Cable TV",
  internet: "Internet bill",
  education: "School fees",
  betting: "Fund betting",
  convert: "Convert money",
};

const TIMELINE_STEPS = [
  "Understanding your request",
  "Validating the details",
  "Checking your wallet",
  "Connecting to the provider",
  "Processing the payment",
  "Generating your receipt",
];

const SUGGESTIONS = [
  { label: "Buy ₦500 airtime", text: "buy ₦500 airtime" },
  { label: "Send ₦20k to Musa", text: "send ₦20,000 to Musa" },
  { label: "Pay electricity", text: "pay my electricity bill" },
  { label: "Convert $100 to naira", text: "convert $100 to naira" },
];

interface TxData {
  type: string;
  slots: ChatSlots;
  route?: AgentRoute | null;
  payee?: Payee | null;
  risk?: Risk;
}

interface Msg {
  id: string;
  role: "user" | "agent";
  kind: "text" | "confirm" | "timeline" | "receipt";
  text?: string;
  tx?: TxData;
  receipt?: ExecReceipt;
  done?: boolean;
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());

function describeDest(type: string, s: ChatSlots, payee?: Payee | null): string {
  switch (type) {
    case "send":
      return payee?.name ?? s.recipient ?? s.phone ?? "Recipient";
    case "transfer":
      return `${s.accountNumber ?? ""}${s.bank ? " · " + s.bank : ""}`.trim() || "—";
    case "airtime":
    case "data":
      return s.phone ?? "—";
    case "electricity":
      return [s.provider, s.meterNumber].filter(Boolean).join(" · ") || "—";
    case "cable":
      return [s.provider, s.smartcard].filter(Boolean).join(" · ") || "—";
    case "convert":
      return `to ${s.toCurrency ?? "NGN"}`;
    default:
      return s.provider ?? s.accountNumber ?? "—";
  }
}

export function AgentHome({ autonomy = "automatic" }: { autonomy?: string }) {
  const session = getSession();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: "hello",
      role: "agent",
      kind: "text",
      text: `Hi ${session?.name ?? "there"}. Tell me what to do — buy airtime, pay a bill, send money, or convert. I'll ask for anything I'm missing.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const executed = useRef<Set<string>>(new Set());
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
    const convo = [
      ...msgs.filter((m) => m.kind === "text").map((m) => ({ role: m.role, text: m.text ?? "" })),
      { role: "user" as const, text },
    ];
    push({ role: "user", kind: "text", text });
    setBusy(true);
    try {
      const r = await agentChat(convo);
      push({ role: "agent", kind: "text", text: r.reply });
      if (r.ready && PAYABLE.has(r.type) && r.slots.amountMinor) {
        push({ role: "agent", kind: "confirm", tx: { type: r.type, slots: r.slots, route: r.route, payee: r.payee, risk: r.risk } });
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
      const parsed = await parsePaymentImage(dataUrl.split(",")[1] ?? "", file.type || "image/png");
      if (parsed.recipient && parsed.amountMinor && parsed.currency) {
        const r = await agentChat([
          { role: "user", text: `send ${parsed.amountMinor / 100} ${parsed.currency} to ${parsed.recipient}` },
        ]);
        push({ role: "agent", kind: "text", text: `Read a bill for ${parsed.recipient}. Confirm to pay.` });
        push({
          role: "agent",
          kind: "confirm",
          tx: { type: "send", slots: { ...parsed }, route: r.route, payee: r.payee, risk: r.risk },
        });
      } else {
        push({ role: "agent", kind: "text", text: "I couldn't read clear payment details from that image." });
      }
    } catch {
      push({ role: "agent", kind: "text", text: "That image didn't process — try a clearer screenshot." });
    }
    setBusy(false);
  }

  async function confirmTx(msgId: string, tx: TxData, secret: string): Promise<string | null> {
    const pin = session?.pin;
    const safe = session?.safeWord?.toLowerCase();
    const val = secret.trim().toLowerCase();
    if (tx.risk === "high") {
      // Step-up: an unusual payment must be approved with the safe-word.
      if (safe) {
        if (val !== safe) return "This looks unusual — approve it with your safe-word.";
      } else if (pin && val !== pin) {
        return "This looks unusual — re-enter your PIN to approve.";
      }
    } else if ((pin || safe) && val !== pin && val !== safe) {
      return "That didn't match your PIN or safe-word.";
    }
    setMsgs((x) => x.map((m) => (m.id === msgId ? { ...m, done: true } : m)));
    push({ role: "agent", kind: "timeline", tx });
    return null;
  }

  async function runExecution(msgId: string, tx: TxData) {
    if (executed.current.has(msgId)) return;
    executed.current.add(msgId);
    try {
      const res = await executeTx({ type: tx.type, slots: tx.slots, route: tx.route ?? null });
      if (!res.ok) {
        setMsgs((x) => x.map((m) => (m.id === msgId ? { ...m, done: true } : m)));
        push({
          role: "agent",
          kind: "text",
          text: res.error ?? "Your guardrails stopped that payment — nothing was sent.",
        });
        return;
      }
      if (res.ok && res.receipt) {
        const rec = res.receipt;
        const sessionReceipt: Receipt = {
          id: rec.id,
          reference: rec.reference,
          txType: rec.txType,
          recipient: rec.recipient,
          amountMinor: rec.amountMinor,
          currency: rec.currency,
          route: rec.route
            ? { fromCurrency: rec.route.fromCurrency, rate: rec.route.rate, sourceMinor: rec.route.sourceMinor }
            : null,
          at: rec.at,
        };
        addReceipt(sessionReceipt);
        if (tx.payee?.name) rememberRecipient(tx.payee.name);
        setMsgs((x) => x.map((m) => (m.id === msgId ? { ...m, done: true } : m)));
        push({ role: "agent", kind: "receipt", receipt: rec });
      }
    } catch {
      push({ role: "agent", kind: "text", text: "The payment couldn't complete — nothing was sent." });
    }
  }

  return (
    <div className="relative mx-auto flex h-full max-w-2xl flex-col px-4">
      <div className="pointer-events-none absolute -right-24 -top-16 opacity-40">
        <Rings size={220} progress={0.6} spin />
      </div>

      <header className="relative flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold tracking-tight">Cadence</span>
          <span className="chip">{autonomy}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/wallet" className="btn-ghost px-3 py-1.5 text-xs">Wallet</Link>
          <button onClick={() => setShowReceipts(true)} className="btn-ghost px-3 py-1.5 text-xs">Receipts</button>
          <Link href="/settings" className="btn-ghost px-3 py-1.5 text-xs">Settings</Link>
        </div>
      </header>

      {!started ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-7 px-2 pb-10 text-center">
          <div className="float">
            <Rings size={92} progress={0.66} spin />
          </div>
          <div className="rise">
            <h1 className="text-3xl font-bold tracking-tight">
              Hi {session?.name ?? "there"}. <span className="display">What are we doing?</span>
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Buy airtime, pay bills, send money, or convert — just tell me.
            </p>
          </div>
          <div className="rise flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s.label} onClick={() => send(s.text)} className="chip transition hover:border-primary hover:text-primary2">
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
                <Bubble key={m.id} role={m.role}>{m.text}</Bubble>
              ) : m.kind === "confirm" && m.tx ? (
                <ConfirmTx key={m.id} tx={m.tx} done={m.done} onConfirm={(secret) => confirmTx(m.id, m.tx!, secret)} />
              ) : m.kind === "timeline" && m.tx ? (
                <TimelineCard key={m.id} onComplete={() => runExecution(m.id, m.tx!)} />
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
        floating ? "rounded-full border border-primary/40 bg-surface p-1.5 shadow-[0_12px_60px_-14px_rgba(168,85,247,0.6)]" : ""
      }`}
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onAttach(e.target.files[0])} />
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
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${agent ? "border border-border bg-surface" : "bg-primary text-white"}`}>
        {children}
      </div>
    </div>
  );
}

function ConfirmTx({ tx, done, onConfirm }: { tx: TxData; done?: boolean; onConfirm: (secret: string) => Promise<string | null> }) {
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const amount = formatMoney(tx.slots.amountMinor ?? 0, (tx.slots.currency ?? "NGN") as "USD" | "NGN");

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
        <span className="label">{TX_TITLE[tx.type] ?? "Confirm"}</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-muted">To</span>
        <span className="font-medium">{describeDest(tx.type, tx.slots, tx.payee)}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-muted">Amount</span>
        <span className="stat text-xl">{amount}</span>
      </div>
      {tx.payee?.phone && (
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-muted">Phone</span>
          <span className="code">{tx.payee.phone}</span>
        </div>
      )}
      {tx.route && (
        <div className="callout mt-2 text-xs">
          Paid from your dollars — <span className="code">{formatMoney(tx.route.sourceMinor, "USD")}</span> at{" "}
          <span className="code">₦{tx.route.rate}/$</span> via BMONI.
        </div>
      )}
      {tx.risk === "high" && (
        <div className="mt-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          ⚠ Aegis flagged this as unusual. Approve with your <b>safe-word</b> to continue.
        </div>
      )}
      {done ? (
        <p className="mt-3 text-sm text-success">✓ Confirmed</p>
      ) : (
        <>
          <input
            value={secret}
            type="password"
            onChange={(e) => setSecret(e.target.value)}
            placeholder={tx.risk === "high" ? "Safe-word to approve" : "PIN or safe-word to confirm"}
            className="mt-3 w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {err && <p className="mt-1 text-xs text-danger">{err}</p>}
          <button onClick={go} disabled={busy} className="btn-primary mt-3 w-full">
            {busy ? "…" : `Confirm ${amount}`}
          </button>
        </>
      )}
    </div>
  );
}

function TimelineCard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const failedRef = useRef(false);
  useEffect(() => {
    if (step >= TIMELINE_STEPS.length) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 520);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <ol className="space-y-2">
        {TIMELINE_STEPS.map((label, i) => {
          const isDone = step > i;
          const isActive = step === i;
          return (
            <li key={label} className={`flex items-center gap-3 text-sm ${isDone || isActive ? "" : "opacity-40"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${isDone ? "bg-primary text-white" : "bg-surface2 text-muted"}`}>
                {isDone ? "✓" : isActive ? "•" : ""}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
      {failedRef.current && <p className="mt-2 text-xs text-danger">Stopped — please try again.</p>}
    </div>
  );
}

function ReceiptCard({ r }: { r: ExecReceipt }) {
  return (
    <div className="rounded-2xl border border-border bg-surface2 p-4">
      <div className="flex items-center justify-between">
        <span className="label">{TX_TITLE[r.txType] ?? "Receipt"}</span>
        <span className="text-xs text-success">Successful</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-sm">{r.recipient}</span>
        <span className="stat text-lg">{formatMoney(r.amountMinor, r.currency as "USD" | "NGN")}</span>
      </div>
      <div className="mt-2 space-y-0.5 text-xs text-muted">
        <div className="flex justify-between">
          <span>Reference</span>
          <span className="code">{r.reference}</span>
        </div>
        <div className="flex justify-between">
          <span>Date</span>
          <span>{new Date(r.at).toLocaleString()}</span>
        </div>
      </div>
      <p className="mt-3 border-t border-border pt-2 text-[10px] uppercase tracking-wider text-muted">
        Processed via Cadence · powered by BMONI
      </p>
    </div>
  );
}

function ReceiptsDrawer({ onClose }: { onClose: () => void }) {
  const receipts = getReceipts();
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-sm overflow-y-auto border-l border-border bg-bg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Receipts</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>
        <p className="mt-1 text-xs text-muted">Kept even after your chat clears.</p>
        <div className="mt-4 space-y-3">
          {receipts.length === 0 && <p className="text-sm text-muted">No payments yet.</p>}
          {receipts.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.recipient}</span>
                <span className="stat text-base">{formatMoney(r.amountMinor, r.currency as "USD" | "NGN")}</span>
              </div>
              {r.reference && <span className="code mt-1 inline-block">{r.reference}</span>}
              <p className="mt-1 text-xs text-muted">{new Date(r.at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
