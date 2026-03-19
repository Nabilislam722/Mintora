import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { formatEther } from "viem";
import { useRef, useState } from "react";

export default function NftCard({ nft, size = "default" }) {
  const cardRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 180;
    const y = ((e.clientY - rect.top) / rect.height) * 180;
    setMousePos({ x, y });
  };

  const sizeClasses = {
    small: "aspect-[3.5/4]",
    default: "aspect-square",
    large: "aspect-[3/4]",
  };

  // Horizontal / feed layout
  if (size === "horizontal") {
    return (
      <Link href={`/nfts/${nft.collectionId?._id}/${nft.tokenId}`} className="block group">
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative p-[1px] rounded-2xl transition-transform duration-300 group-hover:-translate-y-0.5"
          style={{
            background: isHovered
              ? `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(59,130,246,0.5), rgba(13,160,74,1), transparent 70%)`
              : "rgba(255,255,255,0.08)",
          }}
        >
          <Card className="relative bg-card/90 backdrop-blur-xl border-none overflow-hidden rounded-2xl h-full z-10">
            <div className="flex items-center gap-4 p-3">

              {/* Thumbnail */}
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-secondary/30">
                <img
                  src={nft.imageUrl}
                  alt={nft.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate mb-1">
                  {nft.collectionId?.name || "Unknown"}
                </p>
                <h3 className="font-display font-bold text-base truncate text-foreground leading-tight mb-1">
                  {nft.name}
                </h3>
                <span className="text-xs text-muted-foreground font-mono">#{nft.tokenId}</span>
              </div>

              {/* Price + status */}
              <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                {nft.isListed ? (
                  <>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Price</p>
                    <p className="font-bold text-primary text-base font-mono">
                      {nft.price ? `${parseFloat(formatEther(BigInt(nft.price))).toFixed(3)} ETH` : "—"}
                    </p>
                  </>
                ) : (
                  <span className="text-xs text-white/30 font-medium px-2 py-1 bg-white/5 rounded-lg">
                    Not Listed
                  </span>
                )}
              </div>

            </div>
          </Card>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/nfts/${nft.collectionId?._id}/${nft.tokenId}`} className="block group">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative p-[1px] rounded-xl transition-transform duration-600 group-hover:-translate-y-2"
        style={{
          background: isHovered
            ? `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(59, 130, 246, 0.5), rgba(13, 160, 74, 1), transparent 70%)`
            : "rgba(255, 255, 255, 0.1)",
        }}
      >
        <Card className="relative bg-card/90 backdrop-blur-xl border-none overflow-hidden rounded-xl h-full z-10">
          <div className={`${sizeClasses[size]} overflow-hidden bg-secondary/30 relative`}>
            <img
              src={nft.imageUrl}
              alt={nft.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            {!nft.isListed && (
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-medium text-white/80">
                Not Listed
              </div>
            )}
          </div>

          <div className="p-3 relative z-20">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">
                {nft.collectionId?.name || "Unknown"}
              </span>
              <span className="text-xs text-muted-foreground flex-shrink-0">#{nft.tokenId}</span>
            </div>
            <h3 className="font-display font-bold text-sm mb-2 truncate text-foreground">{nft.name}</h3>
            <div className="flex items-center justify-between gap-2 bg-white/5 backdrop-blur-md p-2 rounded-lg border border-white/5">
              <span className="text-xs text-muted-foreground">Price</span>
              <span className="font-bold text-primary text-sm">
                {nft.price ? `${formatEther(BigInt(nft.price))} ETH` : "Unlisted"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </Link>
  );
}