import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db.js";
import { assessInflowRisk } from "./fraud.js";

describe("FraudService", { timeout: 30000 }, () => {
  let normalTxId: string;
  let oddHourTxId: string;
  let unknownPayerTxId: string;
  let overpaymentTxId: string;

  beforeAll(async () => {
    // Clear test DB
    await prisma.transaction.deleteMany({});
    await prisma.wallet.deleteMany({});

    // Create a dummy wallet to receive inflows
    const wallet = await prisma.wallet.create({
      data: {
        name: "Main USD Wallet",
        purpose: "main",
        currency: "USD",
        balanceMinor: 0,
      },
    });

    // 1. Seed normal transaction history
    // Acme Corp: 10 settled weekly inflows of $1,500.00 (150,000 cents) at 2:00 PM
    for (let i = 0; i < 10; i++) {
      const date = new Date("2026-05-01T14:00:00Z");
      date.setUTCDate(date.getUTCDate() + i * 7);

      const tx = await prisma.transaction.create({
        data: {
          type: "inflow",
          amountMinor: 150000,
          currency: "USD",
          status: "settled",
          counterparty: "Acme Corp",
          occurredAt: date,
          toWalletId: wallet.id,
        },
      });
      normalTxId = tx.id; // Keep the last normal one as reference
    }

    // Stark Industries: 5 settled bi-weekly inflows of $2,200.00 (220,000 cents) at 11:00 AM
    for (let i = 0; i < 5; i++) {
      const date = new Date("2026-05-05T11:00:00Z");
      date.setUTCDate(date.getUTCDate() + i * 14);

      await prisma.transaction.create({
        data: {
          type: "inflow",
          amountMinor: 220000,
          currency: "USD",
          status: "settled",
          counterparty: "Stark Industries",
          occurredAt: date,
          toWalletId: wallet.id,
        },
      });
    }

    // 2. Seed the 3 anomalous inflows (T1 anomalies)
    // Anomaly 1: Odd hour (3:15 AM)
    const oddHourTx = await prisma.transaction.create({
      data: {
        type: "inflow",
        amountMinor: 150000,
        currency: "USD",
        status: "settled",
        counterparty: "Acme Corp",
        occurredAt: new Date("2026-06-10T03:15:00Z"),
        toWalletId: wallet.id,
      },
    });
    oddHourTxId = oddHourTx.id;

    // Anomaly 2: Unknown payer ($5,000)
    const unknownPayerTx = await prisma.transaction.create({
      data: {
        type: "inflow",
        amountMinor: 500000,
        currency: "USD",
        status: "settled",
        counterparty: "Unknown LLC",
        occurredAt: new Date("2026-06-23T20:00:00Z"),
        toWalletId: wallet.id,
      },
    });
    unknownPayerTxId = unknownPayerTx.id;

    // Anomaly 3: Overpayment ($10,000)
    const overpaymentTx = await prisma.transaction.create({
      data: {
        type: "inflow",
        amountMinor: 1000000,
        currency: "USD",
        status: "settled",
        counterparty: "Acme Corp",
        occurredAt: new Date("2026-07-17T14:00:00Z"),
        toWalletId: wallet.id,
      },
    });
    overpaymentTxId = overpaymentTx.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should score a normal transaction as clear", async () => {
    const assessment = await assessInflowRisk(normalTxId);

    expect(assessment.transactionId).toBe(normalTxId);
    expect(assessment.level).toBe("clear");
    expect(assessment.score).toBeLessThan(30);
    expect(assessment.reasons).toHaveLength(0);
  });

  it("should score the odd-hour anomaly as watch", async () => {
    const assessment = await assessInflowRisk(oddHourTxId);

    expect(assessment.transactionId).toBe(oddHourTxId);
    expect(assessment.level).toBe("watch");
    expect(assessment.score).toBe(30); // 30 for unusual hour
    expect(assessment.reasons).toContain("Transaction occurred at an unusual hour (03:15 UTC).");
  });

  it("should score the unknown-payer anomaly as high and flag it in the DB", async () => {
    const assessment = await assessInflowRisk(unknownPayerTxId);

    expect(assessment.transactionId).toBe(unknownPayerTxId);
    expect(assessment.level).toBe("high");
    expect(assessment.score).toBeGreaterThanOrEqual(70); // 40 for unknown + 30 for first-time large amount
    expect(assessment.reasons).toContain('Counterparty "Unknown LLC" is new or unknown.');
    const hasAverageReason = assessment.reasons.some((r) =>
      r.startsWith("First-time transaction amount ($5000.00) is significantly larger than the overall historical average")
    );
    expect(hasAverageReason).toBe(true);

    // Verify transaction status was updated in DB
    const tx = await prisma.transaction.findUnique({
      where: { id: unknownPayerTxId },
    });
    expect(tx?.status).toBe("flagged");
  });

  it("should score the overpayment anomaly as high and flag it in the DB", async () => {
    const assessment = await assessInflowRisk(overpaymentTxId);

    expect(assessment.transactionId).toBe(overpaymentTxId);
    expect(assessment.level).toBe("high");
    expect(assessment.score).toBe(60); // 60 for >5x amount deviation
    expect(assessment.reasons).toContain(
      "Transaction amount ($10000.00) is extreme (more than 5x the average of $1500.00 for Acme Corp)."
    );

    // Verify transaction status was updated in DB
    const tx = await prisma.transaction.findUnique({
      where: { id: overpaymentTxId },
    });
    expect(tx?.status).toBe("flagged");
  });
});
