import { useState } from "react";
import { Link } from "wouter";
import { AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { HandCoins } from "lucide-react";
import { VeHemiUsd } from "@/components/vehemi/VeHemiPrice";
import VeHemiDialog, { DialogDone, DialogRows, StepButton, StepNote } from "@/components/vehemi/VeHemiDialog";
import { useVeHemiMarket } from "@/hooks/use-vehemi";
import { useTxStep, useVeHemiActions } from "@/hooks/use-vehemi-actions";
import { formatUnits } from "viem";
import { EXPLORER, VE_HEMI_MARKET, fmt, formatDate, sameAddress, shortAddress } from "@/lib/vehemi";

// Why the holder can't accept this offer right now
function blockedReason(offer, p) {
  if (offer.expiry <= Date.now()) return "Expired";
  if (!sameAddress(offer.seller, p.owner)) return "Made to the previous holder: make a new offer";
  if (!p.transferable) return "Can be accepted once the position is transferable";
  if (p.end > offer.maxLockEnd || p.lockAmountWei < offer.minLockAmountWei) return "The lock changed after this offer was made: make a new offer";
  return "The buyer's HEMI balance or approval is below the offer";
}

// Open offers on one position. The holder can accept the ones that would fill; buyers can cancel their own.
// Offers that can't fill are shown only to the buyer who made them, with the reason, so they can cancel.
export default function VeHemiOffers({ position: p, offers, loading, className = "" }) {
  const { address } = useAccount();
  const actions = useVeHemiActions();
  const { busy, run } = useTxStep();
  const [accepting, setAccepting] = useState(null);
  const isHolder = sameAddress(address, p.owner);
  const shown = offers.filter((o) => o.valid || sameAddress(o.buyer, address));
  // Offers come best first, so the first one that would fill is the best
  const best = shown.find((o) => o.valid);

  const cancel = async (offer) => {
    if (await run(() => actions.cancelOffer(offer.tokenId), "Couldn't cancel the offer")) actions.refresh();
  };

  return (
    <section
      id="offers"
      className={`scroll-mt-24 ${className} ${best ? "ring-1 ring-primary/40 shadow-[0_0_40px_-16px_hsl(var(--primary))]" : ""}`}
    >
      <h2 className="flex items-center gap-2 font-display font-bold">
        <HandCoins className={`w-4 h-4 ${best ? "text-primary" : "text-muted-foreground"}`} /> Offers
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
            best ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
          }`}
        >
          {shown.length}
        </span>
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        {isHolder ? "Accepting sends the position to the buyer and their HEMI to you, in one transaction." : "Offers are paid in HEMI and stay in the buyer's wallet until accepted."}
      </p>

      {loading ? (
        <div className="h-14 rounded-xl bg-secondary/40 animate-pulse" />
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 rounded-xl border border-dashed border-border text-center">
          <HandCoins className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No offers yet</p>
        </div>
      ) : (
        <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5 overflow-hidden">
          {shown.map((o) => {
            const mine = sameAddress(o.buyer, address);
            const isBest = o === best;
            return (
              <div key={o.buyer} className={`flex items-center justify-between gap-3 px-3 py-2.5 ${isBest ? "bg-primary/10" : ""}`}>
                <div className="min-w-0">
                  <p className={`font-semibold tabular-nums ${isBest ? "text-base" : "text-sm"}`}>
                    {fmt(o.amount)} <span className="text-xs font-normal text-muted-foreground">HEMI</span>
                    <VeHemiUsd amount={o.amount} className="ml-2 text-[11px] font-normal text-muted-foreground" />
                    {isBest && shown.length > 1 && (
                      <span className="ml-2 align-middle px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/30">
                        Best offer
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    from{" "}
                    <Link href={`/profile/${o.buyer}`} className="text-primary hover:underline">
                      {mine ? "you" : shortAddress(o.buyer)}
                    </Link>{" "}
                    · expires {formatDate(o.expiry)}
                  </p>
                  {!o.valid && <p className="text-[11px] text-amber-400">{blockedReason(o, p)}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {mine && (
                    <button type="button" onClick={() => cancel(o)} disabled={busy} className="h-8 px-3 rounded-lg border border-white/10 text-xs font-semibold hover:bg-secondary disabled:opacity-40">
                      Cancel
                    </button>
                  )}
                  {isHolder && o.valid && (
                    <button type="button" onClick={() => setAccepting(o)} className="h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold">
                      Accept
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {accepting && <VeHemiAcceptDialog position={p} offer={accepting} onClose={() => setAccepting(null)} />}
      </AnimatePresence>
    </section>
  );
}

// Confirms the fee and proceeds, then sends the position to the market with the offer attached
function VeHemiAcceptDialog({ position: p, offer, onClose }) {
  const { feeBps, loaded, paused } = useVeHemiMarket();
  const actions = useVeHemiActions();
  const { busy, run } = useTxStep();
  const [done, setDone] = useState(false);
  const fee = (offer.amount * feeBps) / 10000;
  // Offers have no ceiling, so the holder should know if the lock now holds more than the buyer saw
  const grown = p.lockAmountWei > offer.minLockAmountWei;

  const onAccept = async () => {
    // The fee shown here is the most the contract may take; it reverts if the fee has gone up since
    const accepted = await run(() => actions.acceptOffer(offer, feeBps), "Couldn't accept the offer");
    if (accepted) setDone(true);
    // On success the position has moved; on failure the fee may have changed, and this shows the new one
    actions.refresh();
  };

  return (
    <VeHemiDialog title={`Accept offer · veHEMI #${p.id}`} onClose={onClose} busy={busy}>
      {done ? (
        <DialogDone title="Offer accepted" onClose={onClose}>
          You received {fmt(offer.amount - fee)} HEMI.
        </DialogDone>
      ) : (
        <div className="space-y-4">
          <DialogRows
            rows={[
              ["Offer", `${fmt(offer.amount)} HEMI`],
              ["From", shortAddress(offer.buyer)],
              [`Marketplace fee (${feeBps / 100}%)`, `${fmt(fee)} HEMI`],
            ]}
          >
            <div className="flex justify-between px-3 py-2.5">
              <span className="text-muted-foreground">You receive</span>
              <div className="text-right">
                <span className="font-semibold tabular-nums">{fmt(offer.amount - fee)} HEMI</span>
                <VeHemiUsd amount={offer.amount - fee} className="block text-[11px] text-muted-foreground" />
              </div>
            </div>
          </DialogRows>
          {grown && (
            <p className="text-[11px] text-amber-400">
              This position now holds {fmt(p.hemi)} HEMI, more than the {fmt(Number(formatUnits(offer.minLockAmountWei, 18)))} HEMI
              it held when this offer was made. The offer stays at {fmt(offer.amount)} HEMI.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Your wallet will show this as sending veHEMI #{p.id} to the marketplace contract{" "}
            <a href={`${EXPLORER}/address/${VE_HEMI_MARKET}`} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline">
              {shortAddress(VE_HEMI_MARKET)}
            </a>
            , which is verified on Hemi's explorer. It passes the position straight to the buyer and their HEMI to you in
            the same transaction, so no approval is needed.
            {p.listing && ` This also cancels your listing at ${fmt(p.listing.price)} HEMI.`}
          </p>
          <StepButton busy={busy} disabled={!loaded || paused} onClick={onAccept}>
            {paused ? "Trading is paused" : `Accept ${fmt(offer.amount)} HEMI`}
          </StepButton>
          <StepNote>One transaction · paid in HEMI</StepNote>
        </div>
      )}
    </VeHemiDialog>
  );
}
