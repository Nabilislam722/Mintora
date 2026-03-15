import { Link } from "wouter";
import { BadgeCheck } from "lucide-react";

export default function CollectionCard({ collection, size = "default" }) {
  const sizeClasses = {
    small: "h-20",
    default: "h-32",
    large: "h-36",
  };

  return (
    <Link href={`/collections/${collection.slug}`} className="block group" data-testid={`card-collection-${collection.id}`}>
      <div className="relative rounded-xl overflow-hidden bg-card border border-border transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-lg">
        <div className={`${sizeClasses[size]} overflow-hidden`}>
          <img
            src={collection.bannerUrl}
            alt={collection.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 "
            loading="lazy"
          />
        </div>
        
        <div className="relative px-3 pb-3">
          <div className="absolute -top-6 left-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-card bg-card">
              <img
                src={collection.logoUrl}
                alt={collection.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          <div className="pt-8">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-display font-bold text-sm truncate">{collection.name}</h3>
              {collection.isVerified && (
                <BadgeCheck  className="w-5 h-5 text-blue-400 flex-shrink-0" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Floor</p>
                <p className="font-semibold">{collection.floorPrice} <span className="text-muted-foreground">HEMI</span></p>
              </div>
              <div>
                <p className="text-muted-foreground">Volume</p>
                <p className="font-semibold">{collection.volume}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
