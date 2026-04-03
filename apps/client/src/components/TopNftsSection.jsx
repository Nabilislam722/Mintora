import { useState } from "react";
import { AlignStartHorizontal } from "lucide-react";
import { NftControls, NftViewContent } from "./NftViewContent";

export default function TopNftsSection({ nfts }) {
  const [timeFilter, setTimeFilter] = useState("24h");
  const [nftView, setNftView] = useState("grid");

  return (
    <section className="container mx-auto px-4">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <AlignStartHorizontal className="w-5 h-5 text-orange-500" strokeWidth={2} />
          <h2 className="text-lg font-display font-bold text-foreground opacity-70">Top NFTs</h2>
        </div>
        <NftControls timeFilter={timeFilter} setTimeFilter={setTimeFilter} nftView={nftView} setNftView={setNftView} />
      </div>
      <NftViewContent nfts={nfts} nftView={nftView} />
    </section>
  );
}