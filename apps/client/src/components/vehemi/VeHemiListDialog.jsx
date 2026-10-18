import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Lock, X } from "lucide-react";
import hemiLogo from "/hemi.svg";
import { Segmented, controlCls } from "@/components/NftBrowse";
import { useTokenPrices } from "@/hooks/use-token-prices";
import { CURRENCIES, LISTING_FEE_BPS, fmt } from "@/lib/vehemi";

const DURATIONS = [["1", "1 day"], ["7", "7 days"], ["30", "30 days"]];

// List one of the user's veHEMI positions for sale. `position` comes from useVeHemiPositions.
export default function VeHemiListDialog({ position: p, onClose }) {
  const { data: prices } = useTokenPrices();
  const [currency, setCurrency] = useState("USDC");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("7");
  const [step, setStep] = useState("approve"); // approve -> list -> done
  const [busy, setBusy] = useState(false);

  const unlocked = p.end <= Date.now();
  const listable = p.transferable || unlocked;
  const unlockDate = new Date(p.end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const amount = Number(price);
  const valid = amount > 0;
  const lockedValue =
    currency === "HEMI" ? p.hemi : prices?.HEMI != null ? (p.hemi * prices.HEMI) / (prices.USDC ?? 1) : null;
  const discount = valid && lockedValue ? Math.round((1 - amount / lockedValue) * 100) : null;
  const fee = valid ? (amount * LISTING_FEE_BPS) / 10000 : null;

  // TODO: wire to the veHEMI marketplace contract once deployed —
  // approve(marketplace, tokenId) on veHEMI, then list(tokenId, price, paymentToken, duration)
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
              veHEMI #{p.id} is listed for {fmt(amount, 4)} {currency} for {DURATIONS.find(([d]) => d === days)[1]}.
            </p>
            <button type="button" onClick={onClose} className="h-10 px-6 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/70">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Get paid in</span>
              <Segmented label="Payment token" value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => [c, c])} />
            </div>

            <div>
              <label htmlFor="list-price" className="text-xs text-muted-foreground">Price</label>
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
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">{currency}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Locked value {lockedValue != null ? `≈ ${fmt(lockedValue, 2)} ${currency}` : "—"}</span>
                {discount != null && (
                  <span className={discount >= 0 ? "text-emerald-400" : "text-amber-400"}>
                    {discount >= 0 ? `${discount}% below` : `${-discount}% above`} locked value
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="list-duration" className="text-xs text-muted-foreground">Listing duration</label>
              <select
                id="list-duration"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                disabled={step !== "approve" || busy}
                className={`${controlCls} px-3`}
              >
                {DURATIONS.map(([d, label]) => <option key={d} value={d}>{label}</option>)}
              </select>
            </div>

            <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5 text-sm">
              <div className="flex justify-between px-3 py-2">
                <span className="text-muted-foreground">Marketplace fee ({LISTING_FEE_BPS / 100}%)</span>
                <span className="tabular-nums">{fee != null ? `${fmt(fee, 4)} ${currency}` : "—"}</span>
              </div>
              <div className="flex justify-between px-3 py-2.5">
                <span className="text-muted-foreground">You receive</span>
                <span className="font-semibold tabular-nums">{valid ? `${fmt(amount - fee, 4)} ${currency}` : "—"}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => run(step === "approve" ? "list" : "done")}
              disabled={!valid || busy}
              className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {busy ? "Confirm in wallet…" : step === "approve" ? "Approve veHEMI" : `List for ${fmt(amount, 4)} ${currency}`}
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
