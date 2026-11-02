import { Link } from "wouter";
import { BadgeCheck, BadgeAlert } from "lucide-react";
import { useRef, useState } from "react";

const fmtEth = (v) => {
  const n = Number(v);
  return n > 0 ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : null;
};

// Plain CSS tooltip: Radix popups are mispositioned by html { zoom: 0.85 } in index.css
export function VerifiedBadge({ verified }) {
  return (
    <span
      role="img"
      aria-label={verified ? "Verified by the Mintora team" : "Not verified"}
      className="group/badge relative inline-flex shrink-0"
    >
      {verified ? (
        <BadgeCheck className="w-5 h-5 fill-blue-500 text-white" />
      ) : (
        <BadgeAlert className="w-5 h-5 fill-muted-foreground/30 text-muted-foreground" />
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[12rem] -translate-x-1/2 translate-y-1 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-popover-foreground opacity-0 shadow-lg transition-all duration-200 group-hover/badge:translate-y-0 group-hover/badge:opacity-100"
      >
        {verified ? "This collection has been verified by Mintora team!" : "This collection hasn't been verified yet"}
      </span>
    </span>
  );
}

export default function CollectionCard({ collection, size = "default" }) {
  const cardRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const sizeClasses = {
    small: "h-20",
    default: "h-32",
    large: "h-36",
  };

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 180;
    const y = ((e.clientY - rect.top) / rect.height) * 180;
    setMousePos({ x, y });
  };

  const floor = fmtEth(collection.floorPrice);
  const volume = fmtEth(collection.volume);
  const stats = [
    ["Floor", floor],
    ["Volume", volume],
  ];

  return (
    <Link href={`/collections/${collection.slug}`} className="block group relative hover:z-20" data-testid={`card-collection-${collection.id}`}>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative p-[1px] rounded-2xl transition-transform duration-300 group-hover:-translate-y-0.5"
        style={{
          background: isHovered
            ? `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(59,130,246,0.5), rgba(13,160,74,1), transparent 70%)`
            : "rgba(255,255,255,0.1)",
        }}
      >
        {/* Only the banner clips, so the badge tooltip can extend past the card */}
        <div className="relative rounded-2xl bg-card border border-border transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-lg">
          <div className={`${sizeClasses[size]} relative overflow-hidden rounded-t-2xl`}>
            <img
              src={collection.bannerUrl}
              alt={collection.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
          </div>

          <div className="relative px-3 pb-3">
            <div className="absolute -top-7 left-3">
              <div className="w-14 h-14 rounded-2xl overflow-hidden ring-4 ring-card bg-card shadow-lg">
                <img src={collection.logoUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            </div>

            <div className="pt-9">
              <div className="flex items-center gap-1.5 mb-3 min-w-0">
                <h3 className="font-display font-bold text-[15px] truncate">{collection.name}</h3>
                <VerifiedBadge verified={collection.isVerified} />
              </div>

              <div className="grid grid-cols-2 divide-x divide-white/5 rounded-xl bg-secondary/40 border border-white/5 text-xs">
                {stats.map(([label, value]) => (
                  <div key={label} className="px-2.5 py-2 min-w-0">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="font-semibold tabular-nums truncate">
                      {value ?? "—"} {value && <span className="font-normal text-muted-foreground">ETH</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
