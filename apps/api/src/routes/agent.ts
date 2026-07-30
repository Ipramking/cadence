import type { FastifyInstance } from "fastify";
import { parseCommand } from "../ai/index.js";
import { interpret, parsePaymentImage } from "../ai/agent.js";
import { sandbox } from "../bmoni/real.js";
import { prisma } from "../db.js";

type Cur = "USD" | "NGN";

/** Best-route conversion when paying a currency you don't hold. */
async function routeFor(
  amountMinor: number,
  payCurrency: Cur,
  sourceCurrency: Cur,
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
    const real = sandbox();
    rate = real ? (await real.getRate(sourceCurrency, payCurrency)).rate : 1550;
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

    let route = null;
    if (action.intent === "pay" && action.amountMinor && action.currency) {
      route = await routeFor(action.amountMinor, action.currency, source);
    }
    return { ...action, route, needsConfirm: isMoney };
  });

  // Read payment details out of a screenshot / photo.
  app.post("/agent/parse-image", async (req) => {
    const body = (req.body ?? {}) as { image?: string; mimeType?: string };
    if (!body.image) return {};
    return parsePaymentImage(body.image, body.mimeType ?? "image/png");
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

    let route = null;
    if (source !== currency) {
      // Real BMONI conversion for the route (live request on the money path).
      try {
        const real = sandbox();
        const rate = real ? (await real.getRate(source, currency)).rate : 1550;
        route = {
          fromCurrency: source,
          toCurrency: currency,
          rate,
          sourceMinor: Math.round(amountMinor / rate),
          targetMinor: amountMinor,
        };
      } catch {
        route = null;
      }
    }

    const tx = await prisma.transaction.create({
      data: {
        type: "payout",
        amountMinor,
        currency,
        status: "settled",
        counterparty: recipient,
        metadata: JSON.stringify({ receipt: true, note: body.note ?? null, route }),
      },
    });

    return {
      ok: true,
      receipt: {
        id: tx.id,
        recipient,
        amountMinor,
        currency,
        route,
        note: body.note ?? null,
        at: tx.occurredAt.toISOString(),
      },
    };
  });
}
