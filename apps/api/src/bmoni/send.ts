import { bmoniFetch } from "./http.js";
import { ownerContext, type OwnerContext } from "./real.js";

interface SendResponse {
  data: {
    signatureRequest: {
      method: "evm" | "solana";
      walletIndex: number;
      workflowId: string;
      hashToSign: string;
      payload: string;
      deadline: string;
    };
    // Some responses also carry the created proposal id — captured defensively.
    proposalId?: string;
    proposal?: { id?: string };
  };
}

/**
 * Real BMONI send: moves USDB out of the funded wallet (delivered as CNGN),
 * signing the returned proposal hash with the provisioned owner key.
 *
 * Flow: POST account/send -> sign hashToSign with owner key -> POST proposals/:id/sign.
 * The raw send response is returned so the exact proposal-id path can be
 * confirmed against a funded wallet (the send endpoint 404s until funded).
 */
export async function liveSend(
  amountUsd: number,
  ownerArg?: OwnerContext | null,
): Promise<{
  ok: boolean;
  step: string;
  sendResponse?: unknown;
  signResponse?: unknown;
  error?: string;
}> {
  const owner = ownerArg ?? ownerContext();
  if (!owner) return { ok: false, step: "owner", error: "no provisioned owner" };

  // Wallet id from the file when present, otherwise fetched from BMONI (hosting).
  let usdbId = owner.wallets.find((w) => w.currency === "USDB")?.id;
  if (!usdbId) {
    const wallets = await bmoniFetch<{ id: string; currency: string }[]>(
      `/v1/users/${owner.userId}/smart-wallets/account/wallets`,
    );
    usdbId = wallets.find((w) => w.currency === "USD" || w.currency === "USDB")?.id;
  }
  if (!usdbId) return { ok: false, step: "wallet", error: "no USDB wallet" };

  // 1. Request the send (creates a proposal + returns a hash to sign).
  let send: SendResponse;
  try {
    send = await bmoniFetch<SendResponse>(
      `/v1/users/${owner.userId}/smart-wallets/account/send`,
      {
        method: "POST",
        body: {
          fromWalletId: usdbId,
          amount: String(amountUsd),
          note: "Cadence live send",
          expectedTargetCurrency: "CNGN",
        },
      },
    );
  } catch (e) {
    return { ok: false, step: "send", error: (e as Error).message };
  }

  const sr = send.data?.signatureRequest;
  const proposalId = send.data?.proposalId ?? send.data?.proposal?.id ?? sr?.workflowId;
  if (!sr?.hashToSign || !proposalId) {
    return { ok: false, step: "parse", sendResponse: send, error: "missing hash or proposal id" };
  }

  // 2. Sign the proposal hash with the owner key (raw ECDSA over the hash).
  const signature = await owner.account.sign({
    hash: sr.hashToSign as `0x${string}`,
  });

  // 3. Submit the signature to approve the proposal.
  try {
    const signed = await bmoniFetch(
      `/v1/users/${owner.userId}/smart-wallets/proposals/${proposalId}/sign`,
      { method: "POST", body: { signature } },
    );
    return { ok: true, step: "done", sendResponse: send, signResponse: signed };
  } catch (e) {
    return { ok: false, step: "sign", sendResponse: send, error: (e as Error).message };
  }
}
