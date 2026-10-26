import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, Plus } from "lucide-react";
import hemiLogo from "/hemi.svg";
import VeHemiCard from "@/components/vehemi/VeHemiCard";
import VeHemiPrice from "@/components/vehemi/VeHemiPrice";
import VeHemiFilters from "@/components/vehemi/VeHemiFilters";
import VeHemiBuyDialog from "@/components/vehemi/VeHemiBuyDialog";
import VeHemiBackdrop from "@/components/vehemi/VeHemiBackdrop";
import { useVeHemiListings } from "@/hooks/use-vehemi";
import { LOCK_FILTERS, discountOf, fmt, inputCls, weightOf } from "@/lib/vehemi";
import { useSeo } from "@/hooks/use-seo";
import { pageSeo } from "@/lib/seo";

const SORTS = {
  priceAsc: { label: "Price: low to high", fn: (a, b) => a.price - b.price },
  discount: { label: "Biggest discount", fn: (a, b) => a.price / a.hemi - b.price / b.hemi },
  unlock: { label: "Unlocks soonest", fn: (a, b) => a.left - b.left },
  amount: { label: "Most HEMI locked", fn: (a, b) => b.hemi - a.hemi },
  weight: { label: "Most voting weight", fn: (a, b) => weightOf(b) - weightOf(a) },
};

export default function VeHemi() {
  useSeo(pageSeo("/vehemi"));
  const all = useVeHemiListings();
  const [search, setSearch] = useState("");
  const [minHemi, setMinHemi] = useState("");
  const [lock, setLock] = useState(null);
  const [sort, setSort] = useState("priceAsc");
  const [buying, setBuying] = useState(null);

  const listings = useMemo(() => {
    const q = search.trim().replace("#", "");
    const min = Number(minHemi) || 0;
    const test = LOCK_FILTERS.find((f) => f.id === lock)?.test ?? (() => true);
    return all.filter((l) => (!q || String(l.id).includes(q)) && l.hemi >= min && test(l.left)).sort(SORTS[sort].fn);
  }, [all, search, minHemi, lock, sort]);

  const floorListing = all.reduce((min, l) => (l.price < min.price ? l : min));
  const avgDiscount = Math.round(all.reduce((s, l) => s + discountOf(l), 0) / all.length);
  const stats = [
    ["Floor price", <VeHemiPrice key="f" listing={floorListing} className="text-lg" />],
    ["Listed", <span key="l" className="text-lg font-semibold tabular-nums">{all.length}</span>],
    ["HEMI locked", <span key="h" className="text-lg font-semibold tabular-nums">{fmt(all.reduce((s, l) => s + l.hemi, 0) / 1e6, 2)}M</span>],
    ["Avg. discount", <span key="d" className="text-lg font-semibold tabular-nums text-emerald-400">{avgDiscount}%</span>],
  ];

  const reset = () => { setSearch(""); setMinHemi(""); setLock(null); };

  return (
    <div className="sm:pr-12">
      <VeHemiBackdrop />
      <div className="container relative z-10 mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <img src={hemiLogo} alt="hemi"/>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-tight">veHEMI</h1>
              <p className="text-sm text-muted-foreground">Trade locked HEMI positions before they unlock · priced in HEMI</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="h-9 p-6 rounded-full border border-white/10 bg-primary/90 font-semibold font-display hover:bg-secondary text-lg inline-flex items-center gap-2 transition-colors">
              <Plus className="w-3.5 h-3.5" /> List veHEMI
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-border/50 bg-card px-6 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
              {value}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-12">
          <div className="relative w-full lg:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Token ID" className={`${inputCls} border-muted-foreground/20 w-full pl-9 placeholder:text-muted-foreground/50`} />
          </div>
          <VeHemiFilters lock={lock} onLockChange={setLock} minHemi={minHemi} onMinHemiChange={setMinHemi} />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputCls} w-full lg:w-48`}>
            {Object.entries(SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </select>
        </div>

        {/* Listings */}
        {listings.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-5 py-16 rounded-2xl border border-dashed border-border">
            <p className="font-medium">No listings match your filters</p>
            <button type="button" onClick={reset} className="h-8 px-4 rounded-xl border border-white/10 text-sm hover:bg-secondary">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 sm:gap-x-5 gap-y-10">
            {listings.map((l) => <VeHemiCard key={l.id} listing={l} onBuy={setBuying} />)}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center">
          veHEMI positions are locked until their unlock date. Always verify the position before buying.
        </p>
      </div>

      <AnimatePresence>
        {buying && <VeHemiBuyDialog listing={buying} onClose={() => setBuying(null)} />}
      </AnimatePresence>
    </div>
  );
}
