import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const PRICE_CACHE_KEY = "token_prices_usd";
const PRICE_TTL = 4 * 60 * 60 * 1000;

function readCachedPrices() {
  try {
    const cached = JSON.parse(localStorage.getItem(PRICE_CACHE_KEY));
    return cached?.prices && cached.updatedAt ? cached : null;
  } catch {
    return null;
  }
}

// USD prices of ETH, HEMI and USDC from our API, cached in localStorage for 4 hours
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

// USD price of 1 ETH, or null until known
export function useEthPrice() {
  return useTokenPrices().data?.ETH ?? null;
}

// USD price of 1 HEMI, or null until known
export function useHemiPrice() {
  return useTokenPrices().data?.HEMI ?? null;
}
