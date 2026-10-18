import { useState } from "react";
import { Link, useParams } from "wouter";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, ExternalLink, Info, Scale, ShoppingCart, TrendingDown } from "lucide-react";
import hemiLogo from "/hemi.svg";
import VeHemiBackdrop from "@/components/vehemi/VeHemiBackdrop";
import VeHemiPrice from "@/components/vehemi/VeHemiPrice";
import VeHemiWeightChart from "@/components/vehemi/VeHemiWeightChart";
import VeHemiBuyDialog from "@/components/vehemi/VeHemiBuyDialog";
import { useVeHemiListing } from "@/hooks/use-vehemi";
import { CURRENCIES, VE_HEMI_CONTRACT, discountOf, fmt, priceIn, timeLeft, unlockDate, weightOf } from "@/lib/vehemi";

const panelCls = "rounded-2xl border border-border/50 bg-card/50 backdrop-blur-md p-5";

function DetailRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}

export default function VeHemiDetails() {
  const { id } = useParams();
  const listing = useVeHemiListing(id);
  const [buying, setBuying] = useState(false);

  if (!listing) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Listing not found</h1>
        <Link href="/vehemi" className="text-sm text-primary hover:underline">Back to all veHEMI listings</Link>
      </div>
    );
  }

  const pct = discountOf(listing);
  const weight = weightOf(listing);
  const progress = Math.max(0, Math.min(100, (listing.left / listing.total) * 100));
  const estimate = listing.currency !== "HEMI" ? "≈ " : "";
  const lockedValue = priceIn({ price: listing.hemi, currency: "HEMI" }, listing.currency);

  const stats = [
    ["HEMI locked", fmt(listing.hemi)],
    ["Time left", timeLeft(listing.left)],
    ["Unlocks", unlockDate(listing.left)],
  ];
  const breakdown = [
    ["Locked value", `${estimate}${fmt(lockedValue)} ${listing.currency}`],
    ["Price per HEMI", `${fmt(listing.price / listing.hemi, 4)} ${listing.currency}`],
    ["Price per veHEMI weight", `${fmt(listing.price / weight, 4)} ${listing.currency}`],
  ];

  return (
    <div className="sm:pr-12">
      <VeHemiBackdrop />
      <div className="container relative z-10 mx-auto px-4 py-6 flex flex-col gap-6">
        <Link href="/vehemi" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> All listings
        </Link>

        <header className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <img src={hemiLogo} alt="hemi" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-display font-bold leading-tight">veHEMI #{listing.id}</h1>
              {pct > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <TrendingDown className="w-3 h-3" /> {pct}% off
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Locked HEMI position · unlocks {unlockDate(listing.left)}</p>
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          {/* Position */}
          <section className={`${panelCls} lg:col-start-1`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="col-span-2 sm:col-span-1 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2.5">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground mb-0.5">
                  <Scale className="w-3 h-3 text-primary" /> veHEMI weight
                </p>
                <p className="text-xl font-display font-bold tabular-nums text-primary">{fmt(weight)}</p>
              </div>
              {stats.map(([label, value]) => (
                <div key={label} className="px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-xl font-display font-bold tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-2">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Locked {unlockDate(listing.left - listing.total)}</span>
              <span>{timeLeft(listing.total)} lock · {Math.round(progress)}% remaining</span>
            </div>
          </section>

          {/* Buy */}
          <aside className={`${panelCls} lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:sticky lg:top-24 flex flex-col gap-5`}>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Price</p>
              <VeHemiPrice listing={listing} className="text-3xl font-display" />
              <VeHemiPrice
                listing={listing}
                currency={CURRENCIES.find((c) => c !== listing.currency)}
                className="block text-sm font-normal text-muted-foreground"
              />
            </div>

            <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5">
              {breakdown.map(([label, value]) => (
                <DetailRow key={label} label={label}><span className="tabular-nums">{value}</span></DetailRow>
              ))}
              <DetailRow label="Discount">
                <span className="text-emerald-400">{pct}%</span>
              </DetailRow>
            </div>

            <button
              type="button"
              onClick={() => setBuying(true)}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" /> Buy now
            </button>
            <p className="-mt-3 text-[11px] text-muted-foreground text-center">
              Paid in {listing.currency} · approve, then buy
            </p>

            <div className="flex gap-2.5 rounded-xl border border-white/10 bg-secondary/30 p-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 text-primary" />
              <p>
                The HEMI stays locked until {unlockDate(listing.left)} and can't be withdrawn early. Once you buy, the
                position's voting power moves to you, or to the delegate you've set on Hemi.
              </p>
            </div>
          </aside>

          {/* Weight */}
          <section className={`${panelCls} lg:col-start-1`}>
            <h2 className="font-display font-bold">Voting weight until unlock</h2>
            <p className="text-xs text-muted-foreground mb-5">
              Weight falls in a straight line to 0 at unlock. Hover the chart to see it on any date.
            </p>
            <VeHemiWeightChart weight={weight} days={listing.left} />
          </section>

          {/* Chain info */}
          <section className={`${panelCls} lg:col-start-1`}>
            <h2 className="font-display font-bold mb-3">Details</h2>
            <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5">
              <DetailRow label="Token ID">#{listing.id}</DetailRow>
              <DetailRow label="Contract">
                <a
                  href={`https://explorer.hemi.xyz/token/${VE_HEMI_CONTRACT}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                >
                  {VE_HEMI_CONTRACT.slice(0, 6)}…{VE_HEMI_CONTRACT.slice(-4)} <ExternalLink className="w-3 h-3" />
                </a>
              </DetailRow>
              <DetailRow label="Network">Hemi</DetailRow>
              <DetailRow label="Payment token">{listing.currency}</DetailRow>
              <DetailRow label="Owner">
                <a
                  href={`https://explorer.hemi.xyz/token/owner`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                >owner</a>
              </DetailRow>
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {buying && <VeHemiBuyDialog listing={listing} onClose={() => setBuying(false)} />}
      </AnimatePresence>
    </div>
  );
}
