import { Currency, Money, ConversionQuote, ConversionPath } from "@cadence/shared";
import { bmoniClient } from "./bmoni/provider.js";

/**
 * Gets the direct exchange rate between two currencies from the active BmoniClient.
 */
export async function getRate(from: Currency, to: Currency): Promise<number> {
  if (from === to) return 1.0;
  const rateRes = await bmoniClient.getRate(from, to);
  return rateRes.rate;
}

/**
 * Generates the best ConversionQuote by comparing the direct and stablecoin-bridge paths.
 */
export async function quoteConversion(amount: Money, to: Currency): Promise<ConversionQuote> {
  const from = amount.currency;

  // 1. If currencies are identical, return a trivial 1:1 quote
  if (from === to) {
    return {
      from,
      to,
      amount,
      rate: 1.0,
      path: "direct",
      receives: { minor: amount.minor, currency: to },
      bankReceives: { minor: amount.minor, currency: to },
      savedVsBank: { minor: 0, currency: to },
    };
  }

  let directRate: number | null = null;
  let bridgeRate: number | null = null;

  // 2. Calculate direct path rate
  try {
    directRate = await getRate(from, to);
  } catch (err) {
    // Direct path unavailable
  }

  // 3. Calculate stablecoin bridge path rate (from -> USDC -> to)
  // Skip bridge if from or to is already USDC
  if (from !== "USDC" && to !== "USDC") {
    try {
      const rateToUsdc = await getRate(from, "USDC");
      const rateFromUsdc = await getRate("USDC", to);
      bridgeRate = rateToUsdc * rateFromUsdc;
    } catch (err) {
      // Bridge path unavailable
    }
  }

  // 4. Select the best path
  let selectedRate: number;
  let selectedPath: ConversionPath;

  if (directRate !== null && bridgeRate !== null) {
    // We select the path that gives a higher rate (which means more receives)
    if (bridgeRate > directRate) {
      selectedRate = bridgeRate;
      selectedPath = "stablecoin-bridge";
    } else {
      selectedRate = directRate;
      selectedPath = "direct";
    }
  } else if (directRate !== null) {
    selectedRate = directRate;
    selectedPath = "direct";
  } else if (bridgeRate !== null) {
    selectedRate = bridgeRate;
    selectedPath = "stablecoin-bridge";
  } else {
    throw new Error(`No conversion path available from ${from} to ${to}`);
  }

  // 5. Calculate payout amounts
  const receivesMinor = Math.round(amount.minor * selectedRate);
  
  // Typical bank offers 4% worse exchange rate (0.96 of the mid-market/best rate)
  const bankRate = selectedRate * 0.96;
  const bankReceivesMinor = Math.round(amount.minor * bankRate);
  const savedVsBankMinor = receivesMinor - bankReceivesMinor;

  return {
    from,
    to,
    amount,
    rate: selectedRate,
    path: selectedPath,
    receives: { minor: receivesMinor, currency: to },
    bankReceives: { minor: bankReceivesMinor, currency: to },
    savedVsBank: { minor: savedVsBankMinor, currency: to },
  };
}
