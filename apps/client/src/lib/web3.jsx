import { createContext, useContext } from "react";
import { useAccount, useBalance, useWriteContract, useConfig } from "wagmi";
import { parseEther } from "viem";
import { readContracts, waitForTransactionReceipt } from "@wagmi/core";
import { hemi } from "@/lib/hemi";

export const MARKETPLACE_CONTRACT = "0xf93AF302727E0ef59522Cd9D9Ff19Ba6b5BB7755";
const ERC721_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }]
  },
  { name: "getApproved", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "isApprovedForAll", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ type: "bool" }] },
];
const MARKETPLACE_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }] },
  { name: "listItem", type: "function", stateMutability: "nonpayable", inputs: [{ name: "nftAddress", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "price", type: "uint256" }] },
  { name: "buyItem", type: "function", stateMutability: "payable", inputs: [{ name: "nftAddress", type: "address" }, { name: "tokenId", type: "uint256" }] },
  { name: "cancelListing", type: "function", stateMutability: "nonpayable", inputs: [{ name: "nftAddress", type: "address" }, { name: "tokenId", type: "uint256" }] },
  { name: "updateListing", type: "function", stateMutability: "nonpayable", inputs: [{ name: "nftAddress", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "newPrice", type: "uint256" }] },
  {
    name: "getListing",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "nft", type: "address" }, { name: "tokenId", type: "uint256" }],
    outputs: [{ type: "tuple", components: [{ name: "seller", type: "address" }, { name: "price", type: "uint256" }] }],
  },
];

const sameAddress = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

// The marketplace keeps a listing after its NFT leaves the seller's wallet. If the NFT comes back, that listing
// sells again at its old price as soon as the marketplace is approved for the NFT. These reads find such a
// listing: what the marketplace has stored for the NFT, and whether it may move it (`owner` is the holder).
export const listingStateReads = (nftAddress, tokenId, owner) => [
  { address: MARKETPLACE_CONTRACT, abi: MARKETPLACE_ABI, functionName: "getListing", args: [nftAddress, BigInt(tokenId)], chainId: hemi.id },
  { address: nftAddress, abi: ERC721_ABI, functionName: "getApproved", args: [BigInt(tokenId)], chainId: hemi.id },
  { address: nftAddress, abi: ERC721_ABI, functionName: "isApprovedForAll", args: [owner, MARKETPLACE_CONTRACT], chainId: hemi.id },
];

// From those reads' results: `oldPrice`, the price of a listing `owner` still has stored (0n if none), and
// `approved`, whether the marketplace may move the NFT (so that listing can sell right now)
export function listingState(results, owner) {
  const [listing, approvedFor, approvedForAll] = (results ?? []).map((r) => (r?.status === "success" ? r.result : undefined));
  const mine = !!listing && sameAddress(listing.seller, owner) && listing.price > 0n;
  return {
    oldPrice: mine ? listing.price : 0n,
    approved: sameAddress(approvedFor, MARKETPLACE_CONTRACT) || approvedForAll === true,
  };
}

const Web3Context = createContext();

export function Web3Provider({ children }) {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();

  // Resolves once the transaction is mined; a reverted one throws, so the page never shows a trade that didn't happen
  const executeTx = async (txRequest) => {
    const hash = await writeContractAsync(txRequest);
    const receipt = await waitForTransactionReceipt(config, { hash, confirmations: 1 });
    if (receipt.status !== "success") throw new Error("The transaction failed on-chain.");
    return receipt;
  };


  async function approveNft(nftAddress, tokenId) {
    return executeTx({
      address: nftAddress,
      abi: ERC721_ABI,
      functionName: "approve",
      args: [MARKETPLACE_CONTRACT, BigInt(tokenId)],
    });
  }

  // Lists an NFT so that an old listing of the seller's can never sell at its old price on the way. If one is
  // still stored and the marketplace is already approved, that listing can sell right now, so it's repriced in
  // one step. If it isn't approved, the old listing is cancelled before anything is approved. Approval is skipped
  // when it's already in place. `onStep` gets a label for each wallet confirmation as it comes up.
  async function listItem(nftAddress, tokenId, priceInEther, onStep = () => {}) {
    const results = await readContracts(config, { contracts: listingStateReads(nftAddress, tokenId, address), allowFailure: true });
    // Never approve without knowing what's stored: an unseen old listing would go live with the approval
    if (results[0].status !== "success") throw new Error("Couldn't read the marketplace. Please try again.");
    const { oldPrice, approved } = listingState(results, address);

    if (oldPrice > 0n && approved) {
      onStep("Updating your old listing");
      return updateListing(nftAddress, tokenId, priceInEther);
    }

    const steps = [
      oldPrice > 0n && ["Removing your old listing", () => cancelListing(nftAddress, tokenId)],
      !approved && ["Approving the marketplace", () => approveNft(nftAddress, tokenId)],
      ["Creating the listing", () => executeTx({
        address: MARKETPLACE_CONTRACT,
        abi: MARKETPLACE_ABI,
        functionName: "listItem",
        args: [nftAddress, BigInt(tokenId), parseEther(priceInEther)],
      })],
    ].filter(Boolean);

    let receipt;
    for (const [i, [label, run]] of steps.entries()) {
      onStep(steps.length > 1 ? `${label} (${i + 1}/${steps.length})` : label);
      receipt = await run();
    }
    return receipt;
  }

  async function buyItem(nftAddress, tokenId, price, isWei = false) {
    return executeTx({
      address: MARKETPLACE_CONTRACT,
      abi: MARKETPLACE_ABI,
      functionName: "buyItem",
      args: [nftAddress, BigInt(tokenId)],
      value: isWei ? BigInt(price) : parseEther(price),
    });
  }

  async function cancelListing(nftAddress, tokenId) {
    return executeTx({
      address: MARKETPLACE_CONTRACT,
      abi: MARKETPLACE_ABI,
      functionName: "cancelListing",
      args: [nftAddress, BigInt(tokenId)],
    });
  }

  async function updateListing(nftAddress, tokenId, newPriceInEther) {
    return executeTx({
      address: MARKETPLACE_CONTRACT,
      abi: MARKETPLACE_ABI,
      functionName: "updateListing",
      args: [nftAddress, BigInt(tokenId), parseEther(newPriceInEther)],
    });
  }

  return (
    <Web3Context.Provider
      value={{
        address,
        isConnected,
        listItem,
        buyItem,
        cancelListing,
        updateListing,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}
