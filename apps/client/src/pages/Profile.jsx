import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useLocation, useParams } from "wouter";
import { isAddress } from "viem";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileHero from "@/components/profile/ProfileHero";
import ActivityFeed from "@/components/ActivityFeed";
import { EmptyState, NftResults, SearchInput, Segmented, ViewToggle, controlCls, tabCls } from "@/components/NftBrowse";
import { NFT_SORTS, isListed, shortAddress } from "@/lib/nft";

const SORTS = {
  recent: { label: "Recently active", fn: null },
  priceAsc: NFT_SORTS.priceAsc,
  priceDesc: NFT_SORTS.priceDesc,
};

const collectionKey = (n) => n.collectionId?._id ?? n.contractAddress;

export default function Profile() {
  const { address: urlAddress } = useParams();
  const { address: walletAddress } = useAccount();
  const { openConnectModal } = useConnectModal();
  const address = urlAddress || walletAddress;

  // Only your own profile (/profile with no address) needs a connected wallet
  if (!address) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto glass rounded-2xl border border-white/10 p-8">
          <Wallet className="w-16 h-16 text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-display font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-muted-foreground mb-6">Connect your wallet to view your NFT collection and manage your profile.</p>
          <Button onClick={openConnectModal} className="bg-primary hover:bg-primary/90 text-black font-semibold rounded-xl">
            <Wallet className="w-4 h-4 mr-2" /> Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  if (!isAddress(address)) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-display font-bold mb-2">Profile not found</h1>
        <p className="text-muted-foreground">"{address}" isn't a valid wallet address.</p>
      </div>
    );
  }

  // Keyed by address so filters reset when you move between profiles
  return (
    <ProfileView
      key={address.toLowerCase()}
      address={address}
      isOwnProfile={address.toLowerCase() === walletAddress?.toLowerCase()}
    />
  );
}

function ProfileView({ address, isOwnProfile }) {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("items");
  const [collection, setCollection] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState("grid");

  const { data: user } = useQuery({
    queryKey: [`${BASE_URL}/api/users/${address}`],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/users/${address}`);
      if (!res.ok) return { username: "", bio: "", profileImageUrl: "", bannerImageUrl: "" };
      return res.json();
    },
  });

  const { data: nfts, isLoading } = useQuery({
    queryKey: [`${BASE_URL}/api/nfts?owner=${address}`],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/nfts?owner=${address}`);
      if (!res.ok) throw new Error("Failed to fetch NFTs");
      return res.json();
    },
  });

  const collections = useMemo(() => {
    const byId = new Map();
    for (const n of nfts ?? []) {
      const id = collectionKey(n);
      const entry = byId.get(id) ?? { id, name: n.collectionId?.name ?? shortAddress(n.contractAddress), count: 0 };
      entry.count++;
      byId.set(id, entry);
    }
    return [...byId.values()].sort((a, b) => b.count - a.count);
  }, [nfts]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    const list = (nfts ?? []).filter(
      (n) =>
        (collection === "all" || collectionKey(n) === collection) &&
        (status === "all" || isListed(n)) &&
        (!q || (n.name ?? "").toLowerCase().includes(q) || String(n.tokenId).includes(q))
    );
    return SORTS[sort].fn ? list.sort(SORTS[sort].fn) : list;
  }, [nfts, collection, status, search, sort]);

  const searching = search.trim();
  const empty = searching ? (
    <EmptyState message={`No items match "${searching}"`} action="Clear search" onAction={() => setSearch("")} />
  ) : status === "listed" ? (
    <EmptyState message="No items listed for sale" action="View all items" onAction={() => setStatus("all")} />
  ) : isOwnProfile ? (
    <EmptyState message="You don't own any NFTs yet" action="Explore collections" onAction={() => navigate("/collections")} />
  ) : (
    <EmptyState message="This wallet doesn't own any NFTs yet" />
  );

  return (
    <div className="pb-20">
      <ProfileHero address={address} user={user} nfts={nfts} isOwnProfile={isOwnProfile} />

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
                  {collections.length > 1 && (
                    <select
                      value={collection}
                      onChange={(e) => setCollection(e.target.value)}
                      aria-label="Collection"
                      className={`${controlCls} px-3 max-w-[14rem]`}
                    >
                      <option value="all">All collections</option>
                      {collections.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}
                    </select>
                  )}
                  <Segmented label="Status" value={status} onChange={setStatus} options={[["all", "All"], ["listed", "Listed"]]} />
                  <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className={`${controlCls} px-3`}>
                    {Object.entries(SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
                  </select>
                  <ViewToggle value={view} onChange={setView} />
                </div>
              </div>
            )}
          </div>

          <TabsContent value="items" className="mt-0">
            <NftResults items={items} loading={isLoading} view={view} empty={empty} />
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <ActivityFeed filter={{ address }} nfts={nfts} showCollection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
