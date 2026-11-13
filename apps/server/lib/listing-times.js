import { Activity } from "../models/Activity.js";

// Listed NFTs newest listing first, each with `listedAt`: when it was last listed or repriced (null if unknown)
export async function newestListingsFirst(nfts) {
  const collections = [...new Set(nfts.map((n) => n.contractAddress))];
  const rows = await Activity.aggregate([
    { $match: { type: { $in: ["LIST", "UPDATE"] }, market: { $ne: "vehemi" }, collection: { $in: collections } } },
    { $group: { _id: { collection: "$collection", tokenId: "$tokenId" }, at: { $max: "$createdAt" } } },
  ]);
  const times = new Map(rows.map((r) => [`${r._id.collection}:${r._id.tokenId}`, r.at]));
  return nfts
    .map((n) => ({ ...n, listedAt: times.get(`${n.contractAddress}:${n.tokenId}`) ?? null }))
    .sort((a, b) => (b.listedAt ?? 0) - (a.listedAt ?? 0));
}
