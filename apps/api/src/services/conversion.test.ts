import { beforeAll, describe, expect, it } from "vitest";
import { initBmoniClient } from "./bmoni/provider.js";
import { getRate, quoteConversion } from "./conversion.js";

describe("ConversionService", () => {
  beforeAll(() => {
    // Set environment variable to use mock provider and initialize the client
    process.env.BMONI_PROVIDER = "mock";
    initBmoniClient();
  });

  describe("getRate", () => {
    it("should return 1.0 for identical currencies", async () => {
      const rate = await getRate("USD", "USD");
      expect(rate).toBe(1.0);
    });

    it("should return the correct direct rate from the mock client", async () => {
      const rate = await getRate("USD", "NGN");
      expect(rate).toBe(1500);
    });
  });

  describe("quoteConversion", () => {
    it("should return a trivial 1:1 quote for identical currencies", async () => {
      const amount = { minor: 1000, currency: "USD" as const };
      const quote = await quoteConversion(amount, "USD");

      expect(quote.from).toBe("USD");
      expect(quote.to).toBe("USD");
      expect(quote.rate).toBe(1.0);
      expect(quote.path).toBe("direct");
      expect(quote.receives.minor).toBe(1000);
      expect(quote.bankReceives.minor).toBe(1000);
      expect(quote.savedVsBank.minor).toBe(0);
    });

    it("should select the direct path for USD to NGN", async () => {
      // Direct rate is 1500. Bridge (USD -> USDC -> NGN) is 1.0 * 1490 = 1490.
      // So direct path (1500) is better.
      const amount = { minor: 100, currency: "USD" as const }; // $1.00
      const quote = await quoteConversion(amount, "NGN");

      expect(quote.from).toBe("USD");
      expect(quote.to).toBe("NGN");
      expect(quote.rate).toBe(1500);
      expect(quote.path).toBe("direct");
      
      // 100 cents * 1500 = 150,000 NGN kobo
      expect(quote.receives.minor).toBe(150000);
      
      // Bank rate is 1500 * 0.96 = 1440. Bank receives 100 * 1440 = 144000
      expect(quote.bankReceives.minor).toBe(144000);
      
      // Savings is 150000 - 144000 = 6000 kobo (60 NGN)
      expect(quote.savedVsBank.minor).toBe(6000);
    });

    it("should select the stablecoin-bridge path for NGN to USD", async () => {
      // Direct rate: NGN -> USD = 1/1500 = 0.00066667
      // Bridge: NGN -> USDC -> USD = (1/1490) * 1.0 = 0.00067114
      // So bridge path is better.
      const amount = { minor: 150000, currency: "NGN" as const }; // 1500 NGN
      const quote = await quoteConversion(amount, "USD");

      expect(quote.from).toBe("NGN");
      expect(quote.to).toBe("USD");
      expect(quote.rate).toBeCloseTo(1 / 1490, 8);
      expect(quote.path).toBe("stablecoin-bridge");

      // receives = Math.round(150000 * (1/1490)) = 101 cents ($1.01)
      expect(quote.receives.minor).toBe(101);

      // bank rate = (1/1490) * 0.96 = 0.000644295
      // bank receives = Math.round(150000 * bankRate) = 97 cents ($0.97)
      expect(quote.bankReceives.minor).toBe(97);

      // savings = 101 - 97 = 4 cents
      expect(quote.savedVsBank.minor).toBe(4);
    });

    it("should calculate correctly when one of the legs is USDC", async () => {
      // USD to USDC -> Direct path (rate 1.0). Bridge is skipped since to is USDC.
      const amount = { minor: 500, currency: "USD" as const };
      const quote = await quoteConversion(amount, "USDC");

      expect(quote.from).toBe("USD");
      expect(quote.to).toBe("USDC");
      expect(quote.rate).toBe(1.0);
      expect(quote.path).toBe("direct");
      expect(quote.receives.minor).toBe(500);
      expect(quote.bankReceives.minor).toBe(480); // 500 * 0.96
      expect(quote.savedVsBank.minor).toBe(20);  // 500 - 480
    });
  });
});
