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
