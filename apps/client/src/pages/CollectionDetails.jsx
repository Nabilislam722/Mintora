import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CollectionHero from "@/components/collection/CollectionHero";
import ActivityFeed from "@/components/ActivityFeed";
import { EmptyState, NftResults, SearchInput, Segmented, ViewToggle, controlCls, tabCls } from "@/components/NftBrowse";
import { NFT_SORTS, isListed } from "@/lib/nft";

export default function CollectionDetails() {
  const { slug } = useParams();
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const [tab, setTab] = useState("items");
  const [status, setStatus] = useState("listed");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("priceAsc");
  const [view, setView] = useState("grid");

  const { data: collection, isLoading: loadingCol } = useQuery({
    queryKey: [`${BASE_URL}/api/collections/${slug}`],
  });

  const { data: nfts, isLoading: loadingNfts } = useQuery({
    queryKey: [`${BASE_URL}/api/nfts?collectionId=${collection?._id}`],
    enabled: !!collection?._id,
  });

  const items = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    return (nfts ?? [])
      .filter((n) => status === "all" || isListed(n))
      .filter((n) => !q || (n.name ?? "").toLowerCase().includes(q) || String(n.tokenId).includes(q))
      .sort(NFT_SORTS[sort].fn);
  }, [nfts, status, search, sort]);

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

  const searching = search.trim();

  return (
    <div className="pb-20">
      <CollectionHero collection={collection} nfts={nfts} />

      <div className="container mx-auto px-4 sm:pr-12 mt-8">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="md:sticky md:top-16 z-20 -mx-4 px-4 py-3 mb-5 bg-background/80 backdrop-blur-md flex flex-col lg:flex-row lg:items-center gap-3">
            <TabsList className="h-10 p-1 w-fit rounded-full bg-secondary/50 border border-white/10">
              <TabsTrigger value="items" className={tabCls}>
                Items
                {nfts && <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{nfts.length.toLocaleString()}</span>}
              </TabsTrigger>
              <TabsTrigger value="activity" className={tabCls}>Activity</TabsTrigger>
            </TabsList>

            {tab === "items" && (
              <div className="flex flex-wrap items-center gap-2 lg:flex-1">
                <SearchInput value={search} onChange={setSearch} placeholder="Search by name or #ID" />
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  <Segmented label="Status" value={status} onChange={setStatus} options={[["listed", "Listed"], ["all", "All"]]} />
                  <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className={`${controlCls} px-3`}>
                    {Object.entries(NFT_SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
                  </select>
                  <ViewToggle value={view} onChange={setView} />
                </div>
              </div>
            )}
          </div>

          <TabsContent value="items" className="mt-0">
            <NftResults
              items={items}
              loading={loadingNfts}
              view={view}
              empty={
                <EmptyState
                  message={
                    searching
                      ? `No items match "${searching}"`
                      : status === "listed"
                        ? "No items are listed for sale right now"
                        : "No items in this collection yet"
                  }
                  action={searching ? "Clear search" : status === "listed" ? "View all items" : null}
                  onAction={() => (searching ? setSearch("") : setStatus("all"))}
                />
              }
            />
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <ActivityFeed filter={{ collection: collection.contractAddress }} nfts={nfts} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
