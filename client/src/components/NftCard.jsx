import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { formatEther } from "viem";

export default function NftCard({ nft, size = "default" }) {
  const sizeClasses = {
    small: "aspect-[4/5]",
    default: "aspect-square",
    large: "aspect-[3/4]",
  };

  return (
    <Link href={`/nfts/${nft.collectionId?._id}/${nft.tokenId}`} className="block group" data-testid={`card-nft-${nft.id}`}>
      <div className="relative">
        <div className="absolute -inset-[1px] bg-gradient-to-r from-primary to-accent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />

        <Card className="relative bg-card border-border overflow-hidden rounded-xl h-full transition-transform duration-300 group-hover:-translate-y-1">
          <div className={`${sizeClasses[size]} overflow-hidden bg-secondary/30 relative`}>
            <img
              src={nft.imageUrl}
              alt={nft.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            {!nft.isListed && (
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-medium text-white/80">
                Not Listed
              </div>
            )}
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">
                {nft.collectionId?.name || "Unknown"}
              </span>
              <span className="text-xs text-muted-foreground flex-shrink-0">#{nft.tokenId}</span>
            </div>

            <h3 className="font-display font-bold text-sm mb-2 truncate">{nft.name}</h3>

            <div className="flex items-center justify-between gap-2 bg-secondary/50 p-2 rounded-lg">
              <span className="text-xs text-muted-foreground">Price</span>
              <span className="font-bold text-primary text-sm">
                {nft.price
                  ? `${formatEther(BigInt(nft.price))} ETH`
                  : 'Unlisted'}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </Link>
  );
}
