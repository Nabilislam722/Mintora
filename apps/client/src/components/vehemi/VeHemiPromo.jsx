import { Link } from "wouter";
import { ArrowRight, ChevronRight, Clock, Scale, Sparkles, TrendingDown } from "lucide-react";
import hemiLogo from "/hemi.svg";
import { Button } from "@/components/ui/button";
import VeHemiPrice from "@/components/vehemi/VeHemiPrice";
import { useVeHemiListings } from "@/hooks/use-vehemi";
import { discountOf, fmt, timeLeft, weightOf } from "@/lib/vehemi";

function DealCard({ listing }) {
  return (
    <Link
      href={`/vehemi/${listing.id}`}
      className="snap-start shrink-0 w-56 sm:w-auto rounded-2xl border border-border/60 bg-background/60 p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/50"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <img src={hemiLogo} alt="" className="w-5 h-5" /> veHEMI #{listing.id}
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <TrendingDown className="w-3 h-3" /> {discountOf(listing)}%
        </span>
      </div>
      <p className="text-xl font-display font-bold tabular-nums">
        {fmt(listing.hemi)} <span className="text-xs font-normal text-muted-foreground">HEMI</span>
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-primary tabular-nums">
        <Scale className="w-3 h-3" /> {fmt(weightOf(listing))} weight
      </p>
      <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" /> {timeLeft(listing.left)}
        </span>
        <VeHemiPrice listing={listing} className="text-sm" />
      </div>
    </Link>
  );
}

// Home page teaser for the veHEMI marketplace: pitch, quick stats and the best current deals
export default function VeHemiPromo() {
  const listings = useVeHemiListings();
  if (!listings.length) return null;

  const deals = [...listings].sort((a, b) => discountOf(b) - discountOf(a)).slice(0, 3);
  const avgDiscount = Math.round(listings.reduce((s, l) => s + discountOf(l), 0) / listings.length);
  const totalHemi = listings.reduce((s, l) => s + l.hemi, 0);
  const stats = [
    ["Listed", listings.length],
    ["Avg. discount", `${avgDiscount}%`],
    ["HEMI locked", `${fmt(totalHemi / 1e6, 2)}M`],
  ];

  return (
    <section className="container mx-auto px-4">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <img src={hemiLogo} alt="" className="w-5 h-5" />
          <h2 className="text-lg font-display font-bold text-foreground opacity-80">veHEMI</h2>
        </div>
        <Link href="/vehemi">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            View all <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/60 p-5 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-28 -left-20 w-80 h-80 rounded-full bg-primary/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 right-0 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/30">
              <Sparkles className="w-3 h-3" /> New on Mintora
            </span>
            <h2 className="mt-4 text-2xl sm:text-4xl font-display font-bold leading-tight">
              Buy locked HEMI{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">below its value</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-md">
              veHEMI positions carry voting weight and staking rewards. Pick one up at a discount, or sell yours without
              waiting for the unlock.
            </p>

            <dl className="mt-6 grid grid-cols-3 gap-3 max-w-md">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <Link
              href="/vehemi"
              className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-2xl bg-primary hover:bg-primary/80 text-white font-semibold transition-colors"
            >
              Explore veHEMI <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Best deals right now</p>
            <div className="flex sm:grid sm:grid-cols-3 gap-3 overflow-x-auto snap-x pb-1 [scrollbar-width:none]">
              {deals.map((l) => (
                <DealCard key={l.id} listing={l} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
