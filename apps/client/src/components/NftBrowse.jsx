import { useEffect, useState } from "react";
import { Grid3X3, List, Search, X } from "lucide-react";
import NftCard from "@/components/NftCard";

// Building blocks shared by pages that browse a list of NFTs (collection page, profile)

export const controlCls = "h-9 rounded-full bg-secondary/50 border border-white/10 text-sm outline-none focus:border-primary/50";
export const tabCls = "rounded-full px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm";
const PAGE_SIZE = 40;

export function Segmented({ label, value, onChange, options }) {
  return (
    <div role="group" aria-label={label} className="inline-flex p-0.5 rounded-full bg-secondary/50 border border-white/10">
      {options.map(([id, content, aria]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          aria-label={aria}
          className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center transition-colors ${
            value === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {content}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${controlCls} w-full pl-9 pr-8 placeholder:text-muted-foreground/60`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function ViewToggle({ value, onChange }) {
  return (
    <Segmented
      label="Layout"
      value={value}
      onChange={onChange}
      options={[
        ["grid", <Grid3X3 key="g" className="w-4 h-4" />, "Grid view"],
        ["list", <List key="l" className="w-4 h-4" />, "List view"],
      ]}
    />
  );
}

export function EmptyState({ message, action, onAction }) {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-16 rounded-2xl border border-dashed border-border">
      <p className="font-medium">{message}</p>
      {action && (
        <button type="button" onClick={onAction} className="h-8 px-4 rounded-full border border-white/10 text-sm hover:bg-secondary transition-colors">
          {action}
        </button>
      )}
    </div>
  );
}

// Grid or list of NFT cards, 40 at a time; a new `items` array (new filters) starts from the top again
export function NftResults({ items, loading, view, empty }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  useEffect(() => setVisible(PAGE_SIZE), [items]);

  const gridCls =
    view === "grid"
      ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-5"
      : "grid grid-cols-1 lg:grid-cols-2 gap-3";

  if (loading) {
    return (
      <div className={gridCls}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`${view === "grid" ? "aspect-[4/5]" : "h-24"} rounded-xl bg-secondary/40 animate-pulse`} />
        ))}
      </div>
    );
  }

  if (items.length === 0) return empty;

  return (
    <>
      <p className="text-xs text-muted-foreground mb-3 tabular-nums">
        {items.length.toLocaleString()} {items.length === 1 ? "item" : "items"}
      </p>
      <div className={gridCls}>
        {items.slice(0, visible).map((nft) => (
          <NftCard key={nft._id} nft={nft} size={view === "list" ? "horizontal" : "default"} />
        ))}
      </div>
      {visible < items.length && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="h-10 px-6 rounded-full border border-white/10 bg-secondary/50 text-sm font-medium hover:bg-secondary transition-colors"
          >
            Show more
          </button>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            Showing {visible.toLocaleString()} of {items.length.toLocaleString()}
          </p>
        </div>
      )}
    </>
  );
}
