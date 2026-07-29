import { RiskAssessment, RiskLevel } from "@cadence/shared";
import { prisma } from "../db.js";

/**
 * Assesses the risk of an incoming USD inflow against historical transactions.
 */
export async function assessInflowRisk(inflowId: string): Promise<RiskAssessment> {
  const inflow = await prisma.transaction.findUnique({
    where: { id: inflowId },
  });

  if (!inflow) {
    throw new Error(`Inflow transaction not found: ${inflowId}`);
  }

  if (inflow.type !== "inflow") {
    throw new Error(`Transaction ${inflowId} is not an inflow.`);
  }

  // Fetch past settled inflows that occurred before this transaction
  const history = await prisma.transaction.findMany({
    where: {
      type: "inflow",
      status: "settled",
      occurredAt: { lt: inflow.occurredAt },
      id: { not: inflowId },
    },
  });

  let score = 0;
  const reasons: string[] = [];

  const counterparty = inflow.counterparty || "Unknown";

  if (history.length > 0) {
    // 1. Check Counterparty Profile
    const knownCounterparties = new Set(
      history.map((tx) => tx.counterparty).filter(Boolean)
    );

    if (!knownCounterparties.has(counterparty)) {
      score += 40;
      reasons.push(`Counterparty "${counterparty}" is new or unknown.`);
    }

    // 2. Check Amount Profile
    const counterpartyHistory = history.filter((tx) => tx.counterparty === counterparty);
    if (counterpartyHistory.length > 0) {
      const sum = counterpartyHistory.reduce((acc, tx) => acc + tx.amountMinor, 0);
      const avg = sum / counterpartyHistory.length;

      if (inflow.amountMinor > avg * 5) {
        score += 60;
        reasons.push(
          `Transaction amount ($${(inflow.amountMinor / 100).toFixed(2)}) is extreme (more than 5x the average of $${(avg / 100).toFixed(2)} for ${counterparty}).`
        );
      } else if (inflow.amountMinor > avg * 3) {
        score += 50;
        reasons.push(
          `Transaction amount ($${(inflow.amountMinor / 100).toFixed(2)}) is significantly larger than the average of $${(avg / 100).toFixed(2)} for ${counterparty}.`
        );
      } else if (inflow.amountMinor > avg * 1.5) {
        score += 20;
        reasons.push(
          `Transaction amount ($${(inflow.amountMinor / 100).toFixed(2)}) is higher than the average of $${(avg / 100).toFixed(2)} for ${counterparty}.`
        );
      }
    } else {
      // New counterparty: Compare against overall historical average
      const overallSum = history.reduce((acc, tx) => acc + tx.amountMinor, 0);
      const overallAvg = overallSum / history.length;

      if (inflow.amountMinor > overallAvg * 2.5) {
        score += 30;
        reasons.push(
          `First-time transaction amount ($${(inflow.amountMinor / 100).toFixed(2)}) is significantly larger than the overall historical average ($${(overallAvg / 100).toFixed(2)}).`
        );
      }
    }
  }

  // 3. Check Hour Profile (UTC night-time: 23:00 to 05:00)
  const hour = new Date(inflow.occurredAt).getUTCHours();
  const minutes = new Date(inflow.occurredAt).getUTCMinutes().toString().padStart(2, "0");
  if (hour >= 23 || hour < 5) {
    score += 30;
    reasons.push(
      `Transaction occurred at an unusual hour (${hour.toString().padStart(2, "0")}:${minutes} UTC).`
    );
  }

  // Determine Risk Level
  let level: RiskLevel = "clear";
  if (score >= 60) {
    level = "high";
  } else if (score >= 30) {
    level = "watch";
  }

  // Flag transaction in DB if risk is high
  if (level === "high" && inflow.status !== "flagged") {
    await prisma.transaction.update({
      where: { id: inflowId },
      data: { status: "flagged" },
    });
  }

  return {
    transactionId: inflowId,
    level,
    score: Math.min(100, score),
    reasons,
  };
}
