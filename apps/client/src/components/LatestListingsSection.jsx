import { useState } from "react";
import { ChevronDown } from "lucide-react";
import NftCard from "./NftCard";
import { MdOutlineFiberNew, MdHistory } from "react-icons/md";
import { Link } from "wouter";

const PAGE_SIZE = 12;

export default function LatestListingsSection({ nfts }) {
  const [showAll, setShowAll] = useState(false);

  const visibleNfts = showAll ? nfts : nfts.slice(0, PAGE_SIZE);
  const hasMore = nfts.length > PAGE_SIZE;

  return (
    <section className="container mx-auto px-4">

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <MdOutlineFiberNew className="w-8 h-8 text-green-500" />
          <h2 className="text-lg text-foreground font-display font-bold opacity-70">Latest Listing</h2>
        </div>
        <div className="flex text-xs items-center gap-4">
          <span className=" text-muted-foreground">{nfts.length} items</span>

          <Link href="/activity" className="flex text-green-500 items-center gap-1 p-1 hover:bg-white/10 rounded-lg cursor-pointer transition-all duration-200">
            <MdHistory size={17} /> <span>Activity</span>
          </Link>

        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {visibleNfts.map((nft) => (
          <NftCard key={nft._id} nft={nft} size="horizontal" />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setShowAll(prev => !prev)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showAll ? "rotate-180" : ""}`} />
            {showAll ? "Show less" : `Show all ${nfts.length} listings`}
          </button>
        </div>
      )}

    </section>
  );
}