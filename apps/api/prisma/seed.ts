import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding...");

  // 1. Clear existing database for idempotency
  await prisma.transaction.deleteMany();
  await prisma.allocationRule.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.wallet.deleteMany();

  console.log("Existing data cleared.");

  // 2. Create Wallets
  const mainWallet = await prisma.wallet.create({
    data: {
      name: "Main USD Wallet",
      purpose: "main",
      currency: "USD",
      balanceMinor: 5230000, // Sum of all seeded inflows (in cents)
    },
  });

  const salaryWallet = await prisma.wallet.create({
    data: {
      name: "Salary Wallet",
      purpose: "salary",
      currency: "USD",
      balanceMinor: 0,
    },
  });

  const familyWallet = await prisma.wallet.create({
    data: {
      name: "Family Support",
      purpose: "family",
      currency: "NGN",
      balanceMinor: 0,
    },
  });

  const goalWallet = await prisma.wallet.create({
    data: {
      name: "Rent Goal Wallet",
      purpose: "goal",
      currency: "USD",
      balanceMinor: 0,
    },
  });

  const hedgeWallet = await prisma.wallet.create({
    data: {
      name: "Devaluation Hedge",
      purpose: "hedge",
      currency: "USDC",
      balanceMinor: 0,
    },
  });

  console.log("Wallets created.");

  // 3. Create Goals
  const rentGoal = await prisma.goal.create({
    data: {
      name: "Rent Savings",
      targetMinor: 200000, // $2,000 USD
      targetCurrency: "USD",
      savedMinor: 0,
      savedCurrency: "USD",
      deadline: new Date("2026-12-31T23:59:59Z"),
    },
  });

  console.log("Goals created.");

  // 4. Create Allocation Rules
  await prisma.allocationRule.create({
    data: {
      kind: "salary",
      label: "Steady Monthly Salary Allocation",
      percentage: 50.0,
      targetCurrency: "USD",
      priority: 1,
      enabled: true,
    },
  });

  await prisma.allocationRule.create({
    data: {
      kind: "goal",
      label: "Rent Savings Goal",
      percentage: 20.0,
      targetCurrency: "USD",
      goalId: rentGoal.id,
      priority: 2,
      enabled: true,
    },
  });

  await prisma.allocationRule.create({
    data: {
      kind: "family",
      label: "Family Support Remittance",
      percentage: 15.0,
      targetCurrency: "NGN",
      priority: 3,
      enabled: true,
    },
  });

  await prisma.allocationRule.create({
    data: {
      kind: "hedge",
      label: "Stablecoin Devaluation Hedge",
      percentage: 15.0,
      targetCurrency: "USDC",
      priority: 4,
      enabled: true,
    },
  });

  console.log("Allocation rules created.");

  // 5. Generate and Insert Inflows
  const inflows = [];

  // Acme Corp regular: Friday 14:00 weekly ($1,500)
  const acmeFridays = [
    "2026-05-01T14:00:00Z",
    "2026-05-08T14:00:00Z",
    "2026-05-15T14:00:00Z",
    "2026-05-22T14:00:00Z",
    "2026-05-29T14:00:00Z",
    "2026-06-05T14:00:00Z",
    "2026-06-12T14:00:00Z",
    "2026-06-19T14:00:00Z",
    "2026-06-26T14:00:00Z",
    "2026-07-03T14:00:00Z",
    "2026-07-10T14:00:00Z",
    "2026-07-24T14:00:00Z", // Skip 17th since it's the overpayment anomaly
  ];

  for (const date of acmeFridays) {
    inflows.push({
      type: "inflow",
      amountMinor: 150000, // $1,500
      currency: "USD",
      status: "settled",
      counterparty: "Acme Corp",
      occurredAt: new Date(date),
      toWalletId: mainWallet.id,
    });
  }

  // Stark Industries regular: Tuesday 11:00 bi-weekly ($2,200)
  const starkTuesdays = [
    "2026-05-05T11:00:00Z",
    "2026-05-19T11:00:00Z",
    "2026-06-02T11:00:00Z",
    "2026-06-16T11:00:00Z",
    "2026-06-30T11:00:00Z",
    "2026-07-14T11:00:00Z",
    "2026-07-28T11:00:00Z",
  ];

  for (const date of starkTuesdays) {
    inflows.push({
      type: "inflow",
      amountMinor: 220000, // $2,200
      currency: "USD",
      status: "settled",
      counterparty: "Stark Industries",
      occurredAt: new Date(date),
      toWalletId: mainWallet.id,
    });
  }

  // GigaSpace regular: First Monday 13:00 monthly ($800)
  const gigaMondays = [
    "2026-05-04T13:00:00Z",
    "2026-06-01T13:00:00Z",
    "2026-07-06T13:00:00Z",
  ];

  for (const date of gigaMondays) {
    inflows.push({
      type: "inflow",
      amountMinor: 80000, // $800
      currency: "USD",
      status: "settled",
      counterparty: "GigaSpace",
      occurredAt: new Date(date),
      toWalletId: mainWallet.id,
    });
  }

  // Anomalous inflows:
  // Anomaly 1: Odd hour inflow (3:15 AM)
  inflows.push({
    type: "inflow",
    amountMinor: 150000, // $1,500
    currency: "USD",
    status: "settled",
    counterparty: "Acme Corp",
    occurredAt: new Date("2026-06-10T03:15:00Z"),
    toWalletId: mainWallet.id,
  });

  // Anomaly 2: Unknown payer ($5,000)
  inflows.push({
    type: "inflow",
    amountMinor: 500000, // $5,000
    currency: "USD",
    status: "settled",
    counterparty: "Unknown LLC",
    occurredAt: new Date("2026-06-23T20:00:00Z"),
    toWalletId: mainWallet.id,
  });

  // Anomaly 3: Round-number overpayment ($10,000)
  inflows.push({
    type: "inflow",
    amountMinor: 1000000, // $10,000
    currency: "USD",
    status: "settled",
    counterparty: "Acme Corp",
    occurredAt: new Date("2026-07-17T14:00:00Z"),
    toWalletId: mainWallet.id,
  });

  // Insert all inflows
  for (const inflow of inflows) {
    await prisma.transaction.create({
      data: inflow,
    });
  }

  console.log(`Seeded ${inflows.length} transactions successfully.`);
  console.log("Database seeding completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
