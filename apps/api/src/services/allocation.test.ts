import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initBmoniClient } from "./bmoni/provider.js";
import { prisma } from "../db.js";
import { producePlan, executePlan } from "./allocation.js";
import { Transaction, Currency, TransactionType, TransactionStatus } from "@cadence/shared";

describe("AllocationEngine", { timeout: 30000 }, () => {
  let mainUsdId: string;
  let mainNgnId: string;
  let mainUsdcId: string;
  let salaryUsdId: string;
  let goalNgnId: string;
  let familyNgnId: string;
  let hedgeUsdcId: string;

  let salaryRuleId: string;
  let goalRuleId: string;
  let familyRuleId: string;
  let hedgeRuleId: string;

  beforeAll(async () => {
    process.env.BMONI_PROVIDER = "mock";
    initBmoniClient();

    // Clear test database
    await prisma.transaction.deleteMany({});
    await prisma.allocationRule.deleteMany({});
    await prisma.goal.deleteMany({});
    await prisma.wallet.deleteMany({});

    // Create Main Currency Wallets on Bmoni
    const mUsd = await prisma.wallet.create({
      data: { name: "Main USD Wallet", purpose: "main", currency: "USD", balanceMinor: 100000 }, // $1,000.00
    });
    mainUsdId = mUsd.id;

    const mNgn = await prisma.wallet.create({
      data: { name: "Main NGN Wallet", purpose: "main", currency: "NGN", balanceMinor: 0 },
    });
    mainNgnId = mNgn.id;

    const mUsdc = await prisma.wallet.create({
      data: { name: "Main USDC Wallet", purpose: "main", currency: "USDC", balanceMinor: 0 },
    });
    mainUsdcId = mUsdc.id;

    // Create Virtual Envelope Sub-Wallets
    const sUsd = await prisma.wallet.create({
      data: { name: "Salary Wallet", purpose: "salary", currency: "USD", balanceMinor: 0 },
    });
    salaryUsdId = sUsd.id;

    const gNgn = await prisma.wallet.create({
      data: { name: "Goal NGN Wallet", purpose: "goal", currency: "NGN", balanceMinor: 0 },
    });
    goalNgnId = gNgn.id;

    const fNgn = await prisma.wallet.create({
      data: { name: "Family Support Wallet", purpose: "family", currency: "NGN", balanceMinor: 0 },
    });
    familyNgnId = fNgn.id;

    const hUsdc = await prisma.wallet.create({
      data: { name: "Hedge USDC Wallet", purpose: "hedge", currency: "USDC", balanceMinor: 0 },
    });
    hedgeUsdcId = hUsdc.id;

    // Create a target goal
    const rentGoal = await prisma.goal.create({
      data: {
        name: "Rent Savings",
        targetMinor: 200000,
        targetCurrency: "NGN",
        savedMinor: 0,
        savedCurrency: "NGN",
      },
    });

    // Create Rules
    const rSalary = await prisma.allocationRule.create({
      data: { kind: "salary", label: "Monthly Salary Support", percentage: 50.0, targetCurrency: "USD", priority: 1, enabled: true },
    });
    salaryRuleId = rSalary.id;

    const rGoal = await prisma.allocationRule.create({
      data: { kind: "goal", label: "Goal NGN Savings", percentage: 20.0, targetCurrency: "NGN", goalId: rentGoal.id, priority: 2, enabled: true },
    });
    goalRuleId = rGoal.id;

    const rFamily = await prisma.allocationRule.create({
      data: { kind: "family", label: "Family Remittance", percentage: 15.0, targetCurrency: "NGN", priority: 3, enabled: true },
    });
    familyRuleId = rFamily.id;

    const rHedge = await prisma.allocationRule.create({
      data: { kind: "hedge", label: "Stablecoin Hedge", percentage: 15.0, targetCurrency: "USDC", priority: 4, enabled: true },
    });
    hedgeRuleId = rHedge.id;
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("producePlan", () => {
    it("should produce a correct AllocationPlan representing rules and remainders", async () => {
      const inflow: Transaction = {
        id: "test-inflow-123",
        type: "inflow",
        amount: { minor: 100000, currency: "USD" }, // $1,000.00
        status: "settled",
        occurredAt: new Date().toISOString(),
        toWalletId: mainUsdId,
      };

      const plan = await producePlan(inflow);

      expect(plan.inflowId).toBe(inflow.id);
      expect(plan.remainder.minor).toBe(0); // 50% + 20% + 15% + 15% = 100% allocated
      expect(plan.items).toHaveLength(4);

      // Verify Salary item (USD to USD)
      const salaryItem = plan.items.find((i) => i.kind === "salary");
      expect(salaryItem).toBeDefined();
      expect(salaryItem?.amount.minor).toBe(50000);
      expect(salaryItem?.targetWalletId).toBe(salaryUsdId);
      expect(salaryItem?.quote).toBeUndefined();

      // Verify Goal item (USD to NGN, expects quote)
      const goalItem = plan.items.find((i) => i.kind === "goal");
      expect(goalItem).toBeDefined();
      expect(goalItem?.amount.minor).toBe(20000);
      expect(goalItem?.targetWalletId).toBe(goalNgnId);
      expect(goalItem?.quote).toBeDefined();
      expect(goalItem?.quote?.rate).toBe(1500);

      // Verify Family item (USD to NGN, expects quote)
      const familyItem = plan.items.find((i) => i.kind === "family");
      expect(familyItem).toBeDefined();
      expect(familyItem?.amount.minor).toBe(15000);
      expect(familyItem?.targetWalletId).toBe(familyNgnId);
      expect(familyItem?.quote).toBeDefined();
      expect(familyItem?.quote?.rate).toBe(1500);

      // Verify Hedge item (USD to USDC, expects quote)
      const hedgeItem = plan.items.find((i) => i.kind === "hedge");
      expect(hedgeItem).toBeDefined();
      expect(hedgeItem?.amount.minor).toBe(15000);
      expect(hedgeItem?.targetWalletId).toBe(hedgeUsdcId);
      expect(hedgeItem?.quote).toBeDefined();
      expect(hedgeItem?.quote?.rate).toBe(1.0);
    });
  });

  describe("executePlan", () => {
    it("should execute plan items and update DB and Bmoni balances correctly", async () => {
      const inflow: Transaction = {
        id: "test-inflow-execute-1",
        type: "inflow",
        amount: { minor: 100000, currency: "USD" }, // $1,000.00
        status: "settled",
        occurredAt: new Date().toISOString(),
        toWalletId: mainUsdId,
      };

      const plan = await producePlan(inflow);
      const txs = await executePlan(plan);

      // Conversions: Goal (1 tx), Family (1 tx conv, 1 tx payout), Hedge (1 tx conv)
      // Allocations: Salary (1 tx)
      // Total txs created / returned: 5
      expect(txs).toHaveLength(5);

      // 1. Verify Virtual sub-wallet balances in our DB
      const sWallet = await prisma.wallet.findUnique({ where: { id: salaryUsdId } });
      expect(sWallet?.balanceMinor).toBe(50000); // 50% = $500.00 (50,000 cents)

      const gWallet = await prisma.wallet.findUnique({ where: { id: goalNgnId } });
      expect(gWallet?.balanceMinor).toBe(20000 * 1500); // 20% = $200.00 * 1500 = 300,000 NGN kobo

      const hWallet = await prisma.wallet.findUnique({ where: { id: hedgeUsdcId } });
      expect(hWallet?.balanceMinor).toBe(15000 * 1.0); // 15% = $150.00 * 1.0 = 15,000 USDC cents

      const fWallet = await prisma.wallet.findUnique({ where: { id: familyNgnId } });
      expect(fWallet?.balanceMinor).toBe(0); // Family remittance leaves the account immediately (0 balance)

      // 2. Verify Main Wallets representing Bmoni provider balances
      const mUsd = await prisma.wallet.findUnique({ where: { id: mainUsdId } });
      // USD balance: Started with 100,000.
      // Salary logical allocation: deducted 50,000 USD.
      // Goal conversion: converted 20,000 USD to NGN.
      // Family conversion: converted 15,000 USD to NGN.
      // Hedge conversion: converted 15,000 USD to USDC.
      // Remaining USD balance = 100,000 - 50,000 - 20,000 - 15,000 - 15,000 = 0.
      expect(mUsd?.balanceMinor).toBe(0);

      const mNgn = await prisma.wallet.findUnique({ where: { id: mainNgnId } });
      // NGN balance:
      // Goal conversion: +30,000,000 NGN kobo. Logical move to Goal NGN wallet: -30,000,000. (Remaining 0).
      // Family conversion: +22,500,000 NGN kobo. Payout transfer out: -22,500,000. (Remaining 0).
      // Total main NGN balance = 0.
      expect(mNgn?.balanceMinor).toBe(0);

      const mUsdc = await prisma.wallet.findUnique({ where: { id: mainUsdcId } });
      // USDC balance:
      // Hedge conversion: +15,000 USDC cents. Logical move to Hedge USDC wallet: -15,000. (Remaining 0).
      // Total main USDC balance = 0.
      expect(mUsdc?.balanceMinor).toBe(0);
    });

    it("should be fully idempotent when running execution again", async () => {
      const inflow: Transaction = {
        id: "test-inflow-execute-1", // same inflow ID as previous test
        type: "inflow",
        amount: { minor: 100000, currency: "USD" },
        status: "settled",
        occurredAt: new Date().toISOString(),
        toWalletId: mainUsdId,
      };

      const plan = await producePlan(inflow);
      
      // Before execution, check current balances
      const sWalletBefore = await prisma.wallet.findUnique({ where: { id: salaryUsdId } });
      const gWalletBefore = await prisma.wallet.findUnique({ where: { id: goalNgnId } });
      const hWalletBefore = await prisma.wallet.findUnique({ where: { id: hedgeUsdcId } });
      const mUsdBefore = await prisma.wallet.findUnique({ where: { id: mainUsdId } });

      const txs = await executePlan(plan);

      // Since all rules were already executed for "test-inflow-execute-1", it should return them from DB without executing again
      expect(txs).toHaveLength(5);

      // Verify that balances have NOT changed
      const sWalletAfter = await prisma.wallet.findUnique({ where: { id: salaryUsdId } });
      expect(sWalletAfter?.balanceMinor).toBe(sWalletBefore?.balanceMinor);

      const gWalletAfter = await prisma.wallet.findUnique({ where: { id: goalNgnId } });
      expect(gWalletAfter?.balanceMinor).toBe(gWalletBefore?.balanceMinor);

      const hWalletAfter = await prisma.wallet.findUnique({ where: { id: hedgeUsdcId } });
      expect(hWalletAfter?.balanceMinor).toBe(hWalletBefore?.balanceMinor);

      const mUsdAfter = await prisma.wallet.findUnique({ where: { id: mainUsdId } });
      expect(mUsdAfter?.balanceMinor).toBe(mUsdBefore?.balanceMinor);
    });
  });
});
