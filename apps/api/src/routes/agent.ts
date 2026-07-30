import type { FastifyInstance } from "fastify";
import { parseCommand } from "../ai/index.js";
import { chatAgent, interpret, parsePaymentImage } from "../ai/agent.js";
import { resolvePayee } from "../directory.js";
import { resolveBmoni, appUserId } from "../userBmoni.js";
import type { SandboxBmoniClient } from "../bmoni/sandbox.js";
import { prisma } from "../db.js";

type Cur = "USD" | "NGN";

/** Best-route conversion when paying a currency you don't hold. */
async function routeFor(
  amountMinor: number,
  payCurrency: Cur,
  sourceCurrency: Cur,
  client?: SandboxBmoniClient | null,
): Promise<null | {
  fromCurrency: Cur;
  toCurrency: Cur;
  rate: number;
  sourceMinor: number;
  targetMinor: number;
}> {
  if (payCurrency === sourceCurrency) return null;
  let rate = 1;
  try {
    rate = client ? (await client.getRate(sourceCurrency, payCurrency)).rate : 1550;
  } catch {
    rate = 1550;
  }
  return {
    fromCurrency: sourceCurrency,
    toCurrency: payCurrency,
    rate,
    sourceMinor: Math.round(amountMinor / rate),
    targetMinor: amountMinor,
  };
}

