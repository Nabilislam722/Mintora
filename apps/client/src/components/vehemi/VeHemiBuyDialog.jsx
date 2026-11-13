import { useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import VeHemiPrice from "@/components/vehemi/VeHemiPrice";
import VeHemiDiscount from "@/components/vehemi/VeHemiDiscount";
import VeHemiDialog, { DialogDone, DialogRows, StepButton, StepNote } from "@/components/vehemi/VeHemiDialog";
import { useHemiFunds, useVeHemiMarket } from "@/hooks/use-vehemi";
import { useTxStep, useVeHemiActions } from "@/hooks/use-vehemi-actions";
import { discountOf, fmt, formatDate, sameAddress } from "@/lib/vehemi";

const toHemi = (wei) => Number(formatUnits(wei, 18));

// Buys a listing: approves HEMI if needed, then buy(tokenId, listingId)
export default function VeHemiBuyDialog({ listing, onClose }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { paused } = useVeHemiMarket();
  const actions = useVeHemiActions();
  const { busy, run } = useTxStep();
  const { data: funds, refetch } = useHemiFunds(address, listing.tokenId);
  const [approvedHere, setApprovedHere] = useState(false);
  const [done, setDone] = useState(false);

  const needed = funds ? funds.reserved + listing.priceWei : null;
  const approved = !!funds && funds.allowance >= needed;
  const short = !!funds && funds.balance < listing.priceWei;
  const own = sameAddress(address, listing.seller);

  const onAction = async () => {
    if (!isConnected) return openConnectModal?.();
    if (!approved) {
      if (await run(() => actions.approveHemi(funds.token, needed), "Approval failed")) {
        setApprovedHere(true);
        await refetch();
      }
      return;
    }
    if (await run(() => actions.buy(listing), "Purchase failed")) {
      setDone(true);
      actions.refresh();
    }
  };

  const label = !isConnected
    ? "Connect Wallet"
    : own
      ? "This is your listing"
      : paused
        ? "Trading is paused"
        : !funds
          ? "Checking your HEMI…"
          : short
            ? "Not enough HEMI"
            : !approved
              ? `Approve ${fmt(toHemi(needed))} HEMI`
              : "Buy now";
  const note = !isConnected
    ? "Connect a wallet to continue"
    : funds && !approved
      ? funds.reserved > 0n
        ? `Step 1 of 2 · includes ${fmt(toHemi(funds.reserved))} HEMI kept approved for your open offers`
        : "Step 1 of 2 · let the marketplace take the price in HEMI"
      : approvedHere
        ? "Step 2 of 2 · paid in HEMI"
        : "Paid in HEMI";

  const grown = listing.lockAmountWei > listing.listedLockAmountWei;
  const rows = [
    ["Locked", `${fmt(listing.hemi)} HEMI`],
    ...(grown ? [["Locked when listed", `${fmt(listing.listedHemi)} HEMI`]] : []),
    ["Voting weight", `${fmt(listing.weight)} veHEMI`],
    ["Unlocks", formatDate(listing.end)],
    ["Discount to locked value", <VeHemiDiscount pct={discountOf(listing)} />],
  ];

  return (
    <VeHemiDialog title={`Buy veHEMI #${listing.id}`} onClose={onClose} busy={busy}>
      {done ? (
        <DialogDone title="Purchase complete" onClose={onClose}>veHEMI #{listing.id} is now in your wallet.</DialogDone>
      ) : (
        <div className="space-y-4">
          <DialogRows rows={rows}>
            <div className="flex justify-between items-baseline px-3 py-3">
              <span className="text-muted-foreground">Total</span>
              <VeHemiPrice listing={listing} className="text-lg" />
            </div>
          </DialogRows>
          <StepButton
            busy={busy}
            disabled={isConnected && (own || paused || !funds || short)}
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
