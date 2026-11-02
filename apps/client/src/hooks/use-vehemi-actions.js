import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { encodeAbiParameters, erc20Abi, parseAbiParameters } from "viem";
import { useAccount, useConfig, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useToast } from "@/hooks/use-toast";
import { hemi } from "@/lib/hemi";
import { MARKET_ABI, MARKET_ERRORS, VE_HEMI_ABI } from "@/lib/vehemi-abi";
import { VE_HEMI_CONTRACT, VE_HEMI_MARKET, isHemiShortfall, maxLockAmountFor, sameAddress, txErrorMessage } from "@/lib/vehemi";

const market = { address: VE_HEMI_MARKET, abi: MARKET_ABI };
// When veHEMI hands a position to the market, the market's errors bubble up through veHEMI, so decode them too
const ve = { address: VE_HEMI_CONTRACT, abi: [...VE_HEMI_ABI, ...MARKET_ERRORS] };
const OFFER_DATA = parseAbiParameters("address buyer, uint256 offerId, uint16 maxFeeBps");
const seconds = (days) => BigInt(days * 86400);

// Wallet actions for the veHEMI market. Each one resolves once its transaction is confirmed.
export function useVeHemiActions() {
  const { address, chainId } = useAccount();
  const config = useConfig();
  const client = usePublicClient({ chainId: hemi.id });
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  async function send(request) {
    if (chainId !== hemi.id) await switchChainAsync({ chainId: hemi.id });
    // Simulate first, so a call that would revert shows its reason instead of costing gas. Wallets don't
    // reliably report the contract's error, and some let the user send a transaction that will fail.
    await client.simulateContract({ ...request, account: address });
    const hash = await writeContractAsync({ ...request, chainId: hemi.id });
    const receipt = await waitForTransactionReceipt(config, { hash, chainId: hemi.id });
    if (receipt.status !== "success") throw new Error("The transaction failed on-chain.");
    return receipt;
  }

  return {
    // Positions, listings, offers and balances can all change after a trade
    refresh: () =>
      queryClient.invalidateQueries({
        predicate: ({ queryKey: [key] }) => ["vehemi", "readContract", "readContracts", "balance"].includes(key),
      }),
    // Sets the market's approval for its payment token (from useHemiFunds) to exactly `amountWei`
    approveHemi: (token, amountWei) =>
      send({ address: token, abi: [...erc20Abi, ...MARKET_ERRORS], functionName: "approve", args: [VE_HEMI_MARKET, amountWei] }),
    approvePosition: (tokenId) => send({ ...ve, functionName: "approve", args: [VE_HEMI_MARKET, tokenId] }),
    // Read fresh after a listing confirms: an approval still in place makes the new listing live straight away
    isMarketApproved: async (tokenId) =>
      sameAddress(await client.readContract({ ...ve, functionName: "getApproved", args: [tokenId] }), VE_HEMI_MARKET),
    list: async (tokenId, priceWei, days) => {
      // The limit on top-ups starts from the lock as it is now, not as the page loaded it
      const lock = await client.readContract({ ...ve, functionName: "getLockedBalance", args: [tokenId] });
      const locked = lock.amount > 0n ? lock.amount : 0n;
      return send({ ...market, functionName: "list", args: [tokenId, priceWei, seconds(days), maxLockAmountFor(locked)] });
    },
    buy: (listing) => send({ ...market, functionName: "buy", args: [listing.tokenId, listing.listingId] }),
    cancelListing: (tokenId) => send({ ...market, functionName: "cancelListing", args: [tokenId] }),
    makeOffer: (tokenId, amountWei, days) => send({ ...market, functionName: "makeOffer", args: [tokenId, amountWei, seconds(days)] }),
    cancelOffer: (tokenId) => send({ ...market, functionName: "cancelOffer", args: [tokenId] }),
    // Sending the position to the market with the offer attached accepts it, so no approval is needed
    acceptOffer: async (offer, maxFeeBps) => {
      try {
        return await send({
          ...ve,
          functionName: "safeTransferFrom",
          args: [address, VE_HEMI_MARKET, offer.tokenId, encodeAbiParameters(OFFER_DATA, [offer.buyer, offer.offerId, maxFeeBps])],
        });
      } catch (error) {
        // Offers aren't escrowed, and it's the buyer's HEMI that couldn't be pulled: don't tell the holder
        // "you don't have enough HEMI". Nothing moved; the position is still theirs.
        if (isHemiShortfall(error)) {
          throw new Error("The buyer no longer has enough HEMI in their wallet, or approved, to cover this offer. Your position hasn't moved.");
        }
        throw error;
      }
    },
  };
}

// Runs one wallet step at a time: tracks `busy`, and shows a toast with the reason if the step fails.
// `run` resolves to true when the step succeeded.
export function useTxStep() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  async function run(action, failTitle = "Transaction failed") {
    setBusy(true);
    try {
      await action();
      return true;
    } catch (error) {
      toast({ title: failTitle, description: txErrorMessage(error), variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}
