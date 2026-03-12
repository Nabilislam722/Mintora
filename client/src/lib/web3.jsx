import { createContext, useContext } from "react";
import { useAccount, useBalance, useWriteContract, useConfig } from "wagmi";
import { parseEther } from "viem";
import { waitForTransactionReceipt } from "@wagmi/core";

export const MARKETPLACE_CONTRACT = "0xf93AF302727E0ef59522Cd9D9Ff19Ba6b5BB7755";
const ERC721_ABI = [
  { 
    name: "approve", 
    type: "function", 
    stateMutability: "nonpayable", 
    inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }] 
  }
];
const MARKETPLACE_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }] },
  { name: "listItem", type: "function", stateMutability: "nonpayable", inputs: [{ name: "nftAddress", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "price", type: "uint256" }] },
  { name: "buyItem", type: "function", stateMutability: "payable", inputs: [{ name: "nftAddress", type: "address" }, { name: "tokenId", type: "uint256" }] },
  { name: "cancelListing", type: "function", stateMutability: "nonpayable", inputs: [{ name: "nftAddress", type: "address" }, { name: "tokenId", type: "uint256" }] },
  { name: "updateListing", type: "function", stateMutability: "nonpayable", inputs: [{ name: "nftAddress", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "newPrice", type: "uint256" }] }
];

const Web3Context = createContext();

export function Web3Provider({ children }) {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();

  const executeTx = async (txRequest) => {
    const hash = await writeContractAsync(txRequest);
    return await waitForTransactionReceipt(config, { hash, confirmations: 1 });
  };


  async function approveNft(nftAddress, tokenId) {
    return executeTx({
      address: nftAddress,
      abi: ERC721_ABI,
      functionName: "approve",
      args: [MARKETPLACE_CONTRACT, BigInt(tokenId)],
    });
  }
  /**
   * 1. LIST ITEM
   * @param priceInEther - e.g., "0.1"
   */
  async function listItem(nftAddress, tokenId, priceInEther) {
    return executeTx({
      address: MARKETPLACE_CONTRACT,
      abi: MARKETPLACE_ABI,
      functionName: "listItem",
      args: [nftAddress, BigInt(tokenId), parseEther(priceInEther)],
    });
  }

  /**
   * 2. BUY ITEM
   * @param priceInEther - The current listing price to send as Msg.Value
   */
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
        approveNft,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}