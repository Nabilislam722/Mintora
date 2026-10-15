import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBalance, useReadContracts } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { hemi } from "@/lib/hemi";

// Hemi mainnet tokens from hemilabs/token-list; USDC on Hemi is Stargate-bridged USDC.e
export const WALLET_TOKENS = [
  { symbol: "ETH", name: "Ether", decimals: 18 },
  { symbol: "HEMI", name: "Hemi", address: "0x99e3dE3817F6081B2568208337ef83295b7f591D", decimals: 18 },
  { symbol: "USDC", name: "Bridged USDC", address: "0xad11a8BEb98bbf61dbb1aa0F6d6F2ECD87b35afA", decimals: 6 },
];

const ERC20S = WALLET_TOKENS.filter((t) => t.address);

const PRICE_CACHE_KEY = "token_prices_usd";
const PRICE_TTL = 8 * 60 * 60 * 1000; // same as the server's CryptoRank cache (apps/server/prices.js)

function readCachedPrices() {
  try {
    const cached = JSON.parse(localStorage.getItem(PRICE_CACHE_KEY));
    return cached?.prices && cached.updatedAt ? cached : null;
  } catch {
    return null;
  }
}

// All USD prices in one request to our server (which holds the CryptoRank key and its own 8h cache).
// The response is kept in localStorage, so reloads don't refetch until the prices are 8 hours old.
export function useTokenPrices() {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const [cached] = useState(readCachedPrices);
  return useQuery({
    queryKey: ["token-prices-usd"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/prices`);
      if (!res.ok) throw new Error("Price request failed");
      const data = await res.json();
      try {
        localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(data));
      } catch {
        // storage full or blocked; the in-memory query cache still works
      }
      return data;
    },
    initialData: cached ?? undefined,
    initialDataUpdatedAt: cached?.updatedAt,
    staleTime: PRICE_TTL,
    gcTime: Infinity,
    retry: 1,
    select: (data) => data.prices,
  });
}

// Amount and USD value of each WALLET_TOKENS entry; total is null until every value is known
export function useWalletBalances(address) {
  const eth = useBalance({ address, chainId: hemi.id });
  const tokens = useReadContracts({
    contracts: ERC20S.map((t) => ({ address: t.address, abi: erc20Abi, functionName: "balanceOf", args: [address], chainId: hemi.id })),
    query: { enabled: !!address },
  });
  const { data: prices } = useTokenPrices();

  const rows = WALLET_TOKENS.map((t) => {
    const raw = t.address ? tokens.data?.[ERC20S.indexOf(t)]?.result : eth.data?.value;
    const amount = raw == null ? null : Number(formatUnits(raw, t.decimals));
    const price = prices?.[t.symbol];
    return { ...t, amount, usd: amount != null && price != null ? amount * price : null };
  });
  const total = rows.every((r) => r.usd != null) ? rows.reduce((sum, r) => sum + r.usd, 0) : null;

  return { rows, total };
}
