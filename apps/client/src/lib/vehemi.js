export const VE_HEMI_CONTRACT = "0x371d3718D5b7F75EAb050FAe6Da7DF3092031c89";
export const MAX_LOCK_DAYS = 1461; // 4 years of 365.25 days, veHEMI's max lock
export const LISTING_FEE_BPS = 500; // keep in sync with the veHEMI marketplace contract's platform fee
// How long a listing stays open. MintoraVeHemi rejects anything outside MIN_DURATION..MAX_DURATION (7–90 days).
export const MIN_LISTING_DAYS = 7;
export const MAX_LISTING_DAYS = 90;
export const LISTING_DURATIONS = [7, 14, 30, 60, 90];

export const LOCK_FILTERS = [
  { id: "short", label: "< 3 months", test: (d) => d < 90 },
  { id: "mid", label: "3–12 months", test: (d) => d >= 90 && d <= 365 },
  { id: "long", label: "> 1 year", test: (d) => d > 365 },
];

export const inputCls = "h-9 rounded-3xl bg-secondary/50 border border-white/10 focus:border-primary/50 outline-none text-sm px-3";

export const fmt = (n, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });

// Listings are priced and paid in HEMI, so the discount is the price against the HEMI locked inside
export const discountOf = (l) => Math.round((1 - l.price / l.hemi) * 100);

// "≈ $1,234.56" for an amount of HEMI at the live HEMI price, or null until the price loads
export const hemiToUsd = (amount, hemiUsd) =>
  hemiUsd == null
    ? null
    : `≈ ${(amount * hemiUsd).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}`;

// Mirrors VeHemi.balanceOfNFT: weight decays linearly with time left on the lock
export const weightOf = (l) => (l.hemi * l.left) / MAX_LOCK_DAYS;

export const unlockDate = (days) =>
  new Date(Date.now() + days * 864e5).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export const timeLeft = (d) => (d >= 365 ? `${(d / 365).toFixed(1)} yrs` : d >= 60 ? `${Math.round(d / 30)} mo` : `${d} days`);
