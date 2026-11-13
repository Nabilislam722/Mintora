import { useState } from "react";
import { Link, useParams } from "wouter";
import { AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { ArrowLeft, ExternalLink, HandCoins, Info, Loader2, Lock, ShoppingCart, Tag } from "lucide-react";
import hemiLogo from "/hemi.svg";
import VeHemiBackdrop from "@/components/vehemi/VeHemiBackdrop";
import VeHemiPrice, { VeHemiUsd } from "@/components/vehemi/VeHemiPrice";
import VeHemiDiscount from "@/components/vehemi/VeHemiDiscount";
import VeHemiWeightChart from "@/components/vehemi/VeHemiWeightChart";
import VeHemiBuyDialog from "@/components/vehemi/VeHemiBuyDialog";
import VeHemiListDialog from "@/components/vehemi/VeHemiListDialog";
import VeHemiOfferDialog from "@/components/vehemi/VeHemiOfferDialog";
import VeHemiOffers from "@/components/vehemi/VeHemiOffers";
import { useVeHemiMarket, useVeHemiOffers, useVeHemiPosition } from "@/hooks/use-vehemi";
import { useTxStep, useVeHemiActions } from "@/hooks/use-vehemi-actions";
import {
  EXPLORER, VE_HEMI_CONTRACT, VE_HEMI_MARKET, discountOf, fmt, formatDate, sameAddress, shortAddress, timeLeft,
} from "@/lib/vehemi";
import { useSeo } from "@/hooks/use-seo";
import { NOT_FOUND_SEO, veHemiSeo } from "@/lib/seo";

const panelCls = "rounded-2xl border border-border/50 bg-card/50 backdrop-blur-md p-5";

function DetailRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}

function ExplorerLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
      {children} <ExternalLink className="w-3 h-3" />
    </a>
  );
}

function Notice({ children }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-white/10 bg-secondary/30 p-3 text-xs text-muted-foreground">
      <Info className="w-4 h-4 shrink-0 text-primary" />
      <p>{children}</p>
    </div>
  );
}

