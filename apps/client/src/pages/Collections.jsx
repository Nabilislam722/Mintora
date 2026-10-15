import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SearchX, X } from "lucide-react";
import { BsFillCollectionFill } from "react-icons/bs";
import CollectionCard from "../components/CollectionCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import "../components/home.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const GRID = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5";

function Pill({ active, onClick, count, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-secondary/50 text-muted-foreground border-white/10 hover:text-foreground hover:border-white/20"
      }`}
    >
      {children}
      <span className="ml-1.5 opacity-70 tabular-nums">{count}</span>
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden animate-pulse">
      <div className="aspect-square bg-secondary" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-secondary" />
        <div className="h-3 w-1/3 rounded bg-secondary" />
      </div>
    </div>
  );
}

// Same glowing frame as the featured panel on Home
function FeaturedPanel({ collections }) {
  return (
    <div
      className="relative flex gap-4 p-4 rounded-xl bg-neutral-950 w-fit max-w-full"
      style={{ isolation: "isolate" }}
    >
      <div
        className="absolute -inset-[3px] rounded-xl -z-20 blur-xl"
        style={{
          background: "linear-gradient(135deg, rgb(13 160 74) 0%, rgb(41 58 230) 40%, rgb(239 81 35) 90%)",
          animation: "ambient-breathe 5s ease-in-out infinite",
        }}
      />
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
              background:
                "conic-gradient(from 0deg, transparent 65%, rgba(255, 255, 255, 1) 75%, transparent 85%)",
            }}
          />
        </div>
      </div>
      <div className="absolute inset-[1px] rounded-[11px] bg-card/70 -z-[5]" />
      <span className="absolute -top-3 left-6 px-3 py-0.5 bg-neutral-900 border border-gray-800 rounded-full z-20">
        <img
          src="https://pub-6fd72b146dbb4330a7ad961c7c584367.r2.dev/featured_assets/hemi.png"
          alt="Featured"
          className="w-4"
        />
      </span>
      <div className="flex gap-4 overflow-x-auto min-w-0" style={{ scrollbarWidth: "none" }}>
        {collections.map((collection) => (
          <div key={collection._id ?? collection.id} className="w-56 sm:w-64 shrink-0">
            <CollectionCard collection={collection} size="large" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Collections() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("default");

  const { data: collections = [], isLoading } = useQuery({
    queryKey: [`${BASE_URL}/api/collections`],
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const query = searchTerm.trim().toLowerCase();
  const isSearching = query.length > 0;

  const { featured, filtered } = useMemo(() => {
    const sortList = (list) =>
      sort === "az" ? [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "")) : list;

    return {
      featured: sortList(collections.filter((c) => c.isFeatured)),
      filtered: sortList(
        collections.filter(
          (c) =>
            (!query || c.name?.toLowerCase().includes(query)) &&
            (filter === "all" || c.isFeatured)
        )
      ),
    };
  }, [collections, query, filter, sort]);

  const showFeaturedPanel = filter === "all" && !isSearching && featured.length > 0;
  const gridItems = showFeaturedPanel ? filtered.filter((c) => !c.isFeatured) : filtered;

  const gridTitle = isSearching
    ? `Results for “${searchTerm.trim()}”`
    : showFeaturedPanel
    ? "More collections"
    : filter === "featured"
    ? "Featured"
    : "All collections";

  const resetFilters = () => {
    setSearchTerm("");
    setFilter("all");
    setSort("default");
  };

  return (
    <div className="sm:pr-12">
      <div className="container mx-auto px-4 py-6 flex flex-col gap-8">

        {/* Header */}
        <header className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <BsFillCollectionFill className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-tight">
                  Collections
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isLoading
                    ? "Loading collections…"
                    : `${collections.length} ${collections.length === 1 ? "collection" : "collections"} on Hemi Network`}
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search collections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-9 bg-secondary/50 border-white/10 focus:border-primary/50 rounded-xl"
                data-testid="input-search-collections"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filters + sort */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Pill active={filter === "all"} onClick={() => setFilter("all")} count={collections.length}>
                All
              </Pill>
              <Pill active={filter === "featured"} onClick={() => setFilter("featured")} count={featured.length}>
                Featured
              </Pill>
            </div>

            <div className="inline-flex p-0.5 rounded-lg bg-secondary/50 border border-white/10">
              {[
                { id: "default", label: "Default" },
                { id: "az", label: "A–Z" },
              ].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSort(o.id)}
                  className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${
                    sort === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className={GRID}>
            {Array.from({ length: 10 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-16 rounded-2xl border border-dashed border-border">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <SearchX className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">
              {collections.length === 0 ? "No collections yet" : "No collections found"}
            </p>
            {collections.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">Try a different name or clear your filters.</p>
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            {showFeaturedPanel && (
              <section className="pt-2">
                <FeaturedPanel collections={featured} />
              </section>
            )}

            {gridItems.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between mb-5">
                  <h2 className="text-lg font-display font-bold text-foreground opacity-80">{gridTitle}</h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {gridItems.length} {gridItems.length === 1 ? "collection" : "collections"}
                  </span>
                </div>
                <div className={GRID}>
                  {gridItems.map((collection) => (
                    <CollectionCard key={collection._id ?? collection.id} collection={collection} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}