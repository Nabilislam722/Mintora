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
const ve = { address: VE_HEMI_CONTRACT, abi: [...VE_HEMI_ABI, ...MARKET_ERRORS] };
const OFFER_DATA = parseAbiParameters("address buyer, uint256 offerId, uint16 maxFeeBps");
const seconds = (days) => BigInt(days * 86400);

// Wallet actions for the veHEMI market, each resolving once its transaction is confirmed
export function useVeHemiActions() {
  const { address, chainId } = useAccount();
  const config = useConfig();
  const client = usePublicClient({ chainId: hemi.id });
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  async function send(request) {
    if (chainId !== hemi.id) await switchChainAsync({ chainId: hemi.id });
    await client.simulateContract({ ...request, account: address });
    const hash = await writeContractAsync({ ...request, chainId: hemi.id });
    const receipt = await waitForTransactionReceipt(config, { hash, chainId: hemi.id });
    if (receipt.status !== "success") throw new Error("The transaction failed on-chain.");
    return receipt;
  }

  return {
    // Refetches positions, listings, offers and balances after a trade
    refresh: () =>
      queryClient.invalidateQueries({
        predicate: ({ queryKey: [key] }) => ["vehemi", "readContract", "readContracts", "balance"].includes(key),
      }),
    // Sets the market's HEMI approval to exactly `amountWei`
    approveHemi: (token, amountWei) =>
      send({ address: token, abi: [...erc20Abi, ...MARKET_ERRORS], functionName: "approve", args: [VE_HEMI_MARKET, amountWei] }),
    approvePosition: (tokenId) => send({ ...ve, functionName: "approve", args: [VE_HEMI_MARKET, tokenId] }),
    // Whether the market is approved for the position, read fresh
    isMarketApproved: async (tokenId) =>
      sameAddress(await client.readContract({ ...ve, functionName: "getApproved", args: [tokenId] }), VE_HEMI_MARKET),
    list: async (tokenId, priceWei, days) => {
      const lock = await client.readContract({ ...ve, functionName: "getLockedBalance", args: [tokenId] });
      const locked = lock.amount > 0n ? lock.amount : 0n;
      return send({ ...market, functionName: "list", args: [tokenId, priceWei, seconds(days), maxLockAmountFor(locked)] });
    },
    buy: (listing) => send({ ...market, functionName: "buy", args: [listing.tokenId, listing.listingId] }),
    cancelListing: (tokenId) => send({ ...market, functionName: "cancelListing", args: [tokenId] }),
    makeOffer: (tokenId, amountWei, days) => send({ ...market, functionName: "makeOffer", args: [tokenId, amountWei, seconds(days)] }),
    cancelOffer: (tokenId) => send({ ...market, functionName: "cancelOffer", args: [tokenId] }),
    // Accepts an offer by sending the position to the market with the offer attached
    acceptOffer: async (offer, maxFeeBps) => {
      try {
        return await send({
          ...ve,
          functionName: "safeTransferFrom",
          args: [address, VE_HEMI_MARKET, offer.tokenId, encodeAbiParameters(OFFER_DATA, [offer.buyer, offer.offerId, maxFeeBps])],
        });
      } catch (error) {
        if (isHemiShortfall(error)) {
          throw new Error("The buyer no longer has enough HEMI in their wallet, or approved, to cover this offer. Your position hasn't moved.");
        }
        throw error;
      }
    },
  };
}

// Runs one wallet step at a time and toasts the reason if it fails; resolves to true on success
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
