import {
  AllocationPlan,
  AllocationItem,
  Transaction,
  Money,
  RuleKind,
  Currency,
  TransactionType,
  TransactionStatus,
} from "@cadence/shared";
import { prisma } from "../db.js";
import { quoteConversion } from "./conversion.js";
import { bmoniClient } from "./bmoni/provider.js";

/**
 * Produces an AllocationPlan for an inflow transaction based on enabled rules.
 */
export async function producePlan(inflow: Transaction): Promise<AllocationPlan> {
  const rules = await prisma.allocationRule.findMany({
    where: { enabled: true },
    orderBy: { priority: "asc" },
  });

  const items: AllocationItem[] = [];
  let totalAllocatedMinor = 0;

  for (const rule of rules) {
    const sliceMinor = Math.round(inflow.amount.minor * (rule.percentage / 100));
    if (sliceMinor <= 0) continue;

    const targetCurrency = (rule.targetCurrency || inflow.amount.currency) as Currency;

    // Find the target sub-wallet matching the rule kind and currency
    const targetWallet = await prisma.wallet.findFirst({
      where: {
        purpose: rule.kind,
        currency: targetCurrency,
      },
    });

    if (!targetWallet) {
      throw new Error(`Target sub-wallet not found for rule ${rule.label} (${rule.kind}, ${targetCurrency})`);
    }

    let quote;
    if (targetCurrency !== inflow.amount.currency) {
      quote = await quoteConversion(
        { minor: sliceMinor, currency: inflow.amount.currency as Currency },
        targetCurrency
      );
    }

    items.push({
      ruleId: rule.id,
      label: rule.label,
      kind: rule.kind as RuleKind,
      amount: { minor: sliceMinor, currency: inflow.amount.currency as Currency },
      targetWalletId: targetWallet.id,
      quote,
    });

    totalAllocatedMinor += sliceMinor;
  }

  const remainderMinor = inflow.amount.minor - totalAllocatedMinor;
  const remainder: Money = {
    minor: Math.max(0, remainderMinor),
    currency: inflow.amount.currency as Currency,
  };

  return {
    inflowId: inflow.id,
    items,
    remainder,
  };
}

/**
 * Executes an AllocationPlan idempotently.
 */
