import { Activity } from "../models/Activity.js";
import { SALES_PERIODS } from "./trending.js";

const PERIOD = "7d";
const CACHE_TTL = 60_000;
let cached = null;

async function compute() {
  const rows = await Activity.find(
    { type: "SOLD", createdAt: { $gte: new Date(Date.now() - SALES_PERIODS[PERIOD]) } },
    { price: 1, market: 1, _id: 0 }
  ).lean();

  // NFT sales are priced in ETH and veHEMI sales in HEMI, so their volumes are kept apart (in wei)
  const totals = { nft: { sales: 0, volume: 0n }, vehemi: { sales: 0, volume: 0n } };
  for (const { price, market } of rows) {
    const total = totals[market === "vehemi" ? "vehemi" : "nft"];
    total.sales++;
    try {
      total.volume += BigInt(price || 0);
    } catch {
      // A malformed price adds nothing
    }
  }
  const out = (t) => ({ sales: t.sales, volume: t.volume.toString() });
  return { period: PERIOD, nft: out(totals.nft), vehemi: out(totals.vehemi) };
}

// Sales and volume over the last 7 days, for the activity page. Recounted at most once a minute.
export function salesSummary() {
  if (!cached || Date.now() - cached.at > CACHE_TTL) {
    const promise = compute();
    cached = { at: Date.now(), promise };
    promise.catch(() => { if (cached?.promise === promise) cached = null; });
  }
  return cached.promise;
}
