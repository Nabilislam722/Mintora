import { useHemiPrice } from "@/hooks/use-token-prices";
import { fmt, hemiToUsd } from "@/lib/vehemi";

// A listing's price; veHEMI listings are always priced and paid in HEMI
export default function VeHemiPrice({ listing, className = "" }) {
  return (
    <span className={`font-semibold tabular-nums ${className}`}>
      {fmt(listing.price)} <span className="text-xs font-normal text-muted-foreground">HEMI</span>
    </span>
  );
}

// Live USD value of an amount of HEMI; renders nothing until the price loads
export function VeHemiUsd({ amount, className = "" }) {
  const usd = hemiToUsd(amount, useHemiPrice());
  return usd && <span className={`tabular-nums ${className}`}>{usd}</span>;
}