export async function executePlan(plan: AllocationPlan): Promise<Transaction[]> {
  // 1. Find main wallets representing the actual balances on the provider
  const sourceMainWallet = await prisma.wallet.findFirst({
    where: { purpose: "main", currency: "USD" },
  });
  const ngnMainWallet = await prisma.wallet.findFirst({
    where: { purpose: "main", currency: "NGN" },
  });
  const usdcMainWallet = await prisma.wallet.findFirst({
    where: { purpose: "main", currency: "USDC" },
  });

  if (!sourceMainWallet || !ngnMainWallet || !usdcMainWallet) {
    throw new Error("Main wallets for USD, NGN, or USDC are not initialized in the database.");
  }

  // 2. Scan existing transactions to identify already-executed rules for this inflow
  const allTxs = await prisma.transaction.findMany({
    where: { metadata: { not: null } },
  });

  const executedRules = new Set<string>();
  const executedTransactions: Transaction[] = [];

  for (const tx of allTxs) {
    if (tx.metadata) {
      try {
        const meta = JSON.parse(tx.metadata as string);
        if (meta.inflowId === plan.inflowId && meta.ruleId) {
          executedRules.add(meta.ruleId);
          executedTransactions.push(mapTransaction(tx));
        }
      } catch (err) {
        // Ignore malformed JSON
      }
    }
  }

  // 3. Process plan items
  for (const item of plan.items) {
    if (executedRules.has(item.ruleId)) {
      continue; // Skip already executed items
    }

    const targetWallet = await prisma.wallet.findUnique({
      where: { id: item.targetWalletId },
    });
    if (!targetWallet) {
      throw new Error(`Target wallet ${item.targetWalletId} not found.`);
    }

    const targetCurrency = targetWallet.currency as Currency;

    if (item.kind === "family") {
      // Family support leaves the account (NGN payout)
      // First, convert USD to NGN main wallet on Bmoni
      const convTx = await bmoniClient.convert({
        amount: item.amount,
        to: "NGN",
        fromWalletId: sourceMainWallet.id,
        toWalletId: ngnMainWallet.id,
      });

      // Retrieve the converted NGN amount
      const meta = convTx.metadata as Record<string, any>;
      const receivesMinor = meta?.receivesMinor as number;

      // Make the actual payout transfer (leaves the account)
      const payoutTx = await bmoniClient.transfer({
        amount: { minor: receivesMinor, currency: "NGN" },
        fromWalletId: ngnMainWallet.id,
        recipientRef: "family-bank-account",
      });

      // Update metadata on conversion and payout transactions to link them to the inflow rule
      const updatedConv = await prisma.transaction.update({
        where: { id: convTx.id },
        data: {
          metadata: JSON.stringify({
            ...meta,
            inflowId: plan.inflowId,
            ruleId: item.ruleId,
          }),
        },
      });

      const updatedPayout = await prisma.transaction.update({
        where: { id: payoutTx.id },
        data: {
          metadata: JSON.stringify({
            ...payoutTx.metadata,
            inflowId: plan.inflowId,
            ruleId: item.ruleId,
            payout: true,
          }),
        },
      });

      executedTransactions.push(mapTransaction(updatedConv));
      executedTransactions.push(mapTransaction(updatedPayout));

    } else if (item.quote) {
      // Conversion to Goal or Hedge virtual envelope
      // 1. Perform Bmoni conversion on the provider between main wallets
      const targetMainWalletId = targetCurrency === "USDC" ? usdcMainWallet.id : ngnMainWallet.id;
      const convTx = await bmoniClient.convert({
        amount: item.amount,
        to: targetCurrency,
        fromWalletId: sourceMainWallet.id,
        toWalletId: targetMainWalletId,
      });

      const meta = convTx.metadata as Record<string, any>;
      const receivesMinor = meta?.receivesMinor as number;

      // 2. Perform DB-only update allocating funds from the main target wallet to the virtual envelope wallet
      await prisma.$transaction([
        prisma.wallet.update({
          where: { id: targetMainWalletId },
          data: { balanceMinor: { decrement: receivesMinor } },
        }),
        prisma.wallet.update({
          where: { id: item.targetWalletId },
          data: { balanceMinor: { increment: receivesMinor } },
        }),
        prisma.transaction.update({
          where: { id: convTx.id },
          data: {
            metadata: JSON.stringify({
              ...meta,
              inflowId: plan.inflowId,
              ruleId: item.ruleId,
            }),
          },
        }),
      ]);

      const updatedConv: Transaction = {
        ...convTx,
        metadata: {
          ...meta,
          inflowId: plan.inflowId,
          ruleId: item.ruleId,
        },
      };

      executedTransactions.push(updatedConv);

    } else {
      // Pure logical allocation (USD Salary or USD Goal envelope)
      // Perform DB-only update moving funds from USD main wallet to USD sub-wallet
      const allocTx = await prisma.$transaction(async (txDb) => {
        await txDb.wallet.update({
          where: { id: sourceMainWallet.id },
          data: { balanceMinor: { decrement: item.amount.minor } },
        });
        await txDb.wallet.update({
          where: { id: item.targetWalletId },
          data: { balanceMinor: { increment: item.amount.minor } },
        });
        return txDb.transaction.create({
          data: {
            type: "allocation",
            amountMinor: item.amount.minor,
            currency: item.amount.currency,
            status: "settled",
            fromWalletId: sourceMainWallet.id,
            toWalletId: item.targetWalletId,
            metadata: JSON.stringify({
              inflowId: plan.inflowId,
              ruleId: item.ruleId,
              label: item.label,
            }),
          },
        });
      });

      executedTransactions.push(mapTransaction(allocTx));
    }
  }

  return executedTransactions;
}

function mapTransaction(tx: any): Transaction {
  return {
    id: tx.id,
    type: tx.type as TransactionType,
    amount: {
      minor: tx.amountMinor,
      currency: tx.currency as Currency,
    },
    status: tx.status as TransactionStatus,
    counterparty: tx.counterparty || undefined,
    occurredAt: tx.occurredAt.toISOString(),
    fromWalletId: tx.fromWalletId || undefined,
    toWalletId: tx.toWalletId || undefined,
    metadata: tx.metadata ? (JSON.parse(tx.metadata as string) as Record<string, unknown>) : undefined,
  };
}
