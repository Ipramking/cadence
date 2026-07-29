import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { assessInflowRisk } from "../services/fraud.js";
import { producePlan, executePlan } from "../services/allocation.js";
import { Currency, TransactionType, TransactionStatus } from "@cadence/shared";

const simulateSchema = z.object({
  amountMinor: z.number().int().min(1),
  currency: z.enum(["USD", "NGN", "USDC"]).optional().default("USD"),
  counterparty: z.string().min(1),
  toWalletId: z.string().uuid().optional(),
});

export async function inflowRoutes(app: FastifyInstance) {
  // POST /inflows/simulate - Simulate a test USD inflow
  app.post("/simulate", async (request, reply) => {
    try {
      const data = simulateSchema.parse(request.body);

      let targetWalletId = data.toWalletId;
      if (!targetWalletId) {
        const mainUsd = await prisma.wallet.findFirst({
          where: { purpose: "main", currency: data.currency },
        });
        if (!mainUsd) {
          return reply.status(400).send({
            error: `Main wallet for currency ${data.currency} not initialized.`,
          });
        }
        targetWalletId = mainUsd.id;
      } else {
        const targetWallet = await prisma.wallet.findUnique({
          where: { id: targetWalletId },
        });
        if (!targetWallet) {
          return reply.status(400).send({ error: `Target wallet ${targetWalletId} not found.` });
        }
      }

      // Create transaction and increment target wallet balance atomically in a prisma transaction
      const transaction = await prisma.$transaction(async (txDb) => {
        await txDb.wallet.update({
          where: { id: targetWalletId },
          data: { balanceMinor: { increment: data.amountMinor } },
        });

        return txDb.transaction.create({
          data: {
            type: "inflow",
            amountMinor: data.amountMinor,
            currency: data.currency,
            status: "settled",
            counterparty: data.counterparty,
            toWalletId: targetWalletId,
            occurredAt: new Date(),
          },
        });
      });

      const responseTx = {
        id: transaction.id,
        type: transaction.type as TransactionType,
        amount: {
          minor: transaction.amountMinor,
          currency: transaction.currency as Currency,
        },
        status: transaction.status as TransactionStatus,
        counterparty: transaction.counterparty || undefined,
        occurredAt: transaction.occurredAt.toISOString(),
        toWalletId: transaction.toWalletId || undefined,
      };

      return reply.status(201).send(responseTx);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: "Validation Error", details: err.errors });
      }
      throw err;
    }
  });

  // GET /inflows/:id/risk - Get risk assessment of an inflow
  app.get("/:id/risk", async (request, reply) => {
    const { id } = request.params as { id: string };
    const inflow = await prisma.transaction.findUnique({
      where: { id },
    });
    if (!inflow) {
      return reply.status(404).send({ error: "Inflow transaction not found." });
    }
    if (inflow.type !== "inflow") {
      return reply.status(400).send({ error: "Transaction is not an inflow." });
    }

    const assessment = await assessInflowRisk(id);
    return assessment;
  });

  // GET /inflows/:id/plan - Produce an allocation plan for an inflow
  app.get("/:id/plan", async (request, reply) => {
    const { id } = request.params as { id: string };
    const inflow = await prisma.transaction.findUnique({
      where: { id },
    });
    if (!inflow) {
      return reply.status(404).send({ error: "Inflow transaction not found." });
    }
    if (inflow.type !== "inflow") {
      return reply.status(400).send({ error: "Transaction is not an inflow." });
    }

    const mappedInflow = {
      id: inflow.id,
      type: inflow.type as TransactionType,
      amount: {
        minor: inflow.amountMinor,
        currency: inflow.currency as Currency,
      },
      status: inflow.status as TransactionStatus,
      counterparty: inflow.counterparty || undefined,
      occurredAt: inflow.occurredAt.toISOString(),
      fromWalletId: inflow.fromWalletId || undefined,
      toWalletId: inflow.toWalletId || undefined,
    };

    const plan = await producePlan(mappedInflow);
    return plan;
  });

  // POST /inflows/:id/execute - Execute an allocation plan for an inflow
  app.post("/:id/execute", async (request, reply) => {
    const { id } = request.params as { id: string };
    const inflow = await prisma.transaction.findUnique({
      where: { id },
    });
    if (!inflow) {
      return reply.status(404).send({ error: "Inflow transaction not found." });
    }
    if (inflow.type !== "inflow") {
      return reply.status(400).send({ error: "Transaction is not an inflow." });
    }

    const mappedInflow = {
      id: inflow.id,
      type: inflow.type as TransactionType,
      amount: {
        minor: inflow.amountMinor,
        currency: inflow.currency as Currency,
      },
      status: inflow.status as TransactionStatus,
      counterparty: inflow.counterparty || undefined,
      occurredAt: inflow.occurredAt.toISOString(),
      fromWalletId: inflow.fromWalletId || undefined,
      toWalletId: inflow.toWalletId || undefined,
    };

    const plan = await producePlan(mappedInflow);
    const txs = await executePlan(plan);
    return txs;
  });
}
