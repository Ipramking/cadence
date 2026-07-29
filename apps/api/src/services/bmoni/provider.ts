import { BmoniClient } from "@cadence/shared";
import { MockBmoniClient } from "./mock-client.js";

export let bmoniClient: BmoniClient;

export function initBmoniClient() {
  const provider = process.env.BMONI_PROVIDER || "mock";
  if (provider === "mock") {
    bmoniClient = new MockBmoniClient();
  } else {
    throw new Error(`Unsupported BMONI_PROVIDER: ${provider}`);
  }
}
