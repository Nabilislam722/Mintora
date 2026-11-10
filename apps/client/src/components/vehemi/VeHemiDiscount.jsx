import { TrendingDown, TrendingUp } from "lucide-react";

// Green when below it, red when the price is above it (a negative discount)
export const discountTextCls = (pct) => (pct < 0 ? "text-red-400" : pct > 0 ? "text-emerald-400" : "");

const SIZES = { xs: "px-1.5 py-0.5 text-[10px]", sm: "px-2 py-0.5 text-[11px]", md: "px-2 py-0.5 text-xs" };

// A listing's discount to the HEMI locked inside, as a chip: green with ↘ below the locked value, red with ↗
// above it. `suffix` follows the number ("20% off").
export default function VeHemiDiscount({ pct, suffix = "", size = "sm" }) {
  const above = pct < 0;
  const Icon = above ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold border tabular-nums ${SIZES[size] ?? SIZES.sm} ${above ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}
    >
      <Icon className="w-3 h-3" /> {pct}%{suffix}
    </span>
  );
}
