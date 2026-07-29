import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import type { PrivateKeyAccount } from "viem";
import { bmoniFetch } from "./http.js";

/** A provisioned sandbox user with its owner key and currency wallets. */
export interface ProvisionedUser {
  bmoniUserId: string;
  ownerAddress: string;
  /** Throwaway sandbox owner key — never a real-funds key. */
  ownerPrivateKey: string;
  wallets: { currency: WalletCurrency; id: string; address: string }[];
}

type WalletCurrency = "CNGN" | "USDB";

async function createUser(): Promise<string> {
  const n = Math.floor(Math.random() * 1_000_000);
  const res = await bmoniFetch<{ user: { bmoniUserId: string } }>("/v1/users", {
    method: "POST",
    body: {
      firstName: "Ada",
      lastName: "Freelance",
      email: `ada.dev.${n}@example.com`,
      phoneNumber: `+23480${String(10_000_000 + (n % 90_000_000))}`,
    },
  });
  return res.user.bmoniUserId;
}

async function createWallet(
  userId: string,
  currency: WalletCurrency,
  account: PrivateKeyAccount,
): Promise<{ currency: WalletCurrency; id: string; address: string }> {
  const challenge = await bmoniFetch<{ challengeId: string; message: string }>(
    `/v1/users/${userId}/smart-wallets/owner-proof-challenges`,
    { method: "POST", body: { currency, userOwnerAddress: account.address } },
  );
  const ownerProofSignature = await account.signMessage({ message: challenge.message });
  const wallet = await bmoniFetch<{ id: string; walletAddress: string }>(
    `/v1/users/${userId}/smart-wallets/create-managed`,
    {
      method: "POST",
      body: {
        currency,
        userOwnerAddress: account.address,
        ownerProofChallengeId: challenge.challengeId,
        ownerProofSignature,
      },
    },
  );
  return { currency, id: wallet.id, address: wallet.walletAddress };
}

/**
 * Provisions a fresh sandbox user with CNGN + USDB wallets and starts the
 * Nigeria onboarding flow. Returns the identifiers to persist; the app then
 * runs with BMONI_USER_ID pointing at this user.
 */
export async function provisionSandboxUser(): Promise<ProvisionedUser> {
  const bmoniUserId = await createUser();
  const ownerPrivateKey = generatePrivateKey();
  const account = privateKeyToAccount(ownerPrivateKey);

  const cngn = await createWallet(bmoniUserId, "CNGN", account);
  const usdb = await createWallet(bmoniUserId, "USDB", account);

  // Kick off the Nigeria rail (best effort — KYC completion is separate).
  try {
    await bmoniFetch(`/v1/users/${bmoniUserId}/onboarding/start-nigeria`, {
      method: "POST",
      body: { bvn: "22222222222", ngnWalletAddress: cngn.address, ngnWalletIndex: 0 },
    });
  } catch {
    // rail start is not required for reads / conversions
  }

  return {
    bmoniUserId,
    ownerAddress: account.address,
    ownerPrivateKey,
    wallets: [cngn, usdb],
  };
}
