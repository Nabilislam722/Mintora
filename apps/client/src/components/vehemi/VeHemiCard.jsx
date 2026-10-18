import { Link } from "wouter";
import { Clock, Scale, TrendingDown } from "lucide-react";
import hemiLogo from "/hemi.svg";
import VeHemiPrice from "@/components/vehemi/VeHemiPrice";
import { CURRENCIES, discountOf, fmt, timeLeft, unlockDate, weightOf } from "@/lib/vehemi";

export default function VeHemiCard({ listing, currency, onBuy }) {
  const pct = discountOf(listing);
  const progress = Math.max(0, Math.min(100, (listing.left / listing.total) * 100));
  return (
    <div className="group relative hover:z-10 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-md p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl">
      <Link href={`/vehemi/${listing.id}`} aria-label={`View veHEMI #${listing.id}`} className="absolute inset-0 rounded-2xl" />
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <img src={hemiLogo} alt="hemi" />
          </div>
          <span className="font-display font-bold text-sm">veHEMI #{listing.id}</span>
        </div>
        {pct > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingDown className="w-3 h-3" /> {pct}% off
          </span>
        )}
      </div>

      <p className="text-3xl font-display font-bold tabular-nums mb-3">
        {fmt(listing.hemi)} <span className="text-sm font-normal text-muted-foreground">HEMI</span>
      </p>
      <div className="flex w-fit items-center gap-2 mb-7 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30">
        <Scale className="w-5 h-5 text-primary" />
        <span className="font-display font-bold tabular-nums text-primary">{fmt(weightOf(listing))}</span>
        <span className="text-xs text-muted-foreground">veHEMI weight</span>
      </div>

      <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-2">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {timeLeft(listing.left)} left</span>
        <span>Unlocks {unlockDate(listing.left)}</span>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-secondary/40 border border-white/5 px-3 py-2.5">
        <div>
          <p className="text-[11px] text-muted-foreground">Price</p>
          <VeHemiPrice listing={listing} currency={currency} className="text-sm" />
          <VeHemiPrice
            listing={listing}
            currency={CURRENCIES.find((c) => c !== currency)}
            className="block text-[11px] font-normal text-muted-foreground"
          />
        </div>
        <button
          type="button"
          onClick={() => onBuy(listing)}
          className="relative z-10 h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
        >
          Buy
        </button>
      </div>

      {/* Tab that slides out from under the card on hover; clipped by its wrapper while hidden.
          While hovered its gradient flows continuously and a white shine sweeps across it. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-full h-5 overflow-hidden">
        <Link
          href={`/vehemi/${listing.id}`}
          tabIndex={-1}
          className="relative flex h-full items-center tracking-wider justify-center overflow-hidden rounded-b-xl bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] text-[11px] font-semibold text-foreground -translate-y-full transition-transform duration-1000 ease-out group-hover:translate-y-0 group-hover:pointer-events-auto group-hover:animate-gradient-flow motion-reduce:!animate-none"
        >
          <span className="absolute inset-y-0 left-0 w-1/5 -translate-x-full bg-gradient-to-r from-transparent via-white/80 to-transparent group-hover:animate-shine motion-reduce:hidden" />
          <span className="relative">Click for more details…</span>
        </Link>
      </div>
    </div>
  );
}
