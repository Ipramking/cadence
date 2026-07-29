import "dotenv/config";
import { prisma } from "../db.js";
import { assessInflowRisk } from "../services/fraud.js";

/**
 * Runs the fraud service over every seeded inflow, flagging high-risk ones and
 * recording each risk level on the transaction so the activity feed can show
 * it. Run after seeding: `npx tsx src/scripts/assess.ts`.
 */
const inflows = await prisma.transaction.findMany({
  where: { type: "inflow" },
  orderBy: { occurredAt: "asc" },
});

let high = 0;
let watch = 0;

for (const inf of inflows) {
  const assessment = await assessInflowRisk(inf.id);
  if (assessment.level === "high") high++;
  if (assessment.level === "watch") watch++;

  const existing = inf.metadata ? JSON.parse(inf.metadata) : {};
  await prisma.transaction.update({
    where: { id: inf.id },
    data: {
      metadata: JSON.stringify({
        ...existing,
        risk: assessment.level,
        riskReasons: assessment.reasons,
      }),
    },
  });

  if (assessment.level !== "clear") {
    console.log(
      `${assessment.level.toUpperCase()}: ${inf.counterparty ?? "unknown"} $${(inf.amountMinor / 100).toLocaleString()} — ${assessment.reasons[0] ?? ""}`,
    );
  }
}

console.log(`\nAssessed ${inflows.length} inflows — ${high} high, ${watch} watch.`);
await prisma.$disconnect();
