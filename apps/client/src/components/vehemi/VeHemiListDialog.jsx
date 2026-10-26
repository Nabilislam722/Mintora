import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Lock, X } from "lucide-react";
import hemiLogo from "/hemi.svg";
import { controlCls } from "@/components/NftBrowse";
import { VeHemiUsd } from "@/components/vehemi/VeHemiPrice";
import { LISTING_DURATIONS, LISTING_FEE_BPS, MAX_LISTING_DAYS, MIN_LISTING_DAYS, fmt } from "@/lib/vehemi";

// List one of the user's veHEMI positions for sale, priced in HEMI. `position` comes from useVeHemiPositions.
export default function VeHemiListDialog({ position: p, onClose }) {
  const [price, setPrice] = useState("");
  const [days, setDays] = useState(MIN_LISTING_DAYS);
  const [step, setStep] = useState("approve"); // approve -> list -> done
  const [busy, setBusy] = useState(false);

  const unlocked = p.end <= Date.now();
  const listable = p.transferable || unlocked;
  const unlockDate = new Date(p.end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const amount = Number(price);
  const valid = amount > 0;
  const discount = valid && p.hemi > 0 ? Math.round((1 - amount / p.hemi) * 100) : null;
  const fee = valid ? (amount * LISTING_FEE_BPS) / 10000 : null;

  // TODO: wire to the veHEMI marketplace contract once deployed —
  // approve(marketplace, tokenId) on veHEMI, then list(tokenId, price in HEMI wei, days * 86400)
  const run = (next) => {
    setBusy(true);
    setTimeout(() => { setBusy(false); setStep(next); }, 1400);
  };

  const rows = [
    ["Locked", `${fmt(p.hemi)} HEMI`],
    ["Voting weight", `${fmt(p.weight)} veHEMI`],
    [unlocked ? "Unlocked" : "Unlocks", unlockDate],
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
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 font-display font-bold">
            <img src={hemiLogo} alt="" className="w-6 h-6" /> List veHEMI #{p.id}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5 text-sm mb-4">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between px-3 py-2">
              <span className="text-muted-foreground">{k}</span><span className="font-medium tabular-nums">{v}</span>
            </div>
          ))}
        </div>

        {!listable ? (
          <div className="text-center py-4">
            <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold mb-1">This position can't be listed yet</p>
            <p className="text-xs text-muted-foreground mb-5">
              It's non-transferable until its original unlock date ({unlockDate}), so it can't change hands before then.
            </p>
            <button type="button" onClick={onClose} className="h-10 px-6 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/70">Close</button>
          </div>
        ) : step === "done" ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="font-bold mb-1">Listed for sale</p>
            <p className="text-xs text-muted-foreground mb-5">
              veHEMI #{p.id} is listed for {fmt(amount, 4)} HEMI for {days} days.
            </p>
            <button type="button" onClick={onClose} className="h-10 px-6 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/70">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="list-price" className="text-xs text-muted-foreground">Price in HEMI</label>
              <div className="relative mt-1.5">
                <input
                  id="list-price"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  disabled={step !== "approve" || busy}
                  className="w-full h-12 rounded-xl bg-secondary/50 border border-white/10 focus:border-primary/50 outline-none pl-4 pr-16 text-lg font-semibold tabular-nums disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">HEMI</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Locked value {fmt(p.hemi, 2)} HEMI</span>
                {discount != null && (
                  <span className={discount >= 0 ? "text-emerald-400" : "text-amber-400"}>
                    {discount >= 0 ? `${discount}% below` : `${-discount}% above`} locked value
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="list-duration" className="text-xs text-muted-foreground">Listing duration</label>
                <p className="text-[11px] text-muted-foreground/70">{MIN_LISTING_DAYS} to {MAX_LISTING_DAYS} days</p>
              </div>
              <select
                id="list-duration"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                disabled={step !== "approve" || busy}
                className={`${controlCls} px-3`}
              >
                {LISTING_DURATIONS.map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>

            <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5 text-sm">
              <div className="flex justify-between px-3 py-2">
                <span className="text-muted-foreground">Marketplace fee ({LISTING_FEE_BPS / 100}%)</span>
                <span className="tabular-nums">{fee != null ? `${fmt(fee, 4)} HEMI` : "—"}</span>
              </div>
              <div className="flex justify-between px-3 py-2.5">
                <span className="text-muted-foreground">You receive</span>
                <div className="text-right">
                  <span className="font-semibold tabular-nums">{valid ? `${fmt(amount - fee, 4)} HEMI` : "—"}</span>
                  {valid && <VeHemiUsd amount={amount - fee} className="block text-[11px] text-muted-foreground" />}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => run(step === "approve" ? "list" : "done")}
              disabled={!valid || busy}
              className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {busy ? "Confirm in wallet…" : step === "approve" ? "Approve veHEMI" : `List for ${fmt(amount, 4)} HEMI`}
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              Step {step === "approve" ? 1 : 2} of 2 · {step === "approve" ? "let the marketplace transfer this position" : "create the listing"}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
