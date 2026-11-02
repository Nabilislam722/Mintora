import { parseUnits } from "viem";

export const VE_HEMI_CONTRACT = "0x371d3718D5b7F75EAb050FAe6Da7DF3092031c89";
export const VE_HEMI_MARKET = "0x6Fd47e5dA6c06a7D77A57893FD22C478b56C4Db1"; // MintoraVeHemi proxy
export const MARKET_DEPLOY_BLOCK = 5633113n; // no market events before this block
export const EXPLORER = "https://explorer.hemi.xyz";
export const MAX_LOCK_DAYS = 1461; // 4 years of 365.25 days, veHEMI's max lock
export const LISTING_FEE_BPS = 500; // shown until the market's live feeBps loads
// How long a listing or offer stays open. MintoraVeHemi rejects anything outside MIN_DURATION..MAX_DURATION (7–90 days).
export const MIN_LISTING_DAYS = 7;
export const MAX_LISTING_DAYS = 90;
export const LISTING_DURATIONS = [7, 14, 30, 60, 90];
// A listing keeps filling after HEMI is added to its lock, up to this margin; without one, anyone could
// stop a listing by adding 1 wei of HEMI to the lock
export const LOCK_MARGIN_BPS = 100n;

export const LOCK_FILTERS = [
  { id: "short", label: "< 3 months", test: (d) => d < 90 },
  { id: "mid", label: "3–12 months", test: (d) => d >= 90 && d <= 365 },
  { id: "long", label: "> 1 year", test: (d) => d > 365 },
];

export const inputCls = "h-9 rounded-3xl bg-secondary/50 border border-white/10 focus:border-primary/50 outline-none text-sm px-3";

// Without `d`, keeps more decimals for small amounts: positions can hold fractions of a HEMI
export const fmt = (n, d) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d ?? (Math.abs(n) >= 1000 ? 0 : Math.abs(n) >= 1 ? 2 : 4) });

// "1.2M", "45K"
export const fmtCompact = (n) => n.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 });

// Listings are priced and paid in HEMI, so the discount is the price against the HEMI locked inside
export const discountOf = (l) => (l.hemi > 0 ? Math.round((1 - l.price / l.hemi) * 100) : 0);

// "≈ $1,234.56" for an amount of HEMI at the live HEMI price, or null until the price loads
export const hemiToUsd = (amount, hemiUsd) =>
  hemiUsd == null
    ? null
    : `≈ ${(amount * hemiUsd).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}`;

export const formatDate = (ms) =>
  new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export const unlockDate = (days) => formatDate(Date.now() + days * 864e5);

export const timeLeft = (d) => (d >= 365 ? `${(d / 365).toFixed(1)} yrs` : d >= 60 ? `${Math.round(d / 30)} mo` : `${d} days`);

export const shortAddress = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const sameAddress = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

// A typed HEMI amount in wei, or null unless it's a plain positive number
export function parseHemi(text) {
  try {
    const wei = parseUnits(String(text).trim(), 18);
    return wei > 0n ? wei : null;
  } catch {
    return null;
  }
}

// Most HEMI a new listing still sells at its price: what's locked now plus LOCK_MARGIN_BPS
export const maxLockAmountFor = (lockAmountWei) => lockAmountWei + (lockAmountWei * LOCK_MARGIN_BPS) / 10_000n;

const ERROR_MESSAGES = {
  ListingChanged: "The seller changed this listing. Check the new terms and try again.",
  ListingExpired: "This listing has expired.",
  ListingInvalidated: "The seller cancelled all their orders, including this listing.",
  NotListed: "This position isn't listed any more.",
  SellerNotOwner: "The position has a new holder, so this listing can't fill.",
  NotApproved: "The seller hasn't activated this listing, or their approval moved elsewhere.",
  PositionChanged: "The lock was extended, or HEMI was added past the listing's limit.",
  LockExpired: "This position's lock has ended.",
  NotTransferable: "This position can't be traded yet.",
  NotTokenOwner: "Only the position's holder can do this, from their own wallet.",
  TransferFailed: "The position didn't stay in the buyer's wallet, so the trade was undone.",
  OfferChanged: "The buyer changed this offer. Check the new terms and try again.",
  OfferExpired: "This offer has expired.",
  OfferInvalidated: "The buyer cancelled all their orders, including this offer.",
  NoOffer: "This offer doesn't exist any more.",
  HolderChanged: "The position has a new holder, so this offer can't be accepted.",
  FeeAboveLimit: "The marketplace fee went up. Check the new fee and try again.",
  InsufficientFunds: "You need the HEMI in your wallet, approved for the marketplace, to make this offer.",
  InvalidLockCap: "The lock grew while you were listing. Try again.",
  InvalidDuration: "Pick a duration between 7 and 90 days.",
  InvalidPrice: "Enter an amount above zero.",
  SelfTrade: "You can't trade with yourself.",
  EnforcedPause: "Trading on the veHEMI market is paused right now.",
  ERC20InsufficientAllowance: "The HEMI approval is too low for this trade.",
  ERC20InsufficientBalance: "You don't have enough HEMI.",
};

// HEMI reverts with OpenZeppelin 4-style strings rather than custom errors
const REASON_MESSAGES = [
  ["insufficient allowance", ERROR_MESSAGES.ERC20InsufficientAllowance],
  ["exceeds balance", ERROR_MESSAGES.ERC20InsufficientBalance],
];

// True when a trade failed because HEMI couldn't be pulled: the payer's balance or approval is too low
export function isHemiShortfall(error) {
  const reverted = error?.walk?.((e) => e?.name === "ContractFunctionRevertedError");
  return (
    ["ERC20InsufficientAllowance", "ERC20InsufficientBalance"].includes(reverted?.data?.errorName) ||
    REASON_MESSAGES.some(([text]) => reverted?.reason?.includes(text))
  );
}

// A short, readable reason for a failed wallet request or transaction
export function txErrorMessage(error) {
  const reverted = error?.walk?.((e) => e?.name === "ContractFunctionRevertedError");
  const reason =
    ERROR_MESSAGES[reverted?.data?.errorName] ??
    REASON_MESSAGES.find(([text]) => reverted?.reason?.includes(text))?.[1];
  if (reason) return reason;
  if (error?.walk?.((e) => e?.name === "UserRejectedRequestError" || e?.code === 4001)) {
    return "You rejected the request in your wallet.";
  }
  return error?.shortMessage || error?.message || "The transaction failed.";
}
