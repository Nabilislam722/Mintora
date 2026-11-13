import { Link } from "wouter";
import hemiLogo from "/hemi.svg";
import { Card } from "@/components/ui/card";
import VeHemiDiscount from "@/components/vehemi/VeHemiDiscount";
import { VeHemiUsd } from "@/components/vehemi/VeHemiPrice";
import { useHoverGlow } from "@/hooks/use-hover-glow";
import { discountOf, fmt, timeLeft } from "@/lib/vehemi";

// A veHEMI listing as a horizontal card, matching NftCard's horizontal size
export default function VeHemiListingCard({ listing }) {
  const glow = useHoverGlow("rgba(255,255,255,0.08)");
  const pct = discountOf(listing);

  return (
    <Link href={`/vehemi/${listing.id}`} className="block group">
      <div {...glow} className="relative p-[1px] rounded-2xl transition-transform duration-300 group-hover:-translate-y-0.5">
        <Card className="relative bg-card/90 backdrop-blur-xl border-none overflow-hidden rounded-2xl h-full z-10">
          <div className="flex items-center gap-4 p-3">
            <div className="w-20 h-20 rounded-xl shrink-0 flex items-center justify-center bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/20">
              <img src={hemiLogo} alt="" className="w-10 h-10 transition-transform duration-500 group-hover:scale-110" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                veHEMI {pct !== 0 && <VeHemiDiscount pct={pct} suffix={pct > 0 ? " off" : ""} size="xs" />}
              </p>
              <h3 className="font-display font-bold text-base truncate text-foreground leading-tight mb-1">
                {fmt(listing.hemi)} HEMI locked
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                #{listing.id} · {timeLeft(listing.left)} left
              </span>
            </div>

            <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Price</p>
              <p className="font-bold text-primary text-base font-mono">{fmt(listing.price)} HEMI</p>
              <VeHemiUsd amount={listing.price} className="text-[11px] text-muted-foreground font-mono" />
            </div>
          </div>
        </Card>
      </div>
    </Link>
  );
}
