import { useMemo } from "react";
import { Link } from "wouter";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ExternalLink, Loader2, Pencil, ShoppingCart, Tag, X } from "lucide-react";
import ResilientNftImage from "@/components/ResilientNftImage";
import { formatEth, shortAddress, timeAgo } from "@/lib/nft";

const EVENTS = {
  SOLD: { label: "Sale", icon: ShoppingCart, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  LIST: { label: "List", icon: Tag, cls: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  UPDATE: { label: "Price update", icon: Pencil, cls: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  CANCEL: { label: "Cancel", icon: X, cls: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  TRANSFER: { label: "Transfer", icon: ArrowLeftRight, cls: "text-muted-foreground bg-secondary/50 border-white/10" },
};
const PRICED = new Set(["SOLD", "LIST", "UPDATE"]);
const COLS = "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[8rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_6rem]";

function Party({ address }) {
  if (!address) return <span className="hidden md:inline text-xs text-muted-foreground">—</span>;
  return (
    <Link href={`/profile/${address}`} className="truncate font-mono text-xs text-muted-foreground hover:text-foreground">
      {shortAddress(address)}
    </Link>
  );
}

function Row({ item, nft, showCollection }) {
  const ev = EVENTS[item.type] ?? EVENTS.TRANSFER;
  const Icon = ev.icon;
  const collectionId = item.collectionInfo?._id ?? nft?.collectionId?._id;
  const itemBody = (
    <>
      <span className="w-8 h-8 rounded-lg overflow-hidden bg-secondary/40 shrink-0">
        {nft?.imageUrl && <ResilientNftImage src={nft.imageUrl} alt="" className="w-full h-full object-cover" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{nft?.name ?? `#${item.tokenId}`}</span>
        {showCollection && item.collectionInfo?.name && (
          <span className="block truncate text-[11px] text-muted-foreground">{item.collectionInfo.name}</span>
        )}
      </span>
    </>
  );

  return (
    <li className={`grid ${COLS} items-center gap-x-4 gap-y-2 px-4 py-3`}>
      <div className="flex items-center gap-3 min-w-0 md:contents">
        <span className={`inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${ev.cls}`}>
          <Icon className="w-3 h-3" /> {ev.label}
        </span>
        {collectionId ? (
          <Link href={`/nfts/${collectionId}/${item.tokenId}`} className="flex items-center gap-2 min-w-0 hover:text-primary transition-colors">
            {itemBody}
          </Link>
        ) : (
          <span className="flex items-center gap-2 min-w-0">{itemBody}</span>
        )}
      </div>
      <span className="text-sm font-semibold tabular-nums text-right md:text-left">
        {PRICED.has(item.type) && item.price !== "0" ? (
          <>
            {formatEth(item.price)} <span className="text-xs font-normal text-muted-foreground">ETH</span>
          </>
        ) : (
          <span className="text-muted-foreground font-normal">—</span>
        )}
      </span>
      <div className="flex items-center gap-1.5 min-w-0 md:contents">
        <Party address={item.from} />
        {item.from && item.to && <span className="text-xs text-muted-foreground md:hidden">→</span>}
        <Party address={item.to} />
      </div>
      <a
        href={`https://explorer.hemi.xyz/tx/${item.tx}`}
        target="_blank"
        rel="noopener noreferrer"
        title={new Date(item.createdAt).toLocaleString()}
        className="inline-flex items-center justify-end gap-1 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
      >
        {timeAgo(item.createdAt)} <ExternalLink className="w-3 h-3" />
      </a>
    </li>
  );
}

// `filter` is passed straight to /api/activity: { collection: contractAddress } or { address: wallet }.
// `nfts` (optional) supplies thumbnails and names for items it contains.
export default function ActivityFeed({ filter, nfts, showCollection = false }) {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const byToken = useMemo(() => new Map((nfts ?? []).map((n) => [`${n.contractAddress}:${n.tokenId}`, n])), [nfts]);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["activity", filter],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ ...filter, limit: 20, page: pageParam });
      const res = await fetch(`${BASE_URL}/api/activity?${params}`);
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  if (isError || (!isLoading && items.length === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        {isError ? "Couldn't load activity. Try again later." : "No activity yet."}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-md overflow-hidden">
      <div className={`hidden md:grid ${COLS} gap-x-4 px-4 py-2.5 border-b border-border/50 text-[11px] uppercase tracking-wider text-muted-foreground`}>
        {["Event", "Item", "Price", "From", "To", "Time"].map((h) => (
          <span key={h} className={h === "Time" ? "text-right" : ""}>{h}</span>
        ))}
      </div>

      {isLoading ? (
        <ul className="divide-y divide-border/50">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="px-4 py-3"><div className="h-8 rounded-lg bg-secondary/40 animate-pulse" /></li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((item) => (
            <Row key={item._id} item={item} nft={byToken.get(`${item.collection}:${item.tokenId}`)} showCollection={showCollection} />
          ))}
        </ul>
      )}

      {hasNextPage && (
        <div className="border-t border-border/50 p-3 text-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-full border border-white/10 bg-secondary/50 text-sm font-medium hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            {isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Load more
          </button>
        </div>
      )}
    </div>
  );
}
