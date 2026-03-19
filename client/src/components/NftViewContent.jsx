import { LayoutGrid, LayoutList, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { formatEther } from "viem";
import NftCard from "./NftCard";

export function NftControls({ timeFilter, setTimeFilter, nftView, setNftView }) {
  return (
    <div className="flex items-center gap-3">

      <div className="flex bg-secondary rounded-lg overflow-hidden">
        {["24h", "7d", "30d"].map((period) => (
          <button
            key={period}
            onClick={() => setTimeFilter(period)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              timeFilter === period
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary-foreground/10"
            }`}
          >
            {period}
          </button>
        ))}
      </div>

      <div className="view-toggle flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.07] rounded-lg p-1">
        <button
          className={nftView === "grid" ? "active" : ""}
          onClick={() => setNftView("grid")}
          title="Grid view"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>
        <button
          className={nftView === "list" ? "active" : ""}
          onClick={() => setNftView("list")}
          title="List view"
        >
          <LayoutList className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}

function PriceChange({ value }) {
  if (value == null) return null;

  const isUp      = value >= 0;
  const formatted = `${isUp ? "+" : ""}${Number(value).toFixed(1)}%`;
  const Icon      = isUp ? TrendingUp : TrendingDown;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold font-mono tabular-nums ${
        isUp ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      <Icon className="w-3 h-3" />
      {formatted}
    </span>
  );
}

function NftListRow({ nft, index }) {
  const price = nft.price
    ? `${parseFloat(formatEther(BigInt(nft.price))).toFixed(3)} ETH`
    : "—";

  const priceChange = nft.priceChange ?? 100;

  return (
    <Link href={`/nfts/${nft.collectionId?._id}/${nft.tokenId}`}>
      <div className="nft-row" style={{ animationDelay: `${index * 0.04}s` }}>

        {/* Rank */}
        <span className="text-xs font-mono font-bold text-foreground/20 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Thumbnail */}
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-foreground/5 shrink-0">
          <img
            src={nft.imageUrl}
            alt={nft.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Name + token ID */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground/90 truncate leading-tight">
            {nft.name}
          </p>
          <p className="text-[11px] text-foreground/30 font-mono mt-0.5">
            #{nft.tokenId}
          </p>
        </div>

        {/* Collection */}
        <p className="text-xs text-foreground/40 truncate font-medium">
          {nft.collectionId?.name || "Unknown"}
        </p>

        {/* Price + % change + arrow */}
        <div className="flex items-center gap-3 justify-end">
          <div className="text-right">
            <p className="text-sm font-bold font-mono text-foreground/90 tabular-nums">
              {price}
            </p>
            <PriceChange value={priceChange} />
          </div>
          <ArrowUpRight className="row-arrow w-3.5 h-3.5 text-white/30 shrink-0" />
        </div>

      </div>
    </Link>
  );
}

export function NftViewContent({ nfts, nftView }) {
  if (nftView === "grid") {
    return (
      <div className="nft-grid-enter grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {nfts.map((nft) => (
          <NftCard key={nft._id} nft={nft} size="small" />
        ))}
      </div>
    );
  }

  return (
    <div className="nft-list-enter">
      {/* Column headers */}
      <div
        className="grid px-4 mb-1"
        style={{ gridTemplateColumns: "2.5rem 3rem 1fr 1fr auto", gap: "1rem" }}
      >
        <span className="text-[10px] uppercase tracking-widest text-foreground/20 font-semibold">#</span>
        <span />
        <span className="text-[10px] uppercase tracking-widest text-foreground/20 font-semibold">Name</span>
        <span className="text-[10px] uppercase tracking-widest text-foreground/20 font-semibold">Collection</span>
        <span className="text-[10px] uppercase tracking-widest text-foreground/20 font-semibold text-right">Price</span>
      </div>

      <div className="h-px bg-white/[0.06] mb-1" />

      {nfts.map((nft, idx) => (
        <NftListRow key={nft._id} nft={nft} index={idx} />
      ))}
    </div>
  );
}