import { useQuery } from "@tanstack/react-query";
import { erc20Abi } from "viem";
import { usePublicClient, useReadContracts } from "wagmi";
import { hemi } from "@/lib/hemi";
import { MARKET_ABI } from "@/lib/vehemi-abi";
import { fetchBuyerOffers, fetchListings, fetchOffers, fetchPosition, openOffersTotal } from "@/lib/vehemi-chain";
import { LISTING_FEE_BPS, VE_HEMI_MARKET } from "@/lib/vehemi";

// Market state changes with every trade, unlike the app's default never-stale queries
const LIVE = { staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true };

const isTokenId = (id) => /^\d+$/.test(String(id ?? ""));

// Every listing that would fill right now
export function useVeHemiListings() {
  const client = usePublicClient({ chainId: hemi.id });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["vehemi", "listings"],
    queryFn: () => fetchListings(client),
    ...LIVE,
  });
  return { listings: data ?? [], loading: isLoading, error, refetch };
}

// One position with its listing state; data is null when the token doesn't exist
export function useVeHemiPosition(id) {
  const client = usePublicClient({ chainId: hemi.id });
  return useQuery({
    queryKey: ["vehemi", "position", String(id)],
    queryFn: () => fetchPosition(client, BigInt(id)),
    enabled: isTokenId(id),
    ...LIVE,
  });
}

// Offers stored for these token ids, best first
export function useVeHemiOffers(ids) {
  const client = usePublicClient({ chainId: hemi.id });
  const { data, isLoading } = useQuery({
    queryKey: ["vehemi", "offers", ids.join(",")],
    queryFn: () => fetchOffers(client, ids.map(BigInt)),
    enabled: ids.length > 0,
    ...LIVE,
  });
  return { offers: data ?? [], loading: isLoading && ids.length > 0 };
}

// The market's live fee and pause state
export function useVeHemiMarket() {
  const { data } = useReadContracts({
    contracts: ["feeBps", "paused"].map((functionName) => ({
      address: VE_HEMI_MARKET,
      abi: MARKET_ABI,
      functionName,
      chainId: hemi.id,
    })),
    query: { staleTime: 60_000 },
  });
  return {
    feeBps: data?.[0]?.result ?? LISTING_FEE_BPS,
    paused: data?.[1]?.result === true,
    loaded: data?.[0]?.status === "success",
  };
}

// What `owner` can pay with: their HEMI balance and approval for the market, and how much of that approval
// their open offers rely on (leaving out the offer on `tokenId`, which a trade on it replaces or clears).
// `token` is the market's payment token, read from the market rather than assumed.
export function useHemiFunds(owner, tokenId) {
  const client = usePublicClient({ chainId: hemi.id });
  return useQuery({
    queryKey: ["vehemi", "funds", owner, String(tokenId)],
    queryFn: async () => {
      const token = await client.readContract({ address: VE_HEMI_MARKET, abi: MARKET_ABI, functionName: "hemi" });
      const [reserved, allowance, balance] = await Promise.all([
        openOffersTotal(client, owner, tokenId),
        client.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, VE_HEMI_MARKET] }),
        client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
      ]);
      return { token, reserved, allowance, balance };
    },
    enabled: !!owner,
    staleTime: 0,
  });
}

// `owner`'s HEMI approval for the market and every offer of theirs still stored there, for the approvals panel.
// `token` is the market's payment token, read from the market like useHemiFunds does.
export function useOfferApprovals(owner) {
  const client = usePublicClient({ chainId: hemi.id });
  return useQuery({
    queryKey: ["vehemi", "approvals", owner],
    queryFn: async () => {
      const token = await client.readContract({ address: VE_HEMI_MARKET, abi: MARKET_ABI, functionName: "hemi" });
      const [allowance, offers] = await Promise.all([
        client.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, VE_HEMI_MARKET] }),
        fetchBuyerOffers(client, owner),
      ]);
      return { token, allowance, offers };
    },
    enabled: !!owner,
    ...LIVE,
  });
}
