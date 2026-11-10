import { useState } from "react";
import { PiAlignTopFill } from "react-icons/pi";
import { NftControls, NftViewContent } from "./NftViewContent";
import NftCard from "./NftCard";
import ScrollRow from "./ScrollRow";
import { useGridColumns, columnWidth } from "@/hooks/use-grid-columns";

// Top NFTs as one row that scrolls sideways (or as the ranked list). `timeFilter` (24h, 7d, 30d) belongs to
// the page, which fetches the NFTs for it.
export default function TopNftsSection({ nfts, timeFilter, setTimeFilter }) {
  const [nftView, setNftView] = useState("grid");
  const width = columnWidth(useGridColumns());

  return (
    <section className="container mx-auto px-4">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <PiAlignTopFill className="w-6 h-6 fill-foreground opacity-70" />
          <h2 className="text-lg font-display font-bold text-foreground opacity-70">Top NFTs</h2>
        </div>
        <NftControls timeFilter={timeFilter} setTimeFilter={setTimeFilter} nftView={nftView} setNftView={setNftView} />
      </div>

      {nfts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No top NFTs right now.</p>
      ) : nftView === "grid" ? (
        <ScrollRow className="nft-grid-enter">
          {nfts.map((nft) => (
            <div key={nft._id} className="shrink-0" style={{ width }}>
              <NftCard nft={nft} size="small" />
            </div>
          ))}
        </ScrollRow>
      ) : (
        <NftViewContent nfts={nfts} nftView="list" />
      )}
    </section>
  );
}
