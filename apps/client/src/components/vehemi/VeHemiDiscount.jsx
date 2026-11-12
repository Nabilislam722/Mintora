import { TrendingDown, TrendingUp } from "lucide-react";

// Green when the price is below the locked HEMI, red when above
export const discountTextCls = (pct) => (pct < 0 ? "text-red-400" : pct > 0 ? "text-emerald-400" : "");

const SIZES = { xs: "px-1.5 py-0.5 text-[10px]", sm: "px-2 py-0.5 text-[11px]", md: "px-2 py-0.5 text-xs" };

// A listing's discount to its locked HEMI as a chip: green ↘ below, red ↗ above
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
