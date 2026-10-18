import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Clock, Lock, Scale, Unlock } from "lucide-react";
import hemiLogo from "/hemi.svg";
import VeHemiPrice from "@/components/vehemi/VeHemiPrice";
import VeHemiListDialog from "@/components/vehemi/VeHemiListDialog";
import { useVeHemiListings } from "@/hooks/use-vehemi";
import { useVeHemiPositions } from "@/hooks/use-vehemi-positions";
import { VE_HEMI_CONTRACT, fmt, timeLeft } from "@/lib/vehemi";

const badgeCls = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border";
const cardCls =
  "group text-left snap-start shrink-0 w-64 sm:w-auto rounded-2xl border border-border/50 bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl";

function PositionCard({ position: p, listing, isOwnProfile, onList }) {
  const daysLeft = Math.max(0, Math.ceil((p.end - Date.now()) / 864e5));
  const unlocked = daysLeft === 0;
  const listable = p.transferable || unlocked;
  // weight / amount = time left / 4-year max lock, so this is how much of its max weight it still has
  const share = p.hemi > 0 ? Math.min(100, (p.weight / p.hemi) * 100) : 0;
  const unlockDate = new Date(p.end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const badge = listing ? (
    <span className={`${badgeCls} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`}>Listed</span>
  ) : unlocked ? (
    <span className={`${badgeCls} bg-amber-500/10 text-amber-400 border-amber-500/20`}><Unlock className="w-3 h-3" /> Unlocked</span>
  ) : !p.transferable ? (
    <span className={`${badgeCls} bg-secondary/60 text-muted-foreground border-white/10`}><Lock className="w-3 h-3" /> Non-transferable</span>
  ) : (
    <span className={`${badgeCls} bg-secondary/60 text-muted-foreground border-white/10`}>Not listed</span>
  );

  // Buttons inside the card are visual only; the whole card is the click target
  const action = listing ? "View" : isOwnProfile && listable ? "List" : null;

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="flex items-center gap-1.5 text-sm font-display font-bold">
          <img src={hemiLogo} alt="" className="w-6 h-6" /> veHEMI #{p.id}
        </span>
        {badge}
      </div>

      <p className="text-2xl font-display font-bold tabular-nums">
        {fmt(p.hemi)} <span className="text-xs font-normal text-muted-foreground">HEMI</span>
      </p>
      <p className="mt-1 mb-3 flex items-center gap-1 text-xs text-primary tabular-nums">
        <Scale className="w-3.5 h-3.5" /> {fmt(p.weight)} veHEMI weight
      </p>

      <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-2">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${share}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3" /> {unlocked ? "Ready to withdraw" : `${timeLeft(daysLeft)} left`}
        </span>
        <span>{unlocked ? "Unlocked" : "Unlocks"} {unlockDate}</span>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-secondary/40 border border-white/5 px-3 py-2.5">
        <div>
          <p className="text-[11px] text-muted-foreground">Price</p>
          {listing ? (
            <VeHemiPrice listing={listing} className="text-sm" />
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">Not listed</p>
          )}
        </div>
        {action && (
          <span className="h-9 px-4 rounded-lg bg-primary group-hover:bg-primary/90 text-white text-sm font-semibold inline-flex items-center transition-colors">
            {action}
          </span>
        )}
      </div>
    </>
  );

  if (listing) return <Link href={`/vehemi/${listing.id}`} className={cardCls}>{body}</Link>;
  if (isOwnProfile) return <button type="button" onClick={() => onList(p)} className={cardCls}>{body}</button>;
  return (
    <a href={`https://explorer.hemi.xyz/token/${VE_HEMI_CONTRACT}/instance/${p.id}`} target="_blank" rel="noopener noreferrer" className={cardCls}>
      {body}
    </a>
  );
}

// veHEMI positions held by this wallet; renders nothing for wallets without any.
// On your own profile, clicking an unlisted position opens the listing dialog.
export default function ProfileVeHemi({ address, isOwnProfile }) {
  const { count, positions, loading } = useVeHemiPositions(address);
  const listings = useVeHemiListings();
  const listingById = useMemo(() => new Map(listings.map((l) => [l.id, l])), [listings]);
  const [listing, setListing] = useState(null);
  if (!count) return null;

  const totals = [
    ["HEMI locked", positions?.reduce((s, p) => s + p.hemi, 0)],
    ["Voting weight", positions?.reduce((s, p) => s + p.weight, 0)],
  ];

  return (
    <section className="container mx-auto px-4 sm:pr-12 mt-12">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <img src={hemiLogo} alt="" className="w-10 h-10" />
            <div>
              <h2 className="text-lg font-display font-bold">
                veHEMI positions <span className="ml-1 text-sm font-normal text-muted-foreground tabular-nums">{count}</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {isOwnProfile ? "Your locked HEMI · click a position to list it for sale" : "Locked HEMI held by this wallet"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <dl className="flex gap-6">
              {totals.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value == null ? "—" : fmt(value)}</dd>
                </div>
              ))}
            </dl>
            <Link
              href="/vehemi"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
            >
              veHEMI market <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-x-auto snap-x pt-1 pb-2 [scrollbar-width:none]">
          {loading
            ? Array.from({ length: Math.min(count, 4) }, (_, i) => (
                <div key={i} className="shrink-0 w-64 sm:w-auto h-64 rounded-2xl bg-secondary/40 animate-pulse" />
              ))
            : positions.map((p) => (
                <PositionCard key={p.id} position={p} listing={listingById.get(p.id)} isOwnProfile={isOwnProfile} onList={setListing} />
              ))}
        </div>
        {positions && count > positions.length && (
          <p className="mt-3 text-[11px] text-muted-foreground">Showing {positions.length} of {count} positions</p>
        )}
      </div>

      <AnimatePresence>
        {listing && <VeHemiListDialog position={listing} onClose={() => setListing(null)} />}
      </AnimatePresence>
    </section>
  );
}
