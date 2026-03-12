import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";

export default function CollectionRow({ collection, rank }) {
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
      data-testid={`row-collection-${collection.id}`}
    >
        <span className="w-6 text-center text-muted-foreground text-sm">{rank}</span>
        
        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10">
          <img
            src={collection.logoUrl}
            alt={collection.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-medium truncate">{collection.name}</span>
            {collection.isVerified && (
              <CheckCircle2 className="w-4 h-4 text-blue-400 fill-blue-400 flex-shrink-0" />
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-medium">{collection.floorPrice} <span className="text-muted-foreground">RON</span></p>
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted-foreground">Volume</p>
          <p className="text-sm font-medium">{collection.volume}</p>
        </div>

        <div className="text-right hidden md:block">
          <p className="text-xs text-muted-foreground">Sales</p>
          <p className="text-sm font-medium">{collection.sales}</p>
        </div>
    </Link>
  );
}
