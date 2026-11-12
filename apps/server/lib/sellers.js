import { Activity } from "../models/Activity.js";

const tokenKey = (r) => `${r.collection}:${r.tokenId}`;

// Fills in old NFT sales' sellers from the sale's Transfer, or else the last listing before it
export async function withSellers(rows) {
  const missing = rows.filter((r) => r.type === "SOLD" && !r.from && r.market !== "vehemi");
  if (!missing.length) return rows;

  const tokens = [...new Map(missing.map((r) => [tokenKey(r), { collection: r.collection, tokenId: r.tokenId }])).values()];
  const [transfers, listings] = await Promise.all([
    Activity.find({ tx: { $in: missing.map((r) => r.tx) }, type: "TRANSFER" }).select("tx collection tokenId from").lean(),
    Activity.find({ type: { $in: ["LIST", "UPDATE"] }, market: { $ne: "vehemi" }, $or: tokens })
      .select("collection tokenId from createdAt")
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  const senders = new Map(transfers.map((t) => [`${t.tx}:${tokenKey(t)}`, t.from]));

  const sellers = new Map();
  for (const sale of missing) {
    const lister = listings.find((l) => tokenKey(l) === tokenKey(sale) && l.createdAt <= sale.createdAt);
    const seller = senders.get(`${sale.tx}:${tokenKey(sale)}`) ?? lister?.from;
    if (seller) sellers.set(sale, seller);
  }
  return rows.map((r) => (sellers.has(r) ? { ...r, from: sellers.get(r) } : r));
}
