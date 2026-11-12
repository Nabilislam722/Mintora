import { ethers } from "ethers";
import { NFT } from "../models/NFT.js";

// Each collection's cheapest active listing (wei compared as numbers, not strings)
export async function getFloorPrices(contractAddresses) {
    const match = { isListed: true };
    if (contractAddresses) match.contractAddress = { $in: contractAddresses.map((a) => a.toLowerCase()) };

    const rows = await NFT.aggregate([
        { $match: match },
        { $addFields: { priceNum: { $convert: { input: "$price", to: "decimal", onError: null, onNull: null } } } },
        { $match: { priceNum: { $gt: 0 } } },
        { $sort: { priceNum: 1 } },
        { $group: { _id: "$contractAddress", price: { $first: "$price" } } },
    ]);

    return new Map(rows.map((r) => [r._id, ethers.formatEther(r.price)]));
}

// Collections with floorPrice replaced by the live floor ("0" when nothing is listed)
export async function withLiveFloors(collections) {
    const docs = collections.map((c) => (typeof c.toObject === "function" ? c.toObject() : c));
    const floors = await getFloorPrices(docs.map((c) => c.contractAddress));
    return docs.map((c) => ({ ...c, floorPrice: floors.get(c.contractAddress) ?? "0" }));
}
