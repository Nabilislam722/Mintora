import { Link } from "wouter";
import { useInfiniteQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { formatEther } from "viem";
import { ArrowLeftRight, ArrowRight, ExternalLink, Flame, Handshake, History, Loader2, Pencil, ShoppingCart, Tag, X } from "lucide-react";
import hemiLogo from "/hemi.svg";
import ResilientNftImage from "@/components/ResilientNftImage";
import { useTokenPrices } from "@/hooks/use-token-prices";
import { shortAddress, timeAgo } from "@/lib/nft";
import { fmt } from "@/lib/vehemi";

const EXPLORER = "https://explorer.hemi.xyz";
const ZERO = "0x0000000000000000000000000000000000000000";
const PAGE_SIZE = 20;
const LIVE_INTERVAL = 15_000;

const SALE_CLS = "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
const EVENTS = {
  SOLD: { label: "Sale", icon: ShoppingCart, cls: SALE_CLS },
  OFFER: { label: "Offer accepted", icon: Handshake, cls: SALE_CLS },
  LIST: { label: "Listing", icon: Tag, cls: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25" },
  UPDATE: { label: "Price change", icon: Pencil, cls: "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/25" },
  CANCEL: { label: "Delisted", icon: X, cls: "text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/25" },
  TRANSFER: { label: "Transfer", icon: ArrowLeftRight, cls: "text-muted-foreground bg-secondary/50 border-border" },
  BURN: { label: "Burn", icon: Flame, cls: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25" },
};
const PRICED = new Set(["SOLD", "LIST", "UPDATE"]);

const COLS =
  "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[9.5rem_minmax(0,1.7fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_6.5rem]";

const eventOf = (item) =>
  item.type === "SOLD" && item.viaOffer
    ? EVENTS.OFFER
    : item.type === "TRANSFER" && item.to === ZERO
      ? EVENTS.BURN
      : EVENTS[item.type] ?? EVENTS.TRANSFER;

const isVeHemi = (item) => item.market === "vehemi";
const tokenKey = (item) => `${item.tx}:${item.collection}:${item.tokenId}`;

// An NFT sale also moves the NFT, which is recorded as a transfer in the same transaction: show the sale alone
function withoutSaleTransfers(items) {
  const sales = new Set(items.filter((i) => i.type === "SOLD").map(tokenKey));
  return items.filter((i) => i.type !== "TRANSFER" || !sales.has(tokenKey(i)));
}

const usd = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n > 0 && n < 1 ? 4 : 2 });

function EventBadge({ item }) {
  const ev = eventOf(item);
  const Icon = ev.icon;
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 h-6 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${ev.cls}`}>
      <Icon className="w-3 h-3" /> {ev.label}
    </span>
  );
}

function ItemCell({ item, showCollection }) {
  const vehemi = isVeHemi(item);
  const collectionId = item.nft?.collectionId ?? item.collectionInfo?._id;
  const href = vehemi ? `/vehemi/${item.tokenId}` : collectionId ? `/nfts/${collectionId}/${item.tokenId}` : null;
  const name = vehemi ? `veHEMI #${item.tokenId}` : item.nft?.name || `#${item.tokenId}`;
  const caption = vehemi ? "Locked HEMI position" : showCollection ? item.collectionInfo?.name : null;

  const body = (
    <>
      {vehemi ? (
        <span className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-orange-500/10 border border-orange-500/20">
          <img src={hemiLogo} alt="" className="w-6 h-6" />
        </span>
      ) : (
        <span className="w-10 h-10 rounded-xl shrink-0 overflow-hidden bg-secondary/40 border border-border/50">
          {item.nft?.imageUrl && <ResilientNftImage src={item.nft.imageUrl} alt="" className="w-full h-full object-cover" />}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{name}</span>
        {caption && <span className="block truncate text-xs text-muted-foreground">{caption}</span>}
      </span>
    </>
  );

  return href ? (
    <Link href={href} className="flex items-center gap-3 min-w-0 hover:text-primary transition-colors">{body}</Link>
  ) : (
    <span className="flex items-center gap-3 min-w-0">{body}</span>
  );
}

function PriceCell({ item, prices }) {
  const dash = <span className="text-sm text-muted-foreground">—</span>;
  if (!PRICED.has(item.type) || !item.price || item.price === "0") return dash;
  let amount;
  try {
    amount = Number(formatEther(BigInt(item.price)));
  } catch {
    return dash;
  }
  const unit = isVeHemi(item) ? "HEMI" : "ETH";
  const rate = prices?.[unit];
  return (
    <span className="flex flex-col items-end md:items-start leading-tight">
      <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
        {fmt(amount)} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
      </span>
      {rate != null && <span className="text-[11px] text-muted-foreground tabular-nums">{usd(amount * rate)}</span>}
    </span>
  );
}

// A wallet's profile picture, or a gradient drawn from its address
function Avatar({ address, src }) {
  if (src) return <img src={src} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />;
  const hue = parseInt(address.slice(2, 8), 16) % 360;
  return (
    <span
      className="w-6 h-6 rounded-full shrink-0"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 70) % 360} 65% 40%))` }}
    />
  );
}

const hasParty = (address) => !!address && address !== ZERO;

function Party({ address, user }) {
  if (!hasParty(address)) return <span className="hidden md:inline text-xs text-muted-foreground">—</span>;
  return (
    <Link href={`/profile/${address}`} title={address} className="group flex items-center gap-2 min-w-0">
      <Avatar address={address} src={user?.profileImageUrl} />
      <span className="truncate text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        {user?.username || shortAddress(address)}
      </span>
    </Link>
  );
}

function TimeLink({ item, className = "" }) {
  return (
    <a
      href={`${EXPLORER}/tx/${item.tx}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`${new Date(item.createdAt).toLocaleString()} · view on the Hemi explorer`}
      className={`items-center justify-end gap-1 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap ${className}`}
    >
      {timeAgo(item.createdAt)} <ExternalLink className="w-3 h-3" />
    </a>
  );
}

