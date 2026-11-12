import { Activity } from "../models/Activity.js";

const DAY = 24 * 60 * 60_000;

// Sales windows the site ranks by. Collections use 7 days: a collection that stops selling drops back once
// its sales are older than that. Top NFTs lets the visitor pick (24h, 7d, 30d).
export const SALES_PERIODS = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY };

const CACHE_TTL = 60_000;
const cache = new Map();

async function countSales(windowMs) {
    const rows = await Activity.aggregate([
        // veHEMI sales aren't collection sales
        { $match: { type: "SOLD", market: { $ne: "vehemi" }, createdAt: { $gte: new Date(Date.now() - windowMs) } } },
        { $group: { _id: "$collection", sales: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id, r.sales]));
}

// Sales per collection (by contract address) in one of SALES_PERIODS, recounted at most once a minute
export function salesByCollection(period = "7d") {
    const hit = cache.get(period);
    if (!hit || Date.now() - hit.at > CACHE_TTL) {
        const promise = countSales(SALES_PERIODS[period]);
        cache.set(period, { at: Date.now(), promise });
        promise.catch(() => { if (cache.get(period)?.promise === promise) cache.delete(period); });
    }
    return cache.get(period).promise;
}

// Collections with the most sales this week first; ties (and collections with none) by all-time volume
export async function sortBySales(collections) {
    const sales = await salesByCollection("7d");
    const count = (c) => sales.get(c.contractAddress) ?? 0;
    return [...collections].sort((a, b) => count(b) - count(a) || (b.volume ?? 0) - (a.volume ?? 0));
}
