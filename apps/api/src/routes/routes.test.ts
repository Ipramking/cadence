import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../db.js";
import { walletRoutes } from "./wallets.js";
import { transactionRoutes } from "./transactions.js";
import { ruleRoutes } from "./rules.js";
import { goalRoutes } from "./goals.js";
import { inflowRoutes } from "./inflows.js";
import { initBmoniClient } from "../services/bmoni/provider.js";

describe("REST API Routes", { timeout: 30000 }, () => {
  const app = Fastify();
  let mainUsdId: string;
  let mainNgnId: string;
  let mainUsdcId: string;
  let subWalletId: string;

  beforeAll(async () => {
    process.env.BMONI_PROVIDER = "mock";
    initBmoniClient();

    // 1. Build & Register Routes
    await app.register(cors, { origin: true });
    await app.register(walletRoutes, { prefix: "/wallets" });
    await app.register(transactionRoutes, { prefix: "/transactions" });
    await app.register(ruleRoutes, { prefix: "/rules" });
    await app.register(goalRoutes, { prefix: "/goals" });
    await app.register(inflowRoutes, { prefix: "/inflows" });

    await app.ready();

    // 2. Clear Database
    await prisma.transaction.deleteMany({});
    await prisma.allocationRule.deleteMany({});
    await prisma.goal.deleteMany({});
    await prisma.wallet.deleteMany({});

    // 3. Create Main Wallets & sub-wallet
    const usdWallet = await prisma.wallet.create({
      data: { name: "Main USD", purpose: "main", currency: "USD", balanceMinor: 1000000 },
    });
    mainUsdId = usdWallet.id;

    const ngnWallet = await prisma.wallet.create({
      data: { name: "Main NGN", purpose: "main", currency: "NGN", balanceMinor: 0 },
    });
    mainNgnId = ngnWallet.id;

    const usdcWallet = await prisma.wallet.create({
      data: { name: "Main USDC", purpose: "main", currency: "USDC", balanceMinor: 0 },
    });
    mainUsdcId = usdcWallet.id;

    const salaryWallet = await prisma.wallet.create({
      data: { name: "USD Salary", purpose: "salary", currency: "USD", balanceMinor: 0 },
    });
    subWalletId = salaryWallet.id;
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  // --- WALLETS & TRANSACTIONS TESTS ---
  describe("GET /wallets", () => {
    it("should list all wallets", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/wallets/",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toBeInstanceOf(Array);
      expect(body.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("GET /transactions", () => {
    it("should list transactions", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/transactions/",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toBeInstanceOf(Array);
    });
  });

  // --- RULES CRUD TESTS ---
  describe("CRUD /rules", () => {
    let ruleId: string;

    it("should fail to create a rule with invalid payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/rules/",
        payload: {
          kind: "invalid-kind",
          label: "",
          percentage: 150,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Validation Error");
    });

    it("should create an allocation rule", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/rules/",
        payload: {
          kind: "salary",
          label: "Salary Virtual Envelope",
          percentage: 40,
          priority: 1,
          targetCurrency: "USD",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.label).toBe("Salary Virtual Envelope");
      ruleId = body.id;
    });

    it("should get rule by ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/rules/${ruleId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(ruleId);
    });

    it("should update a rule", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/rules/${ruleId}`,
        payload: {
          percentage: 50,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.percentage).toBe(50);
    });

    it("should list all rules ordered by priority", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/rules/",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toBeInstanceOf(Array);
      expect(body[0].id).toBe(ruleId);
    });

    it("should delete a rule", async () => {
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/rules/${ruleId}`,
      });
      expect(deleteResponse.statusCode).toBe(200);

      const getResponse = await app.inject({
        method: "GET",
        url: `/rules/${ruleId}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });
  });

  // --- GOALS CRUD TESTS ---
  describe("CRUD /goals", () => {
    let goalId: string;

    it("should fail to create a goal with invalid payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/goals/",
        payload: {
          name: "",
          targetMinor: -100,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should create a goal", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/goals/",
        payload: {
          name: "Trip to Paris",
          targetMinor: 500000,
          targetCurrency: "USD",
          savedCurrency: "USD",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.name).toBe("Trip to Paris");
      goalId = body.id;
    });

    it("should get goal by ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/goals/${goalId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(goalId);
    });

    it("should update a goal", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/goals/${goalId}`,
        payload: {
          targetMinor: 600000,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.targetMinor).toBe(600000);
    });

    it("should list all goals", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/goals/",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toBeInstanceOf(Array);
    });

    it("should delete a goal", async () => {
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/goals/${goalId}`,
      });
      expect(deleteResponse.statusCode).toBe(200);

      const getResponse = await app.inject({
        method: "GET",
        url: `/goals/${goalId}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });
  });

  // --- INFLOWS SIMULATION & ALLOCATION TESTS ---
  describe("Inflows /simulate & plan / execute", () => {
    let inflowId: string;

    it("should simulate a USD inflow and update wallet balance in DB", async () => {
      const initialWallet = await prisma.wallet.findUnique({ where: { id: mainUsdId } });
      const initialBalance = initialWallet?.balanceMinor || 0;

      const response = await app.inject({
        method: "POST",
        url: "/inflows/simulate",
        payload: {
          amountMinor: 200000,
          currency: "USD",
          counterparty: "Acme Corp",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.amount.minor).toBe(200000);
      inflowId = body.id;

      // Verify wallet balance updated in DB
      const updatedWallet = await prisma.wallet.findUnique({ where: { id: mainUsdId } });
      expect(updatedWallet?.balanceMinor).toBe(initialBalance + 200000);
    });

    it("should perform risk assessment for the simulated inflow", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/inflows/${inflowId}/risk`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.transactionId).toBe(inflowId);
      expect(body.level).toBeDefined();
      expect(body.score).toBeDefined();
      expect(body.reasons).toBeInstanceOf(Array);
    });

    it("should generate an allocation plan for the simulated inflow", async () => {
      // First, create an allocation rule so there are plan items
      await app.inject({
        method: "POST",
        url: "/rules/",
        payload: {
          kind: "salary",
          label: "Salary virtual envelope rule",
          percentage: 50,
          priority: 1,
          targetCurrency: "USD",
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/inflows/${inflowId}/plan`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.inflowId).toBe(inflowId);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items[0].amount.minor).toBe(100000); // 50% of 200000
    });

    it("should execute the plan and return resulting transactions", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/inflows/${inflowId}/execute`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toBeInstanceOf(Array);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0].type).toBe("allocation");
      expect(body[0].amount.minor).toBe(100000);
    });
  });
});
