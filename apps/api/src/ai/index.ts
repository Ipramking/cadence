/**
 * Cadence AI layer. Each function degrades gracefully: if the model is
 * unavailable or errors, a deterministic fallback keeps the product working
 * (offline-tolerant, the way real users on poor networks need it).
 */
import type {
  AllocationPlan,
  RiskAssessment,
  Transaction,
} from "@cadence/shared";
import { aiAvailable, generate } from "./client.js";

export { aiAvailable };

const SYSTEM =
  "You are Cadence, a money agent for Nigerian freelancers who earn in USD. " +
  "Speak plainly and briefly, like a trusted friend who is good with money. " +
  "Never invent numbers; only use the figures given to you.";

/** Turn a risk assessment into one plain-language sentence for the user. */
export async function explainRisk(
  tx: Pick<Transaction, "counterparty" | "amount">,
  risk: RiskAssessment,
): Promise<string> {
  const fallback =
    risk.level === "clear"
      ? "This payment looks normal for you."
      : `Heads up — ${risk.reasons[0] ?? "this payment is unusual"}. Review before it's used.`;
  if (!aiAvailable()) return fallback;
  try {
    return await generate(
      `A payment of ${money(tx.amount)} arrived${tx.counterparty ? ` from ${tx.counterparty}` : ""}. ` +
        `Risk level: ${risk.level}. Reasons: ${risk.reasons.join("; ") || "none"}. ` +
        `Write one short sentence telling the user what this means and whether to be careful.`,
      { system: SYSTEM, temperature: 0.3 },
    );
  } catch {
    return fallback;
  }
}

export interface AgentIntent {
  action:
    | "send_family"
    | "set_salary"
    | "create_goal"
    | "adjust_allocation"
    | "unknown";
  amountMinor?: number;
  currency?: "USD" | "NGN";
  target?: string;
  reply: string;
}

/** Parse a natural-language instruction into a structured intent. */
export async function parseCommand(text: string): Promise<AgentIntent> {
  const fallback: AgentIntent = {
    action: "unknown",
    reply: "I didn't quite catch that — try e.g. \"send home ₦60k this month\".",
  };
  if (!aiAvailable()) return fallback;
  try {
    const raw = await generate(
      `Instruction: "${text}"\n` +
        "Classify into JSON with keys: action (one of send_family, set_salary, " +
        "create_goal, adjust_allocation, unknown), amountMinor (integer minor " +
        "units: NGN kobo or USD cents, omit if none), currency (USD or NGN, omit " +
        "if none), target (short label, optional), reply (one friendly sentence " +
        "confirming what you'll do).",
      { system: SYSTEM, json: true, temperature: 0.1 },
    );
    const parsed = JSON.parse(raw) as Partial<AgentIntent>;
    return {
      action: parsed.action ?? "unknown",
      amountMinor: parsed.amountMinor,
      currency: parsed.currency,
      target: parsed.target,
      reply: parsed.reply ?? fallback.reply,
    };
  } catch {
    return fallback;
  }
}

/** A short, shareable recap of the month's cross-border income. */
export async function incomeStory(input: {
  receivedUsdMinor: number;
  convertedNgnMinor: number;
  savedVsBankMinor: number;
  payments: number;
}): Promise<string> {
  const fallback =
    `This month you received ${usd(input.receivedUsdMinor)} across ${input.payments} ` +
    `payments and saved ${ngn(input.savedVsBankMinor)} versus your bank.`;
  if (!aiAvailable()) return fallback;
  try {
    return await generate(
      `Write a 2-sentence, upbeat monthly recap. Facts: received ${usd(input.receivedUsdMinor)} ` +
        `across ${input.payments} payments; converted ${ngn(input.convertedNgnMinor)}; ` +
        `saved ${ngn(input.savedVsBankMinor)} versus a normal bank. Be warm, not salesy.`,
      { system: SYSTEM, temperature: 0.6 },
    );
  } catch {
    return fallback;
  }
}

/** Narrate an allocation plan in one line for the confirm screen. */
export async function explainAllocation(plan: AllocationPlan): Promise<string> {
  const parts = plan.items.map((i) => `${i.label} ${money(i.amount)}`);
  const fallback = parts.length
    ? `Splitting into ${parts.join(", ")}.`
    : "Nothing to allocate.";
  if (!aiAvailable()) return fallback;
  try {
    return await generate(
      `Summarise this split in one friendly sentence: ${parts.join(", ")}.`,
      { system: SYSTEM, temperature: 0.4 },
    );
  } catch {
    return fallback;
  }
}

// --- tiny formatters (display only) -----------------------------------------
function money(m: { minor: number; currency: string }): string {
  if (m.currency === "USD") return usd(m.minor);
  if (m.currency === "NGN") return ngn(m.minor);
  return `${(m.minor / 100).toLocaleString()} ${m.currency}`;
}
function usd(minor: number): string {
  return `$${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}
function ngn(minor: number): string {
  return `₦${(minor / 100).toLocaleString("en-NG")}`;
}
