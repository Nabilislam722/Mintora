import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import { Activity as ActivityIcon } from "lucide-react";
import ActivityFeed from "@/components/ActivityFeed";
import { useTokenPrices } from "@/hooks/use-token-prices";
import { useSeo } from "@/hooks/use-seo";
import { pageSeo } from "@/lib/seo";
import { fmt } from "@/lib/vehemi";

const FILTERS = [
  { id: "all", label: "All", params: {}, empty: "No activity yet." },
  { id: "sales", label: "Sales", params: { type: "SOLD" }, empty: "No sales yet." },
  { id: "listings", label: "Listings", params: { type: "LIST,UPDATE,CANCEL" }, empty: "No listings yet." },
  { id: "vehemi", label: "veHEMI", params: { market: "vehemi" }, empty: "No veHEMI sales yet." },
];

const toAmount = (wei) => {
  try {
    return Number(formatEther(BigInt(wei ?? 0)));
  } catch {
    return 0;
  }
};
const usd = (n) => `≈ ${n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;

function useSalesSummary() {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  return useQuery({
    queryKey: ["activity", "summary"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/activity/summary`);
      if (!res.ok) throw new Error("Failed to load the sales summary");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-2 h-8 px-3.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
      <span className="relative flex w-2 h-2">
        <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  );
}

function Stat({ label, value, unit, sub }) {
  return (
    <div className="rounded-3xl border border-border/50 bg-card px-6 py-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-semibold tabular-nums leading-tight">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums mt-1 min-h-4">{sub}</p>
    </div>
  );
}

function SalesSummary() {
  const { data: summary, isLoading } = useSalesSummary();
  const { data: prices } = useTokenPrices();
  const loading = isLoading || !summary;
  const eth = toAmount(summary?.nft.volume);
  const hemi = toAmount(summary?.vehemi.volume);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Stat
        label="Sales · last 7 days"
        value={loading ? "—" : summary.nft.sales + summary.vehemi.sales}
        sub={loading ? null : `${summary.nft.sales} NFT · ${summary.vehemi.sales} veHEMI`}
      />
      <Stat
        label="NFT volume · last 7 days"
        value={loading ? "—" : fmt(eth)}
        unit={loading ? null : "ETH"}
        sub={!loading && prices?.ETH != null ? usd(eth * prices.ETH) : null}
      />
      <Stat
        label="veHEMI volume · last 7 days"
        value={loading ? "—" : fmt(hemi)}
        unit={loading ? null : "HEMI"}
        sub={!loading && prices?.HEMI != null ? usd(hemi * prices.HEMI) : null}
      />
    </div>
  );
}

export default function Activity() {
  useSeo(pageSeo("/activity"));
  const [filterId, setFilterId] = useState("all");
  const filter = FILTERS.find((f) => f.id === filterId);

  return (
    <div className="sm:pr-12">
      <div className="container mx-auto px-4 py-6 flex flex-col gap-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <ActivityIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-tight">Activity</h1>
              <p className="text-sm text-muted-foreground">Every sale, listing and transfer on Mintora, NFTs and veHEMI</p>
            </div>
          </div>
          <LivePill />
        </header>

        <SalesSummary />

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterId(f.id)}
              aria-pressed={filterId === f.id}
              className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                filterId === f.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ActivityFeed key={filter.id} filter={filter.params} emptyText={filter.empty} showCollection live />

        <p className="text-[11px] text-muted-foreground text-center">
          Read from Hemi: new activity shows up a few seconds after its block. Times link to the transaction on the explorer.
        </p>
      </div>
    </div>
  );
}
