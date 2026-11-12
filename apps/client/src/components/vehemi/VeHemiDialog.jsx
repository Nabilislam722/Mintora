import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { controlCls } from "@/components/NftBrowse";
import { LISTING_DURATIONS, MAX_LISTING_DAYS, MIN_LISTING_DAYS } from "@/lib/vehemi";

// Modal frame for the veHEMI dialogs, rendered into <body>; the backdrop can't close it mid-step
export default function VeHemiDialog({ title, onClose, busy = false, wide = false, children }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={busy ? undefined : onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className={`w-full ${wide ? "max-w-md" : "max-w-sm"} rounded-2xl border border-border bg-card p-5`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 font-display font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
}

// Label / value table
export function DialogRows({ rows, children }) {
  return (
    <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 px-3 py-2">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-medium tabular-nums text-right">{v}</span>
        </div>
      ))}
      {children}
    </div>
  );
}

// An amount of HEMI; `hint` sits under the field
export function HemiInput({ id, label, value, onChange, disabled, hint }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-muted-foreground">{label}</label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          disabled={disabled}
          className="w-full h-12 rounded-xl bg-secondary/50 border border-white/10 focus:border-primary/50 outline-none pl-4 pr-16 text-lg font-semibold tabular-nums disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">HEMI</span>
      </div>
      {hint && <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

// How long a listing or offer stays open (7 to 90 days)
export function DurationSelect({ id, label, value, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <label htmlFor={id} className="text-xs text-muted-foreground">{label}</label>
        <p className="text-[11px] text-muted-foreground/70">{MIN_LISTING_DAYS} to {MAX_LISTING_DAYS} days</p>
      </div>
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} className={`${controlCls} px-3`}>
        {LISTING_DURATIONS.map((d) => <option key={d} value={d}>{d} days</option>)}
      </select>
    </div>
  );
}

export function StepButton({ busy, disabled, onClick, icon = null, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {busy ? "Confirm in wallet…" : children}
    </button>
  );
}

export function StepNote({ children }) {
  return <p className="text-[11px] text-muted-foreground text-center">{children}</p>;
}

export function DialogDone({ title, children, onClose }) {
  return (
    <div className="text-center py-6">
      <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
      <p className="font-bold mb-1">{title}</p>
      <p className="text-xs text-muted-foreground mb-5">{children}</p>
      <button type="button" onClick={onClose} className="h-10 px-6 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/70">Done</button>
    </div>
  );
}
