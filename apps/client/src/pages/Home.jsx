import { useQuery } from "@tanstack/react-query";
import FeaturedCarousel from "../components/FeaturedCarousel";
import HeroBackdrop from "../components/HeroBackdrop";
import CollectionCard from "../components/CollectionCard";
import TopNftsSection from "../components/TopNftsSection";
import LatestListingsSection from "../components/LatestListingsSection";
import VeHemiPromo from "../components/vehemi/VeHemiPromo";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import "../components/home.css";
import { BsFillCollectionFill } from "react-icons/bs";
import { useSeo } from "@/hooks/use-seo";
import { pageSeo } from "@/lib/seo";
import { useGridColumns, columnWidth } from "@/hooks/use-grid-columns";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Glowing frame around the featured collections. It spans `span` grid columns and shows that many cards;
// any more scroll sideways inside it.
function FeaturedFrame({ collections, span }) {
  const width = columnWidth(span);
  return (
    <div
      className="relative flex p-4 rounded-xl bg-neutral-950 min-w-0"
      style={{ isolation: "isolate", gridColumn: `span ${span} / span ${span}` }}
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
      <div className="flex gap-4 overflow-x-auto w-full" style={{ scrollbarWidth: "none" }}>
        {collections.map((collection) => (
          <div key={collection._id} className="shrink-0" style={{ width }}>
            <CollectionCard collection={collection} size="large" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  useSeo(pageSeo("/"));
  // The hero banner on show, which tints the top of the page (HeroBackdrop)
  const [heroImage, setHeroImage] = useState(null);
  const { data: collections = [], isLoading: loadingCols } = useQuery({
    queryKey: [`${BASE_URL}/api/collections`],
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  // Top NFTs are ordered by their collection's sales in this period (the 24h / 7d / 30d buttons)
  const [topPeriod, setTopPeriod] = useState("24h");
  const { data: topNfts = [], isLoading: loadingTopNfts } = useQuery({
    queryKey: [`${BASE_URL}/api/featurednft?limit=8&period=${topPeriod}`],
    // Keep showing the current cards while another period loads, instead of the page spinner
    placeholderData: (previous) => previous,
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
  });

  const { data: latestNfts = [], isLoading: loadingLatest } = useQuery({
    queryKey: [`${BASE_URL}/api/nfts`],
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });

  // Collections fill two rows of the grid: the featured frame first, then the rest. The API sends them with
  // the most sales this week first, so the best sellers get the places.
  const columns = useGridColumns();
  const featuredCollections = useMemo(() => collections.filter(c => c.isFeatured), [collections]);
  const featuredSpan = Math.min(featuredCollections.length, columns);
  const regularCollections = useMemo(
    () => collections.filter(c => !c.isFeatured).slice(0, 2 * columns - featuredSpan),
    [collections, columns, featuredSpan]
  );

  if (loadingCols || loadingTopNfts || loadingLatest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    // `isolate` keeps the backdrop behind the page's content without going behind the page itself
    <div className="relative isolate flex flex-col gap-10 sm:pr-12">
      <HeroBackdrop image={heroImage} />
      <FeaturedCarousel onImage={setHeroImage} />

      {/*Vehemi section */}
      <VeHemiPromo />
      
      {/* Collections */}
      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BsFillCollectionFill className="w-5 h-5 text-foreground opacity-80" />
            <h2 className="text-lg font-display font-bold text-foreground opacity-80">Collections</h2>
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

        <div className="grid gap-4 items-center" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {featuredSpan > 0 && <FeaturedFrame collections={featuredCollections} span={featuredSpan} />}
          {regularCollections.map((collection) => (
            <CollectionCard key={collection._id} collection={collection} size="large" />
          ))}
        </div>
      </section>

      <TopNftsSection nfts={topNfts} timeFilter={topPeriod} setTimeFilter={setTopPeriod} />


      <LatestListingsSection nfts={latestNfts} />

      {/*Launchpad banner*/}
      <section className="container mx-auto px-4 apply-banner rounded-2xl overflow-hidden relative mt-6 mb-10">
        {/* Left content */}
        <div className="flex items-center justify-between px-5 sm:px-12 py-8 sm:py-10">
          <div className="flex flex-col gap-3 z-10">
            <p className="text-xs text-blue-200 uppercase tracking-widest flex items-center gap-1">
              Mintora NFT Launchpad
            </p>
            <h2 className="text-xl sm:text-3xl font-bold text-white leading-snug">
              Apply for NFT Listing or Launchpad
            </h2>
            <p className="text-sm text-blue-100/70 max-w-md">
              Leverage our open marketplace and audience to bring your collection to the next level of growth.
            </p>
            <button className="mt-2 w-fit bg-white text-slate-800 text-sm font-medium px-5 py-2 rounded-lg hover:bg-blue-50 transition">
              Coming Soon
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-6 px-4 sm:px-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-0 justify-between text-sm text-muted-foreground">
        <div>© 2026 Mintora. All rights reserved.</div>
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          <a href="/faq" className="hover:text-foreground transition">FAQ</a>
          <a href="#" target="_blank" className="hover:text-foreground transition">Terms of Use</a>
          <a href="https://www.team.mintora.app" target="_blank" rel="noopener noreferrer"  className="hover:text-foreground transition">Team</a>
          <a href="https://www.careers.mintora.app" target="_blank" className="hover:text-foreground transition">Careers</a>
        </div>
      </footer>
    </div>
  );
}
