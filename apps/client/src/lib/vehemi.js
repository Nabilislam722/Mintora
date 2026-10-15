export const VE_HEMI_CONTRACT = "0x371d3718D5b7F75EAb050FAe6Da7DF3092031c89";
export const HEMI_USD = 0.05;
export const CURRENCIES = ["USDC", "HEMI"];
export const MAX_LOCK_DAYS = 1461; // 4 years of 365.25 days, veHEMI's max lock

export const LOCK_FILTERS = [
  { id: "short", label: "< 3 months", test: (d) => d < 90 },
  { id: "mid", label: "3–12 months", test: (d) => d >= 90 && d <= 365 },
  { id: "long", label: "> 1 year", test: (d) => d > 365 },
];

export const inputCls = "h-9 rounded-3xl bg-secondary/50 border border-white/10 focus:border-primary/50 outline-none text-sm px-3";

export const fmt = (n, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });

// Listings are priced in one token; other currencies are an estimate at HEMI_USD
export const priceIn = (l, currency) =>
  l.currency === currency ? l.price : currency === "USDC" ? l.price * HEMI_USD : l.price / HEMI_USD;

export const discountOf = (l) => Math.round((1 - priceIn(l, "HEMI") / l.hemi) * 100);

// Mirrors VeHemi.balanceOfNFT: weight decays linearly with time left on the lock
export const weightOf = (l) => (l.hemi * l.left) / MAX_LOCK_DAYS;

export const unlockDate = (days) =>
  new Date(Date.now() + days * 864e5).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export const timeLeft = (d) => (d >= 365 ? `${(d / 365).toFixed(1)} yrs` : d >= 60 ? `${Math.round(d / 30)} mo` : `${d} days`);
