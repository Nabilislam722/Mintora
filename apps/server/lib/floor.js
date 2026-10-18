import { ethers } from "ethers";
import { NFT } from "../models/NFT.js";

// Floor = cheapest active listing per collection. Prices are stored as wei strings, so they're
// converted to decimals before comparing; a plain string sort puts "10000000000000000" (0.01 ETH)
// ahead of "7500000000000000" (0.0075 ETH).
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

// Collections with floorPrice replaced by the live value ("0" when nothing is listed)
export async function withLiveFloors(collections) {
    const docs = collections.map((c) => (typeof c.toObject === "function" ? c.toObject() : c));
    const floors = await getFloorPrices(docs.map((c) => c.contractAddress));
    return docs.map((c) => ({ ...c, floorPrice: floors.get(c.contractAddress) ?? "0" }));
}
