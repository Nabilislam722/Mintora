import { useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { X, CheckCircle2, Loader2, Wallet } from "lucide-react";
import VeHemiPrice from "@/components/vehemi/VeHemiPrice";
import { discountOf, fmt, unlockDate, weightOf } from "@/lib/vehemi";

export default function VeHemiBuyDialog({ listing, onClose }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [step, setStep] = useState("approve"); // approve -> buy -> done
  const [busy, setBusy] = useState(false);

  // TODO: wire to wagmi — approve HEMI for the marketplace (the listing price), then buy(tokenId, listingId)
  const run = (next) => {
    setBusy(true);
    setTimeout(() => { setBusy(false); setStep(next); }, 1400);
  };
  const onAction = () => {
    if (!isConnected) return openConnectModal?.();
    step === "approve" ? run("buy") : run("done");
  };

  const rows = [
    ["Locked", `${fmt(listing.hemi)} HEMI`],
    ["Voting weight", `${fmt(weightOf(listing))} veHEMI`],
    ["Unlocks", unlockDate(listing.left)],
    ["Discount to locked value", `${discountOf(listing)}%`],
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold">Buy veHEMI #{listing.id}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "done" ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="font-bold mb-1">Purchase complete</p>
            <p className="text-xs text-muted-foreground mb-5">veHEMI #{listing.id} is now in your wallet.</p>
            <button type="button" onClick={onClose} className="h-10 px-6 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/70">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
                </div>
              ))}
              <div className="flex justify-between items-baseline px-3 py-3">
                <span className="text-muted-foreground">Total</span>
                <VeHemiPrice listing={listing} className="text-lg" />
              </div>
            </div>
            <button
              type="button"
              onClick={onAction}
              disabled={busy}
              className="w-full h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : !isConnected ? <Wallet className="w-3.5 h-3.5" /> : null}
              {!isConnected ? "Connect Wallet" : busy ? "Confirm in wallet…" : step === "approve" ? "Approve HEMI" : "Buy now"}
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              {isConnected ? `Step ${step === "approve" ? 1 : 2} of 2 · paid in HEMI` : "Connect a wallet to continue"}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
