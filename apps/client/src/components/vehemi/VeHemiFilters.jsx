import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CiFilter } from "react-icons/ci";
import { LOCK_FILTERS, inputCls } from "@/lib/vehemi";

export default function VeHemiFilters({ lock, onLockChange, minHemi, onMinHemiChange }) {
  const [open, setOpen] = useState(false);
  const active = lock !== null || minHemi !== "";

  return (
    <div className="flex flex-wrap items-center gap-10 lg:flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle filters"
        aria-expanded={open}
        className={`relative h-9 w-9 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
          open || active
            ? "bg-primary/10 text-primary border-primary/40"
            : "bg-secondary/50 text-muted-foreground border-white/10 hover:text-foreground"
        }`}
      >
        <CiFilter className="w-5 h-5" />
        {active && !open && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="filter-options"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8, transition: { duration: 0.1 } }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              value={minHemi}
              onChange={(e) => onMinHemiChange(e.target.value)}
              type="number"
              min="0"
              placeholder="Min HEMI locked"
              className={`${inputCls} w-44 placeholder:text-muted-foreground/50 border-muted-foreground/10`}
            />
            {LOCK_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onLockChange(lock === f.id ? null : f.id)}
                aria-pressed={lock === f.id}
                className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                  lock === f.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-white/10 hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
