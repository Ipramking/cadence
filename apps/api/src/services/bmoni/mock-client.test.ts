import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockBmoniClient } from "./mock-client.js";
import { prisma } from "../../db.js";
import { BmoniError } from "@cadence/shared";

describe("MockBmoniClient", () => {
  const client = new MockBmoniClient();
  let usdWallet1Id: string;
  let usdWallet2Id: string;
  let ngnWalletId: string;

  beforeAll(async () => {
    // Ensure we start with clean wallets for tests (we delete them in afterAll)
  });

  afterAll(async () => {
    // Clean up created test data
    const testWalletIds = [usdWallet1Id, usdWallet2Id, ngnWalletId].filter(Boolean);
    if (testWalletIds.length > 0) {
      await prisma.transaction.deleteMany({
        where: {
          OR: [
            { fromWalletId: { in: testWalletIds } },
            { toWalletId: { in: testWalletIds } },
          ],
        },
      });
      await prisma.wallet.deleteMany({
        where: { id: { in: testWalletIds } },
      });
    }
    await prisma.$disconnect();
  });

  it("should create a sub-wallet and list it", async () => {
    const wallet = await client.createSubWallet({
      name: "Test USD Wallet 1",
      currency: "USD",
      purpose: "salary",
    });

    expect(wallet.id).toBeDefined();
    expect(wallet.name).toBe("Test USD Wallet 1");
    expect(wallet.purpose).toBe("salary");
    expect(wallet.currency).toBe("USD");
    expect(wallet.balance.minor).toBe(0);

    usdWallet1Id = wallet.id;

    const wallets = await client.listWallets();
    const found = wallets.find((w) => w.id === usdWallet1Id);
    expect(found).toBeDefined();
  });

  it("should get wallet balance", async () => {
    const balance = await client.getBalance(usdWallet1Id);
    expect(balance.minor).toBe(0);
    expect(balance.currency).toBe("USD");
  });

  it("should throw error when getting balance of non-existent wallet", async () => {
    await expect(client.getBalance("non-existent-id")).rejects.toThrow(
      new BmoniError("Wallet not found", "WALLET_NOT_FOUND")
    );
  });

  it("should convert currency atomically between wallets", async () => {
    // 1. Create target NGN wallet
    const ngnWallet = await client.createSubWallet({
      name: "Test NGN Wallet",
      currency: "NGN",
      purpose: "family",
    });
    ngnWalletId = ngnWallet.id;

    // 2. Set balance of source USD wallet to $10.00 (1000 cents)
    await prisma.wallet.update({
      where: { id: usdWallet1Id },
      data: { balanceMinor: 1000 },
    });

    // 3. Convert $5.00 (500 cents) to NGN (rate is 1500 NGN/USD -> 750,000 NGN kobo)
    const tx = await client.convert({
      amount: { minor: 500, currency: "USD" },
      to: "NGN",
      fromWalletId: usdWallet1Id,
      toWalletId: ngnWalletId,
    });

    expect(tx.id).toBeDefined();
    expect(tx.type).toBe("conversion");
    expect(tx.status).toBe("settled");
    expect(tx.amount.minor).toBe(500);
    expect(tx.amount.currency).toBe("USD");
    expect(tx.fromWalletId).toBe(usdWallet1Id);
    expect(tx.toWalletId).toBe(ngnWalletId);
    expect(tx.metadata).toBeDefined();
    expect(tx.metadata?.rate).toBe(1500);
    expect(tx.metadata?.receivesMinor).toBe(750000);

    // 4. Verify balances
    const usdBalance = await client.getBalance(usdWallet1Id);
    expect(usdBalance.minor).toBe(500); // 1000 - 500

    const ngnBalance = await client.getBalance(ngnWalletId);
    expect(ngnBalance.minor).toBe(750000); // 0 + 750,000
  });

  it("should throw error on conversion with insufficient balance", async () => {
    await expect(
      client.convert({
        amount: { minor: 1000, currency: "USD" },
        to: "NGN",
        fromWalletId: usdWallet1Id,
        toWalletId: ngnWalletId,
      })
    ).rejects.toThrow(
      new BmoniError("Insufficient balance in source wallet", "INSUFFICIENT_BALANCE")
    );
  });

  it("should transfer money internally between same-currency wallets", async () => {
    // 1. Create second USD wallet
    const usdWallet2 = await client.createSubWallet({
      name: "Test USD Wallet 2",
      currency: "USD",
      purpose: "goal",
    });
    usdWallet2Id = usdWallet2.id;

    // 2. Transfer $2.00 (200 cents) from wallet 1 to wallet 2
    const tx = await client.transfer({
      amount: { minor: 200, currency: "USD" },
      fromWalletId: usdWallet1Id,
      toWalletId: usdWallet2Id,
    });

    expect(tx.id).toBeDefined();
    expect(tx.type).toBe("transfer");
    expect(tx.status).toBe("settled");
    expect(tx.amount.minor).toBe(200);
    expect(tx.amount.currency).toBe("USD");
    expect(tx.fromWalletId).toBe(usdWallet1Id);
    expect(tx.toWalletId).toBe(usdWallet2Id);

    // 3. Verify balances
    const usdBalance1 = await client.getBalance(usdWallet1Id);
    expect(usdBalance1.minor).toBe(300); // 500 - 200

    const usdBalance2 = await client.getBalance(usdWallet2Id);
    expect(usdBalance2.minor).toBe(200); // 0 + 200
  });

  it("should payout money to a recipient ref", async () => {
    // 1. Payout $1.00 (100 cents) to a recipient reference
    const tx = await client.transfer({
      amount: { minor: 100, currency: "USD" },
      fromWalletId: usdWallet1Id,
      recipientRef: "payout-ref-unique-123",
    });

    expect(tx.id).toBeDefined();
    expect(tx.type).toBe("payout");
    expect(tx.status).toBe("settled");
    expect(tx.amount.minor).toBe(100);
    expect(tx.amount.currency).toBe("USD");
    expect(tx.fromWalletId).toBe(usdWallet1Id);
    expect(tx.toWalletId).toBeUndefined();
    expect(tx.counterparty).toBe("payout-ref-unique-123");

    // 2. Verify balance
    const usdBalance1 = await client.getBalance(usdWallet1Id);
    expect(usdBalance1.minor).toBe(200); // 300 - 100
  });
});
