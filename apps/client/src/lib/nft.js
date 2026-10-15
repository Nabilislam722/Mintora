import { formatEther } from "viem";

export const isListed = (n) => n.isListed === true || (!!n.price && n.price !== "0");

// Unlisted items always sort after listed ones, then by token ID
const byPrice = (dir) => (a, b) => {
  const pa = isListed(a) ? BigInt(a.price) : null;
  const pb = isListed(b) ? BigInt(b.price) : null;
  if (pa === null || pb === null) return (pa === null) - (pb === null) || Number(a.tokenId) - Number(b.tokenId);
  return pa === pb ? 0 : pa < pb ? -dir : dir;
};

export const NFT_SORTS = {
  priceAsc: { label: "Price: low to high", fn: byPrice(1) },
  priceDesc: { label: "Price: high to low", fn: byPrice(-1) },
  tokenId: { label: "Token ID", fn: (a, b) => Number(a.tokenId) - Number(b.tokenId) },
};

export const formatEth = (wei, digits = 4) =>
  Number(formatEther(BigInt(wei))).toLocaleString(undefined, { maximumFractionDigits: digits });

export const shortAddress = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

const UNITS = [[31536000, "y"], [2592000, "mo"], [86400, "d"], [3600, "h"], [60, "m"]];

export const timeAgo = (date) => {
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  const [sec, unit] = UNITS.find(([sec]) => s >= sec) ?? [];
  return sec ? `${Math.floor(s / sec)}${unit} ago` : "just now";
};
