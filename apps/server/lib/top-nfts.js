import { Activity } from "../models/Activity.js";
import { NFT } from "../models/NFT.js";
import "../models/Collection.js"; // registers the model the cards' collection is populated from
import { SALES_PERIODS } from "./trending.js";

// The home page's Top NFTs: the best listings for a period (24h, 7d or 30d). Every listed NFT gets a score:
//
//   2 × log2(1 + its collection's sales in the period)   demand, with diminishing returns
// + its own sales in the period (up to 3)                 it's actively trading
// + 0.5 if it was listed during the period                fresh on the market
// + log2(reference price ÷ its price), within −2..+2      a good deal against what the collection has been
//                                                          selling for (or its floor, if nothing sold)
// + 3 × priority                                          hand-picked in the database
//
// Each collection's best listing goes in first, so the row isn't one collection; the rest fill by score.
const LIMIT = 5;
const WEIGHTS = { collectionSales: 2, ownSales: 1, maxOwnSales: 3, freshListing: 0.5, deal: 1, priority: 3 };
const CACHE_TTL = 60_000;
const cache = new Map();

const toEth = (wei) => {
  try {
    return Number(BigInt(wei || 0)) / 1e18;
  } catch {
    return 0;
  }
};

async function compute(period) {
  const since = new Date(Date.now() - SALES_PERIODS[period]);
  const [listed, events] = await Promise.all([
    NFT.find({ isListed: true }, { contractAddress: 1, tokenId: 1, price: 1, priority: 1 }).lean(),
    Activity.find(
      { type: { $in: ["SOLD", "LIST"] }, createdAt: { $gte: since } },
      { type: 1, collection: 1, tokenId: 1, price: 1, _id: 0 }
    ).lean(),
  ]);

  // The period's sales per collection and per token, and which tokens were listed in it
  const collections = new Map(); // address → { sales, saleTotal, floor }
  const ownSales = new Map(); // "address:tokenId" → count
  const freshlyListed = new Set();
  const col = (address) => {
    if (!collections.has(address)) collections.set(address, { sales: 0, saleTotal: 0, floor: Infinity });
    return collections.get(address);
  };
  for (const e of events) {
    const key = `${e.collection}:${e.tokenId}`;
    if (e.type === "SOLD") {
      const c = col(e.collection);
      c.sales++;
      c.saleTotal += toEth(e.price);
      ownSales.set(key, (ownSales.get(key) ?? 0) + 1);
    } else {
      freshlyListed.add(key);
    }
  }

  const candidates = listed
    .map((n) => ({ ...n, eth: toEth(n.price) }))
    .filter((n) => n.eth > 0);
  for (const n of candidates) {
    const c = col(n.contractAddress);
    c.floor = Math.min(c.floor, n.eth);
  }

  for (const n of candidates) {
    const c = col(n.contractAddress);
    const key = `${n.contractAddress}:${n.tokenId}`;
    const reference = c.sales > 0 ? c.saleTotal / c.sales : c.floor;
    const deal = Math.max(-2, Math.min(2, Math.log2(reference / n.eth)));
    n.score =
      WEIGHTS.collectionSales * Math.log2(1 + c.sales) +
      WEIGHTS.ownSales * Math.min(WEIGHTS.maxOwnSales, ownSales.get(key) ?? 0) +
      (freshlyListed.has(key) ? WEIGHTS.freshListing : 0) +
      WEIGHTS.deal * deal +
      WEIGHTS.priority * (n.priority ?? 0);
  }

  // Best first; ties go to the higher price, then the id, so the order never shuffles
  const ranked = candidates.sort(
    (a, b) => b.score - a.score || b.eth - a.eth || String(a._id).localeCompare(String(b._id))
  );
  const picked = [];
  const seen = new Set();
  for (const n of ranked) {
    if (picked.length < LIMIT && !seen.has(n.contractAddress)) {
      picked.push(n);
      seen.add(n.contractAddress);
    }
  }
  for (const n of ranked) if (picked.length < LIMIT && !picked.includes(n)) picked.push(n);
  picked.sort((a, b) => b.score - a.score || b.eth - a.eth || String(a._id).localeCompare(String(b._id)));

  // The full documents the cards need, in the picked order
  const docs = await NFT.find({ _id: { $in: picked.map((n) => n._id) } }).populate("collectionId").lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return picked
    .map((n) => byId.get(String(n._id)) && { ...byId.get(String(n._id)), topScore: Math.round(n.score * 100) / 100 })
    .filter(Boolean);
}

// Top NFTs for `period` (one of SALES_PERIODS), recomputed at most once a minute
export function topNfts(period) {
  const hit = cache.get(period);
  if (!hit || Date.now() - hit.at > CACHE_TTL) {
    const promise = compute(period);
    cache.set(period, { at: Date.now(), promise });
    promise.catch(() => { if (cache.get(period)?.promise === promise) cache.delete(period); });
  }
  return cache.get(period).promise;
}
