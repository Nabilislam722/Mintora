import { useQuery } from "@tanstack/react-query";
import FeaturedCarousel from "../components/FeaturedCarousel";
import CollectionCard from "../components/CollectionCard";
import NftCard from "../components/NftCard";
import { LayoutGrid, TrendingUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState } from "react";

export default function Home() {
  const [timeFilter, setTimeFilter] = useState("24h");

  const { data: collections = [], isLoading: loadingCols } = useQuery({
    queryKey: ["/api/collections"],
  });

  const { data: nfts = [], isLoading: loadingNfts } = useQuery({
    queryKey: ["/api/featurednft?limit=8"],
  });


  const displayCollections = collections.slice(0, 6);
  const topNfts = nfts;


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

      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-display font-bold">Collections</h2>
          </div>
          <Link href="/collections">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="link-view-all-collections">
              View all <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {displayCollections.map((collection) => (
            <CollectionCard key={collection._id} collection={collection} size="small" />

          ))}
        </div>
      </section>

      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-display font-bold">Top NFTs</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-secondary rounded-lg overflow-hidden">
              {["24h", "7d", "30d"].map((period) => (
                <button
                  key={period}
                  onClick={() => setTimeFilter(period)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${timeFilter === period ? "bg-primary text-primary-foreground" : "hover:bg-secondary-foreground/10"
                    }`}
                  data-testid={`button-filter-${period}`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {topNfts.map((nft, idx) => (
            <NftCard key={nft._id} nft={nft} size="small" />
          ))}
        </div>
      </section>
    </div>
  );
}
