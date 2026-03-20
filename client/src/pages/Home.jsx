import { useQuery } from "@tanstack/react-query";
import FeaturedCarousel from "../components/FeaturedCarousel";
import CollectionCard from "../components/CollectionCard";
import TopNftsSection from "../components/TopNftsSection";
import LatestListingsSection from "../components/LatestListingsSection";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useRef, useState, useEffect } from "react";
import "../components/home.css";
import { BsFillCollectionFill } from "react-icons/bs";

export default function Home() {
  const { data: collections = [], isLoading: loadingCols } = useQuery({
    queryKey: ["/api/collections"],
  });

  const { data: topNfts = [], isLoading: loadingTopNfts } = useQuery({
    queryKey: ["/api/featurednft?limit=8"],
  });

  const { data: latestNfts = [], isLoading: loadingLatest } = useQuery({
    queryKey: ["/api/nfts"],
  });

  const displayCollections = collections.slice(0, 6);
  const featuredCollections = displayCollections.filter(c => c.isFeatured);
  const regularCollections = displayCollections.filter(c => !c.isFeatured);
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [regularCollections]);

  const scroll = (dir) =>
    scrollRef.current?.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });

  if (loadingCols || loadingTopNfts || loadingLatest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pr-12">
      <FeaturedCarousel />

      {/* Collections */}
      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BsFillCollectionFill className="w-5 h-5 text-primary" />
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

        <div className="flex flex-wrap lg:flex-row gap-6 items-center ">
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

          {/* Regular collections*/}
          {regularCollections.length > 0 && (
            <div className="relative flex-1 min-w-0">

              {/* Left arrow */}
              {canScrollLeft && (
                <button
                  onClick={() => scroll("left")}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10
                   w-8 h-8 rounded-full bg-neutral-900 border border-white/10
                   flex items-center justify-center shadow-lg
                   hover:bg-neutral-800 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              {/* Right arrow */}
              {canScrollRight && (
                <button
                  onClick={() => scroll("right")}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10
                   w-8 h-8 rounded-full bg-neutral-900 border border-white/10
                   flex items-center justify-center shadow-lg
                   hover:bg-neutral-800 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {/* Fade edges */}
              {canScrollLeft && <div className="absolute left-0  top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-[5] pointer-events-none" />}
              {canScrollRight && <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-[5] pointer-events-none" />}

              {/* Scrollable row */}
              <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto scroll-smooth pb-1"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {regularCollections.map((collection) => (
                  <div key={collection._id} className="w-56 shrink-0">
                    <CollectionCard collection={collection} size="large" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <TopNftsSection nfts={topNfts} />
      <LatestListingsSection nfts={latestNfts} />

      {/*Launchpad banner*/}
      <section className="container mx-auto px-4 apply-banner rounded-2xl overflow-hidden relative mt-80 mb-28">
        {/* Left content */}
        <div className="flex items-center justify-between px-12 py-10">
          <div className="flex flex-col gap-3 z-10">
            <p className="text-xs text-blue-200 uppercase tracking-widest flex items-center gap-1">
              Mintora NFT Launchpad
            </p>
            <h2 className="text-3xl font-bold text-white leading-snug">
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

      <footer className="border-t border-border py-6 px-8 flex items-center justify-between text-sm text-muted-foreground">
        <div>© 2026 Mintora. All rights reserved.</div>
        <div className="flex gap-6">
          <a href="#" target="_blank" className="hover:text-foreground transition">FAQ</a>
          <a href="#" target="_blank" className="hover:text-foreground transition">Terms of Use</a>
          <a href="https://github.com/Nabilislam722" target="_blank" className="hover:text-foreground transition">Team</a>
          <a href="#" target="_blank" className="hover:text-foreground transition">Careers</a>
        </div>
      </footer>
    </div>
  );
}