import { useQuery } from "@tanstack/react-query";
import FeaturedCarousel from "../components/FeaturedCarousel";
import CollectionCard from "../components/CollectionCard";
import NftCard from "../components/NftCard";
import { LayoutGrid, TrendingUp, ChevronRight, ArrowUpRight, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState } from "react";
import { formatEther } from "viem";
import "../components/home.css"

export default function Home() {
  const [timeFilter, setTimeFilter] = useState("24h");
  const [nftView, setNftView] = useState("grid"); // "grid" | "list"

  const { data: collections = [], isLoading: loadingCols } = useQuery({
    queryKey: ["/api/collections"],
  });

  const { data: nfts = [], isLoading: loadingNfts } = useQuery({
    queryKey: ["/api/featurednft?limit=8"],
  });

  const displayCollections = collections.slice(0, 6);
  const topNfts = nfts;
  const featuredCollections = displayCollections.slice(0, 2);
  const regularCollections = displayCollections.slice(2);

  if (loadingCols || loadingNfts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-20 pr-12">

      <FeaturedCarousel />

      {/* ── Collections ── */}
      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-display font-bold">Collections</h2>
          </div>
          <Link href="/collections">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              data-testid="link-view-all-collections"
            >
              View all <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap gap-6 h-[20rem] items-center ">
          {featuredCollections.length > 0 && (
            <div
              className="relative flex shrink-0 gap-4 p-4 rounded-xl bg-neutral-950 "
              style={{ isolation: "isolate" }}
            >
              <div
                className="absolute -inset-[3px] rounded-xl -z-20 blur-xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgb(13 160 74) 0%, rgb(41 58 230) 40%, rgb(239 81 35) 90%)",
                  animation: "ambient-breathe 5s ease-in-out infinite",
                }}
              />
              {/*Spinny sweeper*/}
              <div className="absolute -inset-[1px] rounded-xl -z-10 overflow-hidden">
                <div
                  className="absolute -inset-[1px] rounded-xl -z-10 overflow-hidden"
                  style={{
                    WebkitMaskImage: "radial-gradient(circle at center, transparent 35%, black 67%)",
                    maskImage: "radial-gradient(circle at center, transparent 35%, black 67%)",
                  }}
                >
                  <div
                    className="absolute inset-[-150%] pointer-events-none"
                    style={{
                      animation: "shimmer-sweep 4s linear infinite",
                      background: `conic-gradient(from 0deg, transparent 65%, rgba(255, 255, 255, 1) 75%, transparent 85%)`,
                    }}
                  />
                </div>
              </div>
              <div className="absolute inset-[1px] rounded-[11px] bg-card/70 backdrop:blur-2xl -z-[5]" />
              <span className="absolute -top-3 left-6 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] bg-neutral-900 text-gray-400 border border-gray-800 rounded-full z-20">
                <img
                  src="https://pub-6fd72b146dbb4330a7ad961c7c584367.r2.dev/featured_assets/hemi.png"
                  alt=""
                  className="w-4"
                />
              </span>
              {featuredCollections.map((collection) => (
                <div key={collection._id} className="w-64 shrink-0">
                  <CollectionCard collection={collection} size="large" />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-grow">
            {regularCollections.map((collection) => (
              <div key={collection._id} className="w-56 shrink-0">
                <CollectionCard collection={collection} size="large" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Top NFTs ── */}
      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-display font-bold">Top NFTs</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Time filter */}
            <div className="flex bg-secondary rounded-lg overflow-hidden">
              {["24h", "7d", "30d"].map((period) => (
                <button
                  key={period}
                  onClick={() => setTimeFilter(period)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${timeFilter === period
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary-foreground/10"
                    }`}
                  data-testid={`button-filter-${period}`}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div
              className="view-toggle flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.07] rounded-lg p-1"
            >
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
        </div>

        {/* Grid view */}
        {nftView === "grid" && (
          <div key="grid" className="nft-grid-enter grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {topNfts.map((nft) => (
              <NftCard key={nft._id} nft={nft} size="small" />
            ))}
          </div>
        )}

        {/* List / leaderboard view */}
        {nftView === "list" && (
          <div key="list" className="nft-list-enter">
            <div
              className="grid px-4 mb-1"
              style={{ gridTemplateColumns: "2.5rem 3rem 1fr 1fr auto", gap: "1rem" }}
            >
              <span className="text-[10px] uppercase tracking-widest text-white/20 font-semibold">#</span>
              <span />
              <span className="text-[10px] uppercase tracking-widest text-white/20 font-semibold">Name</span>
              <span className="text-[10px] uppercase tracking-widest text-white/20 font-semibold">Collection</span>
              <span className="text-[10px] uppercase tracking-widest text-white/20 font-semibold text-right">Price</span>
            </div>
            <div className="h-px bg-white/[0.06] mb-1" />

            {topNfts.map((nft, idx) => {
              const price = nft.price
                ? `${parseFloat(formatEther(BigInt(nft.price))).toFixed(3)} ETH`
                : "—";
              const isUp = idx % 3 !== 2;
              const change = (((idx * 7 + 3) % 18) + 1).toFixed(1);

              return (
                <Link key={nft._id} href={`/nfts/${nft.collectionId?._id}/${nft.tokenId}`}>
                  <div
                    className="nft-row"
                    style={{ animationDelay: `${idx * 0.04}s` }}
                    data-testid={`card-nft-${nft.id}`}
                  >
                    <span className="text-xs font-mono font-bold text-white/20 tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0">
                      <img
                        src={nft.imageUrl}
                        alt={nft.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white/90 truncate leading-tight">{nft.name}</p>
                      <p className="text-[11px] text-white/30 font-mono mt-0.5">#{nft.tokenId}</p>
                    </div>
                    <p className="text-xs text-white/40 truncate font-medium">
                      {nft.collectionId?.name || "Unknown"}
                    </p>
                    <div className="flex items-center gap-3 justify-end">
                      <div className="text-right">
                        <p className="text-sm font-bold font-mono text-white/90 tabular-nums">{price}</p>
                        {nft.price && (
                          <p className={`text-[11px] font-semibold font-mono tabular-nums ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                            {isUp ? "+" : "-"}{change}%
                          </p>
                        )}
                      </div>
                      <ArrowUpRight className="row-arrow w-3.5 h-3.5 text-white/30 shrink-0" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}