import { useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import hemiLogo from "/hemi.svg";
import VeHemiDialog, { DialogDone, DialogRows, DurationSelect, HemiInput, StepButton, StepNote } from "@/components/vehemi/VeHemiDialog";
import { useHemiFunds, useVeHemiMarket } from "@/hooks/use-vehemi";
import { useTxStep, useVeHemiActions } from "@/hooks/use-vehemi-actions";
import { MIN_LISTING_DAYS, fmt, formatDate, parseHemi } from "@/lib/vehemi";

const toHemi = (wei) => Number(formatUnits(wei, 18));

// Offer HEMI for a position, listed or not, or replace your offer on it. Nothing is escrowed: the market
// needs an approval for the amount, on top of what your other open offers rely on, and takes the HEMI only
// if the holder accepts.
export default function VeHemiOfferDialog({ position: p, myOffer, onClose }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { paused } = useVeHemiMarket();
  const actions = useVeHemiActions();
  const { busy, run } = useTxStep();
  const { data: funds, refetch } = useHemiFunds(address, p.tokenId);
  const [amountText, setAmountText] = useState(myOffer ? String(myOffer.amount) : "");
  const [days, setDays] = useState(MIN_LISTING_DAYS);
  const [approvedHere, setApprovedHere] = useState(false);
  const [done, setDone] = useState(false);

  const amountWei = parseHemi(amountText);
  const amount = amountWei ? Number(amountText) : 0;
  const needed = funds && amountWei ? funds.reserved + amountWei : null;
  const approved = needed != null && funds.allowance >= needed;
  const short = !!funds && !!amountWei && funds.balance < amountWei;
  const discount = amountWei && p.hemi > 0 ? Math.round((1 - amount / p.hemi) * 100) : null;

  const onAction = async () => {
    if (!isConnected) return openConnectModal?.();
    if (!approved) {
      if (await run(() => actions.approveHemi(funds.token, needed), "Approval failed")) {
        setApprovedHere(true);
        await refetch();
      }
      return;
    }
    if (await run(() => actions.makeOffer(p.tokenId, amountWei, days), "Offer failed")) {
      setDone(true);
      actions.refresh();
    }
  };

  const label = !isConnected
    ? "Connect Wallet"
    : paused
      ? "Trading is paused"
      : !amountWei
        ? "Enter an amount"
        : !funds
          ? "Checking your HEMI…"
          : short
            ? "Not enough HEMI"
            : !approved
              ? `Approve ${fmt(toHemi(needed))} HEMI`
              : myOffer
                ? `Change offer to ${fmt(amount)} HEMI`
                : `Offer ${fmt(amount)} HEMI`;
  const note = !isConnected
    ? "Connect a wallet to continue"
    : needed != null && !approved
      ? funds.reserved > 0n
        ? `Step 1 of 2 · includes ${fmt(toHemi(funds.reserved))} HEMI kept approved for your other open offers`
        : "Step 1 of 2 · the HEMI stays in your wallet until the holder accepts"
      : approvedHere
        ? "Step 2 of 2 · the HEMI stays in your wallet until the holder accepts"
        : "The HEMI stays in your wallet until the holder accepts";

  const rows = [
    ["Locked", `${fmt(p.hemi)} HEMI`],
    ["Voting weight", `${fmt(p.weight)} veHEMI`],
    ["Unlocks", formatDate(p.end)],
  ];

  return (
    <VeHemiDialog
      wide
      busy={busy}
      onClose={onClose}
      title={<><img src={hemiLogo} alt="" className="w-6 h-6" /> {myOffer ? "Change your offer" : "Make an offer"} · #{p.id}</>}
    >
      {done ? (
        <DialogDone title="Offer made" onClose={onClose}>
          Your offer of {fmt(amount)} HEMI on veHEMI #{p.id} is open for {days} days. The HEMI stays in your wallet until
          the holder accepts.
        </DialogDone>
      ) : (
        <div className="space-y-4">
          <DialogRows rows={rows} />
          <HemiInput
            id="offer-amount"
            label="Your offer in HEMI"
            value={amountText}
            onChange={setAmountText}
            disabled={busy}
            hint={
              <>
                <span>{funds ? `In your wallet: ${fmt(toHemi(funds.balance))} HEMI` : " "}</span>
                {discount != null && (
                  <span className={discount >= 0 ? "text-emerald-400" : "text-amber-400"}>
                    {discount >= 0 ? `${discount}% below` : `${-discount}% above`} locked value
                  </span>
                )}
              </>
            }
          />
          <DurationSelect id="offer-duration" label="Offer open for" value={days} onChange={setDays} disabled={busy} />
          {p.end < Date.now() + days * 864e5 && (
            <p className="text-[11px] text-amber-400">
              The lock ends on {formatDate(p.end)}, before this offer would expire, so the offer stops working then.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Only whoever holds the position now can accept, and only while its lock stays as it is. If it changes hands
            or the lock is extended, make a new offer.
          </p>
          <StepButton
            busy={busy}
            disabled={isConnected && (paused || !amountWei || !funds || short)}
            onClick={onAction}
            icon={!isConnected ? <Wallet className="w-3.5 h-3.5" /> : null}
          >
            {label}
          </StepButton>
          <StepNote>{note}</StepNote>
        </div>
      )}
    </VeHemiDialog>
  );
}