/** A human-readable destination label for a transaction receipt. */
function describeDestination(
  type: string,
  s: { phone?: string; recipient?: string; bank?: string; accountNumber?: string; provider?: string; meterNumber?: string; smartcard?: string },
): string {
  switch (type) {
    case "airtime":
      return `Airtime · ${s.phone ?? ""}`.trim();
    case "data":
      return `Data · ${s.phone ?? ""}`.trim();
    case "electricity":
      return `Electricity · ${[s.provider, s.meterNumber].filter(Boolean).join(" · ")}`;
    case "cable":
      return `Cable TV · ${[s.provider, s.smartcard].filter(Boolean).join(" · ")}`;
    case "internet":
      return `Internet · ${s.provider ?? s.accountNumber ?? ""}`.trim();
    case "education":
      return `Education · ${s.provider ?? s.accountNumber ?? ""}`.trim();
    case "betting":
      return `Betting · ${[s.provider, s.accountNumber].filter(Boolean).join(" · ")}`;
    case "transfer":
      return `${s.accountNumber ?? ""}${s.bank ? " · " + s.bank : ""}`.trim();
    case "send":
      return s.recipient ?? s.phone ?? "Recipient";
    default:
      return s.recipient ?? s.phone ?? "Payment";
  }
}

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // Legacy simple command (kept for the old dashboard chat bar).
  app.post("/agent/command", async (req) => {
    const body = (req.body ?? {}) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return { action: "unknown", reply: "What would you like to do?" };
    return parseCommand(text);
  });

  // Full agentic interpret + currency routing. Money moves return needsConfirm.
  app.post("/agent/act", async (req) => {
    const body = (req.body ?? {}) as { text?: string; sourceCurrency?: Cur };
    const text = (body.text ?? "").trim();
    const source = body.sourceCurrency ?? "USD";
    if (!text) return { intent: "unknown", reply: "What would you like to do?", needsConfirm: false };

    const action = await interpret(text);
    const isMoney =
      action.serious || ["pay", "convert", "allocate"].includes(action.intent);

    const ctx = await resolveBmoni(req);
    let route = null;
    if (action.intent === "pay" && action.amountMinor && action.currency) {
      route = await routeFor(action.amountMinor, action.currency, source, ctx?.client);
    }
    const payee = action.intent === "pay" && action.recipient ? resolvePayee(action.recipient) : null;
    return { ...action, route, payee, needsConfirm: isMoney };
  });

  // Conversational, context-aware, slot-filling agent (memory + info-gathering).
  app.post("/agent/chat", async (req) => {
    const body = (req.body ?? {}) as {
      messages?: { role: "user" | "agent"; text: string }[];
    };
    const result = await chatAgent(body.messages ?? []);
    const s = result.slots;
    const ctx = await resolveBmoni(req);

    let route = null;
    let payee = null;
    if (result.ready && s.amountMinor) {
      if (result.type === "convert" && s.fromCurrency && s.toCurrency && s.fromCurrency !== s.toCurrency) {
        route = await routeFor(s.amountMinor, s.toCurrency, s.fromCurrency, ctx?.client);
      } else if (s.currency) {
        // send/transfer/bills spend from the USD balance and route to the target currency
        route = await routeFor(s.amountMinor, s.currency, "USD", ctx?.client);
      }
      const rcp = s.recipient ?? s.phone ?? s.accountNumber;
      if ((result.type === "send" || result.type === "transfer") && rcp) {
        payee = resolvePayee(rcp);
      }
    }
    return { ...result, route, payee };
  });

  // Read payment details out of a screenshot / photo.
  app.post("/agent/parse-image", async (req) => {
    const body = (req.body ?? {}) as { image?: string; mimeType?: string };
    if (!body.image) return {};
    return parsePaymentImage(body.image, body.mimeType ?? "image/png");
  });

  // Execute any confirmed transaction (send, transfer, airtime, bills, …).
  app.post("/agent/execute", async (req) => {
    const body = (req.body ?? {}) as {
      type?: string;
      slots?: Record<string, unknown>;
      route?: unknown;
      note?: string;
    };
    const type = body.type ?? "payment";
    const s = (body.slots ?? {}) as {
      amountMinor?: number;
      currency?: Cur;
      phone?: string;
      recipient?: string;
      bank?: string;
      accountNumber?: string;
      provider?: string;
      meterNumber?: string;
      smartcard?: string;
    };
    const amountMinor = s.amountMinor ?? 0;
    const currency = s.currency ?? "NGN";

    const label = describeDestination(type, s);
    const reference = `CDN${Date.now().toString().slice(-10)}`;
    const uid = appUserId(req);
    let id: string;
    let at: string;
    if (uid) {
      const r = await prisma.receipt.create({
        data: {
          userId: uid,
          reference,
          txType: type,
          recipient: label,
          amountMinor,
          currency,
          metadata: JSON.stringify({ route: body.route ?? null, note: body.note ?? null }),
        },
      });
      id = r.id;
      at = r.createdAt.toISOString();
    } else {
      const tx = await prisma.transaction.create({
        data: {
          type: "payout",
          amountMinor,
          currency,
          status: "settled",
          counterparty: label,
          metadata: JSON.stringify({ receipt: true, txType: type, route: body.route ?? null, reference }),
        },
      });
      id = tx.id;
      at = tx.occurredAt.toISOString();
    }

    return {
      ok: true,
      receipt: { id, reference, txType: type, recipient: label, amountMinor, currency, route: body.route ?? null, at },
    };
  });

  // Execute a confirmed payment: route via real BMONI, record a receipt.
  app.post("/agent/pay", async (req) => {
    const body = (req.body ?? {}) as {
      recipient?: string;
      amountMinor?: number;
      currency?: Cur;
      sourceCurrency?: Cur;
      note?: string;
    };
    const { recipient, amountMinor, currency } = body;
    if (!recipient || !amountMinor || !currency) {
      return { ok: false, error: "recipient, amountMinor and currency are required" };
    }
    const source = body.sourceCurrency ?? "USD";

    const ctx = await resolveBmoni(req);
    const route = source !== currency ? await routeFor(amountMinor, currency, source, ctx?.client) : null;
    const reference = `CDN${Date.now().toString().slice(-10)}`;
    const uid = appUserId(req);

    let id: string;
    let at: string;
    if (uid) {
      const r = await prisma.receipt.create({
        data: {
          userId: uid,
          reference,
          txType: "send",
          recipient,
          amountMinor,
          currency,
          metadata: JSON.stringify({ route, note: body.note ?? null }),
        },
      });
      id = r.id;
      at = r.createdAt.toISOString();
    } else {
      const tx = await prisma.transaction.create({
        data: {
          type: "payout",
          amountMinor,
          currency,
          status: "settled",
          counterparty: recipient,
          metadata: JSON.stringify({ receipt: true, note: body.note ?? null, route, reference }),
        },
      });
      id = tx.id;
      at = tx.occurredAt.toISOString();
    }

    return {
      ok: true,
      receipt: { id, reference, recipient, amountMinor, currency, route, note: body.note ?? null, at },
    };
  });
}
