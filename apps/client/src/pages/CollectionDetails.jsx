import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import NftCard from "../components/NftCard";
import { CheckCircle2, ExternalLink, Grid3X3, List, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo } from "react";

export default function CollectionDetails() {
  const { slug } = useParams();
  const [viewMode, setViewMode] = useState("grid");

  const [showListedOnly, setShowListedOnly] = useState(true);

  const { data: collection, isLoading: loadingCol } = useQuery({
    queryKey: [`/api/collections/${slug}`],
  });

  const { data: nfts, isLoading: loadingNfts } = useQuery({
    queryKey: [`/api/nfts?collectionId=${collection?._id}`],
    enabled: !!collection?._id,
  });
  const targetNft = nfts?.find(n => n.tokenId === "173");
  console.log("Debug Token 173:", targetNft);

  const filteredNfts = useMemo(() => {
  if (!nfts) return [];
  if (!showListedOnly) return nfts;
  
  return nfts.filter(nft => {   
    return nft.isListed === true || (nft.price && nft.price !== "0");
  });
}, [nfts, showListedOnly]);

  if (loadingCol) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-display font-bold mb-4">Collection Not Found</h1>
        <p className="text-muted-foreground">The collection you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="pb-20 pr-12">
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img
          src={collection.bannerUrl}
          alt={collection.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-4 -mt-16 relative z-10">
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-background bg-card flex-shrink-0">
            <img
              src={collection.logoUrl}
              alt={collection.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-display font-bold">{collection.name}</h1>
              {collection.isVerified && (
                <CheckCircle2 className="w-6 h-6 text-blue-400 fill-blue-400" />
              )}
            </div>
            <p className="text-muted-foreground mb-4 max-w-2xl">{collection.description}</p>

            <div className="flex flex-wrap gap-6">
              <div className="glass rounded-xl px-4 py-3 border border-white/10">
                <p className="text-xs text-muted-foreground">Floor Price</p>
                <p className="font-bold text-lg">{collection.floorPrice} <span className="text-muted-foreground text-sm">ETH</span></p>
              </div>
              <div className="glass rounded-xl px-4 py-3 border border-white/10">
                <p className="text-xs text-muted-foreground">Volume</p>
                <p className="font-bold text-lg">{collection.volume}</p>
              </div>
              <div className="glass rounded-xl px-4 py-3 border border-white/10">
                <p className="text-xs text-muted-foreground">Sales</p>
                <p className="font-bold text-lg">{collection.sales}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="border-white/10 hover:bg-white/10 rounded-xl" data-testid="button-external-link">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="items" className="w-full">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <TabsList className="glass border border-white/10">
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-4">
              {/* 3. The Toggle Button */}
              <Button
                variant={showListedOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowListedOnly(!showListedOnly)}
                className="gap-2 rounded-xl border-white/10"
              >
                <Tag className="w-4 h-4" />
                {showListedOnly ? "Showing: Listed" : "Showing: All"}
              </Button>

              <div className="h-6 w-[1px] bg-white/10 mx-2" /> {/* Vertical Divider */}

              <div className="flex gap-2">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className="rounded-lg"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className="rounded-lg"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <TabsContent value="items">
            {loadingNfts ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredNfts.length === 0 ? ( // 4. Use filteredNfts length
              <div className="text-center py-16">
                <p className="text-muted-foreground">
                  {showListedOnly
                    ? "No items are currently listed for sale."
                    : "No items in this collection."}
                </p>
                {showListedOnly && (
                  <Button
                    variant="link"
                    onClick={() => setShowListedOnly(false)}
                    className="text-primary"
                  >
                    View all items
                  </Button>
                )}
              </div>
            ) : (
              <div className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                  : "flex flex-col gap-4"
              }>
                {/* 5. Map over filteredNfts instead of nfts */}
                {filteredNfts.map((nft) => (
                  <NftCard key={nft._id} nft={nft} viewMode={viewMode} />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="activity">
            <div className="glass rounded-xl border border-white/10 p-8 text-center">
              <p className="text-muted-foreground">Activity data coming soon</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