// Desktop: one row of six columns. Phone: event and time, then item and price, then who it was between.
function Row({ item, prices, showCollection }) {
  const both = hasParty(item.from) && hasParty(item.to);
  return (
    <motion.li
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`grid ${COLS} items-center gap-x-4 gap-y-2.5 px-4 sm:px-5 py-3.5 hover:bg-secondary/30 transition-colors`}
    >
      <EventBadge item={item} />
      <TimeLink item={item} className="inline-flex md:hidden" />
      <ItemCell item={item} showCollection={showCollection} />
      <PriceCell item={item} prices={prices} />
      <div className="col-span-2 flex items-center gap-2 min-w-0 md:contents">
        <Party address={item.from} user={item.fromUser} />
        {both && <ArrowRight className="w-3 h-3 shrink-0 text-muted-foreground md:hidden" />}
        <Party address={item.to} user={item.toUser} />
      </div>
      <TimeLink item={item} className="hidden md:inline-flex" />
    </motion.li>
  );
}

function SkeletonRows() {
  return Array.from({ length: 8 }, (_, i) => (
    <li key={i} className={`grid ${COLS} items-center gap-x-4 gap-y-2.5 px-4 sm:px-5 py-3.5`}>
      <span className="h-6 w-20 rounded-full bg-secondary/50 animate-pulse" />
      <span className="h-3 w-12 justify-self-end rounded bg-secondary/40 animate-pulse md:hidden" />
      <span className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-secondary/50 animate-pulse" />
        <span className="h-3.5 w-28 rounded bg-secondary/40 animate-pulse" />
      </span>
      <span className="h-3.5 w-16 justify-self-end md:justify-self-start rounded bg-secondary/40 animate-pulse" />
      <span className="hidden md:block h-3.5 w-24 rounded bg-secondary/40 animate-pulse" />
      <span className="hidden md:block h-3.5 w-24 rounded bg-secondary/40 animate-pulse" />
      <span className="hidden md:block h-3 w-12 justify-self-end rounded bg-secondary/40 animate-pulse" />
    </li>
  ));
}

// `filter` is passed straight to /api/activity, e.g. { collection: contractAddress }, { address: wallet },
// { type: "SOLD" } or { market: "vehemi" }. `live` refreshes it every 15 s.
export default function ActivityFeed({ filter, showCollection = false, live = false, emptyText = "No activity yet." }) {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const { data: prices } = useTokenPrices();

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["activity", filter],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ ...filter, limit: PAGE_SIZE, page: pageParam });
      const res = await fetch(`${BASE_URL}/api/activity?${params}`);
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    refetchInterval: live ? LIVE_INTERVAL : false,
  });

  const items = withoutSaleTransfers(data?.pages.flatMap((p) => p.items) ?? []);

  if (isError || (!isLoading && items.length === 0)) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
        <History className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{isError ? "Couldn't load activity." : emptyText}</p>
        {isError && (
          <button type="button" onClick={() => refetch()} className="h-8 px-4 rounded-full border border-border text-sm hover:bg-secondary transition-colors">
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-md overflow-hidden">
      <div className={`hidden md:grid ${COLS} gap-x-4 px-5 py-3 border-b border-border/50 text-[11px] font-medium uppercase tracking-wider text-muted-foreground`}>
        {["Event", "Item", "Price", "From", "To", "Time"].map((h) => (
          <span key={h} className={h === "Time" ? "text-right" : ""}>{h}</span>
        ))}
      </div>

      <ul className="divide-y divide-border/50">
        {isLoading ? (
          <SkeletonRows />
        ) : (
          items.map((item) => <Row key={item._id} item={item} prices={prices} showCollection={showCollection} />)
        )}
      </ul>

      {hasNextPage && (
        <div className="border-t border-border/50 p-3 text-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-full border border-border bg-secondary/50 text-sm font-medium hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            {isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Load more
          </button>
        </div>
      )}
    </div>
  );
}
