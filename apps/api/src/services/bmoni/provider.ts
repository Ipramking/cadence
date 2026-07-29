import { BmoniClient } from "@cadence/shared";
import { MockBmoniClient } from "./mock-client.js";
import { SandboxBmoniClient } from "../../bmoni/sandbox.js";

export let bmoniClient: BmoniClient;

export function initBmoniClient() {
  const provider = process.env.BMONI_PROVIDER || "mock";
  if (provider === "mock") {
    bmoniClient = new MockBmoniClient();
  } else if (provider === "sandbox") {
    const userId = process.env.BMONI_USER_ID;
    if (!userId) {
      throw new Error("BMONI_USER_ID is required when BMONI_PROVIDER=sandbox");
    }
    bmoniClient = new SandboxBmoniClient(userId);
  } else {
    throw new Error(`Unsupported BMONI_PROVIDER: ${provider}`);
  }
}
