import { useState } from "react";
import { Lock } from "lucide-react";
import hemiLogo from "/hemi.svg";
import { VeHemiUsd } from "@/components/vehemi/VeHemiPrice";
import VeHemiDialog, { DialogDone, DialogRows, DurationSelect, HemiInput, StepButton, StepNote } from "@/components/vehemi/VeHemiDialog";
import { useVeHemiMarket } from "@/hooks/use-vehemi";
import { useTxStep, useVeHemiActions } from "@/hooks/use-vehemi-actions";
import { MIN_LISTING_DAYS, fmt, formatDate, parseHemi } from "@/lib/vehemi";

// List a position for sale, or change the price of its listing. `position` comes from useVeHemiPosition.
// Lists first and approves second: approving first would revive any older listing left for this position.
// The approval is skipped when the market already holds it, e.g. when changing the price.
export default function VeHemiListDialog({ position: p, onClose }) {
  const current = p.listing ?? p.storedListing;
  const [price, setPrice] = useState(current ? String(current.price) : "");
  const [days, setDays] = useState(MIN_LISTING_DAYS);
  const [step, setStep] = useState("list"); // list -> approve -> done
  const { feeBps, paused } = useVeHemiMarket();
  const actions = useVeHemiActions();
  const { busy, run } = useTxStep();

  const unlocked = p.left === 0;
  const listable = p.transferable && !unlocked;
  const needsApproval = !p.approved;
  const priceWei = parseHemi(price);
  const amount = priceWei ? Number(price) : 0;
  const discount = priceWei && p.hemi > 0 ? Math.round((1 - amount / p.hemi) * 100) : null;
  const fee = priceWei ? (amount * feeBps) / 10000 : null;

  const onAction = async () => {
    if (step === "list") {
      let live = false;
      // Approve only after the listing has confirmed; whether it's needed is read fresh at that point
      const listed = await run(async () => {
        await actions.list(p.tokenId, priceWei, days);
        live = await actions.isMarketApproved(p.tokenId);
      }, "Listing failed");
      if (!listed) return;
      actions.refresh();
      setStep(live ? "done" : "approve");
    } else if (await run(() => actions.approvePosition(p.tokenId), "Approval failed")) {
      actions.refresh();
      setStep("done");
    }
  };

  const rows = [
    ["Locked", `${fmt(p.hemi)} HEMI`],
    ["Voting weight", `${fmt(p.weight)} veHEMI`],
    [unlocked ? "Unlocked" : "Unlocks", formatDate(p.end)],
  ];

  return (
    <VeHemiDialog
      wide
      busy={busy}
      onClose={onClose}
      title={<><img src={hemiLogo} alt="" className="w-6 h-6" /> {p.listing ? "Change price" : "List"} veHEMI #{p.id}</>}
    >
      <div className="mb-4"><DialogRows rows={rows} /></div>

      {!listable ? (
        <div className="text-center py-4">
          <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold mb-1">{unlocked ? "This lock has ended" : "This position can't be listed yet"}</p>
          <p className="text-xs text-muted-foreground mb-5">
            {unlocked
              ? "Its HEMI can be withdrawn now, so there's nothing locked left to sell."
              : `It's non-transferable until its original unlock date (${formatDate(p.end)}), so it can't change hands before then.`}
          </p>
          <button type="button" onClick={onClose} className="h-10 px-6 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/70">Close</button>
        </div>
      ) : step === "done" ? (
        <DialogDone title="Listed for sale" onClose={onClose}>
          veHEMI #{p.id} is listed for {fmt(amount)} HEMI for {days} days.
        </DialogDone>
      ) : step === "approve" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your listing at {fmt(amount)} HEMI is saved. Approve the marketplace for this position so it can move to the
            buyer when it sells. Until then the listing isn't live.
          </p>
          <StepButton busy={busy} onClick={onAction}>Approve veHEMI #{p.id}</StepButton>
          <StepNote>Step 2 of 2 · let the marketplace transfer this position when it sells</StepNote>
        </div>
      ) : (
        <div className="space-y-4">
          <HemiInput
            id="list-price"
            label="Price in HEMI"
            value={price}
            onChange={setPrice}
            disabled={busy}
            hint={
              <>
                <span>Locked value {fmt(p.hemi, 2)} HEMI</span>
                {discount != null && (
                  <span className={discount >= 0 ? "text-emerald-400" : "text-amber-400"}>
                    {discount >= 0 ? `${discount}% below` : `${-discount}% above`} locked value
                  </span>
                )}
              </>
            }
          />
          <DurationSelect id="list-duration" label="Listing duration" value={days} onChange={setDays} disabled={busy} />
          {p.end < Date.now() + days * 864e5 && (
            <p className="text-[11px] text-amber-400">
              The lock ends on {formatDate(p.end)}, before this listing would expire, so the listing stops working then.
            </p>
          )}

          <DialogRows rows={[[`Marketplace fee (${feeBps / 100}%)`, fee != null ? `${fmt(fee)} HEMI` : "—"]]}>
            <div className="flex justify-between px-3 py-2.5">
              <span className="text-muted-foreground">You receive</span>
              <div className="text-right">
                <span className="font-semibold tabular-nums">{fee != null ? `${fmt(amount - fee)} HEMI` : "—"}</span>
                {fee != null && <VeHemiUsd amount={amount - fee} className="block text-[11px] text-muted-foreground" />}
              </div>
            </div>
          </DialogRows>

          <StepButton busy={busy} disabled={!priceWei || paused} onClick={onAction}>
            {paused ? "Trading is paused" : p.listing ? `Update price to ${fmt(amount)} HEMI` : `List for ${fmt(amount)} HEMI`}
          </StepButton>
          <StepNote>
            {needsApproval ? "Step 1 of 2 · create the listing" : "The marketplace is already approved for this position"}
          </StepNote>
        </div>
      )}
    </VeHemiDialog>
  );
}
