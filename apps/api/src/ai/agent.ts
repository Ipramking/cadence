import { aiAvailable, generate, generateVision } from "./client.js";

export type AgentIntentKind =
  | "pay"
  | "convert"
  | "allocate"
  | "balance"
  | "activity"
  | "plan"
  | "help"
  | "chat"
  | "unknown";

export interface AgentAction {
  intent: AgentIntentKind;
  /** Amount in minor units (NGN kobo / USD cents). */
  amountMinor?: number;
  currency?: "USD" | "NGN";
  /** For conversions. */
  targetCurrency?: "USD" | "NGN";
  /** For payments. */
  recipient?: string;
  /** One concise sentence in Cadence's voice. */
  reply: string;
  /** True when the action moves money — drives the serious tone + guardian. */
  serious: boolean;
}

const SYSTEM =
  "You are Cadence, an AI money agent for cross-border earners. You are competent " +
  "and concise, never chatty. When money moves (payments, conversions, allocations) " +
  "you are precise and serious: restate the amount, currency and recipient plainly, " +
  "and note that you'll confirm before sending. For casual or general questions, " +
  "answer in one short line and move on. Never invent balances or numbers.";

/** Parse a natural-language instruction into a structured, actionable intent. */
export async function interpret(text: string): Promise<AgentAction> {
  const fallback: AgentAction = {
    intent: "unknown",
    reply: 'Tell me what to do — e.g. "pay ₦20,000 to Musa" or "what\'s my balance".',
    serious: false,
  };
  if (!aiAvailable()) return fallback;
  try {
    const raw = await generate(
      `User said: "${text}"\n` +
        "Return JSON with keys: intent (one of pay, convert, allocate, balance, " +
        "activity, plan, help, chat, unknown); amountMinor (integer minor units — " +
        "NGN kobo or USD cents; omit if none); currency (USD or NGN); targetCurrency " +
        "(USD or NGN, for conversions); recipient (name or handle, for payments); " +
        "serious (true if this moves money); reply (one concise sentence — if paying, " +
        "restate the amount and recipient and say you'll confirm).",
      { system: SYSTEM, json: true, temperature: 0.15 },
    );
    const p = JSON.parse(raw) as Partial<AgentAction>;
    return {
      intent: (p.intent as AgentIntentKind) ?? "unknown",
      amountMinor: typeof p.amountMinor === "number" ? p.amountMinor : undefined,
      currency: p.currency,
      targetCurrency: p.targetCurrency,
      recipient: p.recipient,
      reply: p.reply ?? fallback.reply,
      serious: p.serious === true,
    };
  } catch {
    return fallback;
  }
}

export type TxType =
  | "send"
  | "transfer"
  | "airtime"
  | "data"
  | "electricity"
  | "cable"
  | "internet"
  | "education"
  | "betting"
  | "convert"
  | "balance"
  | "history"
  | "chat"
  | "unknown";

export interface ChatSlots {
  amountMinor?: number;
  currency?: "USD" | "NGN";
  phone?: string;
  recipient?: string;
  bank?: string;
  accountNumber?: string;
  provider?: string;
  meterNumber?: string;
  smartcard?: string;
  plan?: string;
  fromCurrency?: "USD" | "NGN";
  toCurrency?: "USD" | "NGN";
  note?: string;
}

export interface ChatResult {
  type: TxType;
  slots: ChatSlots;
  missing: string[];
  ready: boolean;
  reply: string;
}

const CHAT_SYSTEM =
  "You are Cadence, an AI money agent inside a Nigerian banking app. You handle: " +
  "send money, bank transfer, buy airtime, buy data, pay electricity, cable TV, " +
  "internet, education, betting wallet funding, currency conversion, and balance/history " +
  "questions. Rules: (1) Keep context across the whole conversation and combine earlier " +
  "and later messages into ONE complete request — e.g. 'buy me 200' then 'airtime' means " +
  "buy ₦200 airtime. (2) Never act on an incomplete request; identify the required details " +
  "for the type and ask for any that are missing, one at a time, in one short sentence. " +
  "(3) Be concise and serious about money, light for small talk. (4) Currencies are NGN (₦) " +
  "and USD ($); understand cross-currency requests like 'send the equivalent of $100 in naira'. " +
  "Required details per type — airtime/data: amount + phone; electricity: amount + meterNumber + " +
  "provider; cable: provider + smartcard; internet: provider + amount; education: amount + provider; " +
  "betting: provider + accountNumber + amount; transfer (bank): amount + accountNumber + bank; " +
  "send (to a person or phone): amount + recipient; convert: amount + fromCurrency + toCurrency.";

/** Conversational, context-aware, slot-filling interpreter. */
export async function chatAgent(
  messages: { role: "user" | "agent"; text: string }[],
): Promise<ChatResult> {
  const fallback: ChatResult = {
    type: "unknown",
    slots: {},
    missing: [],
    ready: false,
    reply: 'Tell me what to do — e.g. "buy ₦500 airtime for 0803…" or "send ₦20k to Musa".',
  };
  if (!aiAvailable()) return fallback;

  const transcript = messages
    .slice(-10)
    .map((m) => `${m.role === "user" ? "User" : "Cadence"}: ${m.text}`)
    .join("\n");

  try {
    const raw = await generate(
      `Conversation so far:\n${transcript}\n\n` +
        "Return JSON: { type (one of send, transfer, airtime, data, electricity, cable, " +
        "internet, education, betting, convert, balance, history, chat, unknown); slots " +
        "{ amountMinor (integer minor units — NGN kobo or USD cents), currency (USD|NGN), " +
        "phone, recipient, bank, accountNumber, provider, meterNumber, smartcard, plan, " +
        "fromCurrency, toCurrency, note }; missing (array of required slot names still needed); " +
        "ready (boolean — true only when nothing required is missing); reply (one short sentence: " +
        "if not ready, ask for the single most important missing detail; if ready, confirm what " +
        "you'll do, restating amount and destination). Fill slots from the ENTIRE conversation.",
      { system: CHAT_SYSTEM, json: true, temperature: 0.15 },
    );
    const p = JSON.parse(raw) as Partial<ChatResult>;
    return {
      type: (p.type as TxType) ?? "unknown",
      slots: p.slots ?? {},
      missing: Array.isArray(p.missing) ? p.missing : [],
      ready: p.ready === true,
      reply: p.reply ?? fallback.reply,
    };
  } catch {
    return fallback;
  }
}

export interface ParsedPayment {
  recipient?: string;
  amountMinor?: number;
  currency?: "USD" | "NGN";
  bank?: string;
  account?: string;
  note?: string;
}

/** Extract payment details from a screenshot/photo (invoice, account details). */
export async function parsePaymentImage(
  dataBase64: string,
  mimeType: string,
): Promise<ParsedPayment> {
  if (!aiAvailable()) return {};
  try {
    const raw = await generateVision(
      "This image shows payment details — an invoice, a transfer request, or bank " +
        "account details. Extract them. Return JSON with keys: recipient (name), " +
        "amountMinor (integer minor units — NGN kobo or USD cents), currency (USD or " +
        "NGN), bank, account (account number), note. Omit any field you can't read.",
      { data: dataBase64, mimeType },
      { json: true },
    );
    return JSON.parse(raw) as ParsedPayment;
  } catch {
    return {};
  }
}
