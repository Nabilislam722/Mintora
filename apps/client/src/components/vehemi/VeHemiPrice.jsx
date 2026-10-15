import { fmt, priceIn } from "@/lib/vehemi";

export default function VeHemiPrice({ listing, currency = listing.currency, className = "" }) {
  const estimate = currency !== listing.currency;
  return (
    <span className={`font-semibold tabular-nums ${className}`}>
      {estimate && "≈ "}
      {fmt(priceIn(listing, currency))} <span className="text-xs font-normal text-muted-foreground">{currency}</span>
    </span>
  );
}