function ActionButton({ onClick, busy = false, secondary = false, icon = null, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`w-full h-12 rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 ${
        secondary ? "border border-white/10 bg-secondary/40 hover:bg-secondary" : "bg-primary hover:bg-primary/90 text-primary-foreground"
      }`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// A veHEMI position's page: the holder lists, reprices and accepts offers; anyone else buys or offers
export default function VeHemiDetails() {
  const { id } = useParams();
  const { address } = useAccount();
  const { data: p, isLoading, error, refetch } = useVeHemiPosition(id);
  const { offers, loading: offersLoading } = useVeHemiOffers(p ? [p.id] : []);
  const { paused } = useVeHemiMarket();
  const actions = useVeHemiActions();
  const { busy, run } = useTxStep();
  const [dialog, setDialog] = useState(null);
  useSeo(!isLoading && !p ? NOT_FOUND_SEO : veHemiSeo(id));

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <div className="h-72 rounded-2xl bg-secondary/40 animate-pulse" />
        <div className="h-96 rounded-2xl bg-secondary/40 animate-pulse" />
      </div>
    );
  }
  if (error || !p) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">{error ? "Couldn't load this position" : "Position not found"}</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {error ? "Hemi's RPC didn't answer. Try again in a moment." : `veHEMI #${id} doesn't exist, or its HEMI was withdrawn.`}
        </p>
        {error && (
          <button type="button" onClick={() => refetch()} className="h-9 px-4 mb-4 rounded-xl border border-white/10 text-sm hover:bg-secondary">Try again</button>
        )}
        <div><Link href="/vehemi" className="text-sm text-primary hover:underline">Back to all veHEMI listings</Link></div>
      </div>
    );
  }

  const listing = p.listing;
  const isHolder = sameAddress(address, p.owner);
  const ended = p.left === 0;
  const inactive =
    !listing && p.storedListing && sameAddress(p.storedListing.seller, p.owner) && p.storedListing.expiry > Date.now();
  const myOffer = offers.find((o) => sameAddress(o.buyer, address));
  const bestOffer = offers.find((o) => o.valid);
  const pct = listing ? discountOf(listing) : 0;
  const progress = p.total > 0 ? Math.max(0, Math.min(100, (p.left / p.total) * 100)) : 0;
  const close = () => setDialog(null);

  const cancelListing = async () => {
    if (await run(() => actions.cancelListing(p.tokenId), "Couldn't cancel the listing")) actions.refresh();
  };

  const stats = [
    ["veHEMI weight", fmt(p.weight)],
    ["Time left", ended ? "Ended" : timeLeft(p.left)],
    [ended ? "Unlocked" : "Unlocks", formatDate(p.end)],
  ];
  const breakdown = listing && [
    ["Locked value", `${fmt(p.hemi)} HEMI`],
    ...(p.lockAmountWei > listing.listedLockAmountWei ? [["Locked when listed", `${fmt(listing.listedHemi)} HEMI`]] : []),
    ["Price per locked HEMI", `${fmt(listing.price / p.hemi, 4)} HEMI`],
    ["Price per veHEMI weight", p.weight > 0 ? `${fmt(listing.price / p.weight, 4)} HEMI` : "—"],
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
              <h1 className="text-2xl sm:text-3xl font-display font-bold leading-tight">veHEMI #{p.id}</h1>
              {pct !== 0 && <VeHemiDiscount pct={pct} suffix={pct > 0 ? " off" : ""} size="md" />}
            </div>
            <p className="text-sm text-muted-foreground">
              Locked HEMI position · {ended ? "unlocked" : "unlocks"} {formatDate(p.end)}
            </p>
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          <section className={`${panelCls} lg:col-start-1`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="col-span-2 sm:col-span-1 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2.5">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground mb-0.5">
                  <Lock className="w-3 h-3 text-primary" /> HEMI locked
                </p>
                <p className="text-xl font-display font-bold tabular-nums text-primary">{fmt(p.hemi)}</p>
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
              <span>Locked {formatDate(p.created)}</span>
              <span>{timeLeft(p.total)} lock · {Math.round(progress)}% remaining</span>
            </div>
          </section>

          <aside className={`${panelCls} lg:col-start-2 lg:row-start-1 lg:row-span-4 lg:sticky lg:top-24 flex flex-col gap-5`}>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{listing ? "Price" : "Status"}</p>
              {listing ? (
                <>
                  <VeHemiPrice listing={listing} className="text-3xl font-display" />
                  <VeHemiUsd amount={listing.price} className="block text-sm text-muted-foreground" />
                </>
              ) : (
                <p className="text-2xl font-display font-bold">Not listed</p>
              )}
              {bestOffer && (
                <button
                  type="button"
                  onClick={() => document.getElementById("offers")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="mt-3 w-full flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-left hover:bg-primary/15 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <HandCoins className="w-3.5 h-3.5 text-primary" /> Best offer
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {fmt(bestOffer.amount)} HEMI{" "}
                    <span className="text-xs font-normal text-primary">{isHolder ? "Review →" : "See offers →"}</span>
                  </span>
                </button>
              )}
            </div>

            {listing && (
              <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5">
                {breakdown.map(([label, value]) => (
                  <DetailRow key={label} label={label}><span className="tabular-nums">{value}</span></DetailRow>
                ))}
                <DetailRow label="Discount"><VeHemiDiscount pct={pct} /></DetailRow>
                <DetailRow label="Listing ends">{formatDate(listing.expiry)}</DetailRow>
              </div>
            )}

            {paused && <Notice>Trading on the veHEMI market is paused right now. Cancelling still works.</Notice>}

            {isHolder ? (
              listing ? (
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton onClick={() => setDialog({ kind: "list", position: p })}>Change price</ActionButton>
                  <ActionButton secondary busy={busy} onClick={cancelListing}>Cancel listing</ActionButton>
                </div>
              ) : inactive ? (
                <>
                  <Notice>
                    Your listing at {fmt(p.storedListing.price)} HEMI isn't active:{" "}
                    {p.approved ? "it no longer matches the position." : "the marketplace isn't approved for this position."}{" "}
                    List again to set a fresh price, or cancel it.
                  </Notice>
                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton onClick={() => setDialog({ kind: "list", position: p })}>List again</ActionButton>
                    <ActionButton secondary busy={busy} onClick={cancelListing}>Cancel listing</ActionButton>
                  </div>
                </>
              ) : !ended && p.transferable ? (
                <ActionButton icon={<Tag className="w-4 h-4" />} onClick={() => setDialog({ kind: "list", position: p })}>
                  List for sale
                </ActionButton>
              ) : (
                <Notice>
                  {ended
                    ? "This lock has ended, so there's nothing locked left to sell. Its HEMI can be withdrawn."
                    : `This position can't be transferred until ${formatDate(p.end)}, so it can't be listed yet.`}
                </Notice>
              )
            ) : ended ? (
              <Notice>This lock has ended, so the position can't be traded.</Notice>
            ) : (
              <div className="flex flex-col gap-2">
                {listing && (
                  <ActionButton icon={<ShoppingCart className="w-4 h-4" />} onClick={() => setDialog({ kind: "buy", listing })}>
                    Buy now
                  </ActionButton>
                )}
                <ActionButton
                  secondary={!!listing}
                  icon={<HandCoins className="w-4 h-4" />}
                  onClick={() => setDialog({ kind: "offer", position: p, myOffer })}
                >
                  {myOffer ? "Change your offer" : "Make an offer"}
                </ActionButton>
                {!p.transferable && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    Not transferable yet: the holder can accept offers once it is.
                  </p>
                )}
              </div>
            )}

            {!isHolder && !ended && (
              <Notice>
                The HEMI stays locked until {formatDate(p.end)} and can't be withdrawn early. Once you buy, the position's
                voting power moves to you, or to the delegate you've set on Hemi.
              </Notice>
            )}
          </aside>

          {!ended && (
            <section className={`${panelCls} lg:col-start-1`}>
              <h2 className="font-display font-bold">Voting weight until unlock</h2>
              <p className="text-xs text-muted-foreground mb-5">
                Weight falls in a straight line to 0 at unlock. Hover the chart to see it on any date.
              </p>
              <VeHemiWeightChart weight={p.weight} days={p.left} />
            </section>
          )}

          <VeHemiOffers position={p} offers={offers} loading={offersLoading} className={`${panelCls} lg:col-start-1`} />

          <section className={`${panelCls} lg:col-start-1`}>
            <h2 className="font-display font-bold mb-3">Details</h2>
            <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5">
              <DetailRow label="Token ID">#{p.id}</DetailRow>
              <DetailRow label="Holder">
                <Link href={`/profile/${p.owner}`} className="font-mono text-xs text-primary hover:underline">
                  {isHolder ? "You" : shortAddress(p.owner)}
                </Link>
              </DetailRow>
              <DetailRow label="veHEMI contract">
                <ExplorerLink href={`${EXPLORER}/token/${VE_HEMI_CONTRACT}/instance/${p.id}`}>{shortAddress(VE_HEMI_CONTRACT)}</ExplorerLink>
              </DetailRow>
              <DetailRow label="Marketplace contract">
                <ExplorerLink href={`${EXPLORER}/address/${VE_HEMI_MARKET}`}>{shortAddress(VE_HEMI_MARKET)}</ExplorerLink>
              </DetailRow>
              <DetailRow label="Network">Hemi</DetailRow>
              <DetailRow label="Payment token">HEMI</DetailRow>
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {dialog?.kind === "buy" && <VeHemiBuyDialog listing={dialog.listing} onClose={close} />}
        {dialog?.kind === "list" && <VeHemiListDialog position={dialog.position} onClose={close} />}
        {dialog?.kind === "offer" && <VeHemiOfferDialog position={dialog.position} myOffer={dialog.myOffer} onClose={close} />}
      </AnimatePresence>
    </div>
  );
}
