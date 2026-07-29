import {
  BmoniClient,
  BmoniError,
  Currency,
  FxRate,
  Money,
  SubWallet,
  Transaction,
  TransactionStatus,
  TransactionType,
  WalletPurpose,
} from "@cadence/shared";
import { prisma } from "../../db.js";

const MOCK_RATES: Record<string, number> = {
  "USD_NGN": 1500,
  "NGN_USD": 1 / 1500,
  "USDC_NGN": 1490,
  "NGN_USDC": 1 / 1490,
  "USD_USDC": 1.0,
  "USDC_USD": 1.0,
  "USDC_USDC": 1.0,
  "USD_USD": 1.0,
  "NGN_NGN": 1.0,
};

export class MockBmoniClient implements BmoniClient {
  async getBalance(walletId: string): Promise<Money> {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) {
      throw new BmoniError("Wallet not found", "WALLET_NOT_FOUND");
    }
    return {
      minor: wallet.balanceMinor,
      currency: wallet.currency as Currency,
    };
  }

  async listWallets(): Promise<SubWallet[]> {
    const wallets = await prisma.wallet.findMany();
    return wallets.map((w) => ({
      id: w.id,
      name: w.name,
      purpose: w.purpose as WalletPurpose,
      currency: w.currency as Currency,
      balance: {
        minor: w.balanceMinor,
        currency: w.currency as Currency,
      },
      createdAt: w.createdAt.toISOString(),
    }));
  }

  async createSubWallet(input: {
    name: string;
    currency: Currency;
    purpose: SubWallet["purpose"];
  }): Promise<SubWallet> {
    const wallet = await prisma.wallet.create({
      data: {
        name: input.name,
        purpose: input.purpose,
        currency: input.currency,
        balanceMinor: 0,
      },
    });
    return {
      id: wallet.id,
      name: wallet.name,
      purpose: wallet.purpose as WalletPurpose,
      currency: wallet.currency as Currency,
      balance: {
        minor: wallet.balanceMinor,
        currency: wallet.currency as Currency,
      },
      createdAt: wallet.createdAt.toISOString(),
    };
  }

  async listTransactions(params?: {
    limit?: number;
    since?: string;
    walletId?: string;
  }): Promise<Transaction[]> {
    const where: any = {};
    if (params?.walletId) {
      where.OR = [
        { fromWalletId: params.walletId },
        { toWalletId: params.walletId },
      ];
    }
    if (params?.since) {
      where.occurredAt = {
        gte: new Date(params.since),
      };
    }

    const txs = await prisma.transaction.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: params?.limit,
    });

    return txs.map((tx) => ({
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
    }));
  }

  async getRate(from: Currency, to: Currency): Promise<FxRate> {
    const pair = `${from}_${to}`;
    const rate = MOCK_RATES[pair];
    if (rate === undefined) {
      throw new BmoniError(`Unsupported currency pair ${pair}`, "UNSUPPORTED_CURRENCY_PAIR");
    }
    return {
      from,
      to,
      rate,
      asOf: new Date().toISOString(),
    };
  }

  async convert(input: {
    amount: Money;
    to: Currency;
    fromWalletId?: string;
    toWalletId?: string;
  }): Promise<Transaction> {
    const rateRes = await this.getRate(input.amount.currency, input.to);
    const rate = rateRes.rate;
    const receivesMinor = Math.round(input.amount.minor * rate);

    if (input.fromWalletId) {
      const fromWallet = await prisma.wallet.findUnique({
        where: { id: input.fromWalletId },
      });
      if (!fromWallet) {
        throw new BmoniError("Source wallet not found", "WALLET_NOT_FOUND");
      }
      if (fromWallet.currency !== input.amount.currency) {
        throw new BmoniError("Source wallet currency mismatch", "CURRENCY_MISMATCH");
      }
      if (fromWallet.balanceMinor < input.amount.minor) {
        throw new BmoniError("Insufficient balance in source wallet", "INSUFFICIENT_BALANCE");
      }
    }

    if (input.toWalletId) {
      const toWallet = await prisma.wallet.findUnique({
        where: { id: input.toWalletId },
      });
      if (!toWallet) {
        throw new BmoniError("Target wallet not found", "WALLET_NOT_FOUND");
      }
      if (toWallet.currency !== input.to) {
        throw new BmoniError("Target wallet currency mismatch", "CURRENCY_MISMATCH");
      }
    }

    const createdTx = await prisma.$transaction(async (txDb) => {
      if (input.fromWalletId) {
        await txDb.wallet.update({
          where: { id: input.fromWalletId },
          data: { balanceMinor: { decrement: input.amount.minor } },
        });
      }
      if (input.toWalletId) {
        await txDb.wallet.update({
          where: { id: input.toWalletId },
          data: { balanceMinor: { increment: receivesMinor } },
        });
      }

      const metadataObj = {
        rate,
        receivesMinor,
        receivesCurrency: input.to,
      };

      return txDb.transaction.create({
        data: {
          type: "conversion",
          amountMinor: input.amount.minor,
          currency: input.amount.currency,
          status: "settled",
          fromWalletId: input.fromWalletId,
          toWalletId: input.toWalletId,
          metadata: JSON.stringify(metadataObj),
        },
      });
    });

    return {
      id: createdTx.id,
      type: createdTx.type as TransactionType,
      amount: {
        minor: createdTx.amountMinor,
        currency: createdTx.currency as Currency,
      },
      status: createdTx.status as TransactionStatus,
      counterparty: createdTx.counterparty || undefined,
      occurredAt: createdTx.occurredAt.toISOString(),
      fromWalletId: createdTx.fromWalletId || undefined,
      toWalletId: createdTx.toWalletId || undefined,
      metadata: createdTx.metadata ? (JSON.parse(createdTx.metadata as string) as Record<string, unknown>) : undefined,
    };
  }

  async transfer(input: {
    amount: Money;
    fromWalletId: string;
    toWalletId?: string;
    recipientRef?: string;
  }): Promise<Transaction> {
    const fromWallet = await prisma.wallet.findUnique({
      where: { id: input.fromWalletId },
    });
    if (!fromWallet) {
      throw new BmoniError("Source wallet not found", "WALLET_NOT_FOUND");
    }
    if (fromWallet.currency !== input.amount.currency) {
      throw new BmoniError("Source wallet currency mismatch", "CURRENCY_MISMATCH");
    }
    if (fromWallet.balanceMinor < input.amount.minor) {
      throw new BmoniError("Insufficient balance in source wallet", "INSUFFICIENT_BALANCE");
    }

    if (input.toWalletId) {
      const toWallet = await prisma.wallet.findUnique({
        where: { id: input.toWalletId },
      });
      if (!toWallet) {
        throw new BmoniError("Target wallet not found", "WALLET_NOT_FOUND");
      }
      if (toWallet.currency !== input.amount.currency) {
        throw new BmoniError("Transfer must be in same currency", "CURRENCY_MISMATCH");
      }

      const createdTx = await prisma.$transaction(async (txDb) => {
        await txDb.wallet.update({
          where: { id: input.fromWalletId },
          data: { balanceMinor: { decrement: input.amount.minor } },
        });
        await txDb.wallet.update({
          where: { id: input.toWalletId },
          data: { balanceMinor: { increment: input.amount.minor } },
        });
        return txDb.transaction.create({
          data: {
            type: "transfer",
            amountMinor: input.amount.minor,
            currency: input.amount.currency,
            status: "settled",
            fromWalletId: input.fromWalletId,
            toWalletId: input.toWalletId,
          },
        });
      });

      return {
        id: createdTx.id,
        type: createdTx.type as TransactionType,
        amount: {
          minor: createdTx.amountMinor,
          currency: createdTx.currency as Currency,
        },
        status: createdTx.status as TransactionStatus,
        occurredAt: createdTx.occurredAt.toISOString(),
        fromWalletId: createdTx.fromWalletId || undefined,
        toWalletId: createdTx.toWalletId || undefined,
      };
    } else if (input.recipientRef) {
      const createdTx = await prisma.$transaction(async (txDb) => {
        await txDb.wallet.update({
          where: { id: input.fromWalletId },
          data: { balanceMinor: { decrement: input.amount.minor } },
        });
        return txDb.transaction.create({
          data: {
            type: "payout",
            amountMinor: input.amount.minor,
            currency: input.amount.currency,
            status: "settled",
            fromWalletId: input.fromWalletId,
            counterparty: input.recipientRef,
          },
        });
      });

      return {
        id: createdTx.id,
        type: createdTx.type as TransactionType,
        amount: {
          minor: createdTx.amountMinor,
          currency: createdTx.currency as Currency,
        },
        status: createdTx.status as TransactionStatus,
        counterparty: createdTx.counterparty || undefined,
        occurredAt: createdTx.occurredAt.toISOString(),
        fromWalletId: createdTx.fromWalletId || undefined,
      };
    } else {
      throw new BmoniError("Must provide either target wallet or recipient ref", "INVALID_OPERATION");
    }
  }
}
