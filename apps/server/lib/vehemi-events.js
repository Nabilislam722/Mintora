import { ethers } from "ethers";

export const VE_HEMI_MARKET = "0x6Fd47e5dA6c06a7D77A57893FD22C478b56C4Db1".toLowerCase();
export const VE_HEMI = "0x371d3718D5b7F75EAb050FAe6Da7DF3092031c89".toLowerCase();
export const VE_HEMI_MARKET_DEPLOY_BLOCK = 5_633_113;

const VE_MARKET = new ethers.Interface([
    "event Sold(uint256 indexed tokenId, uint256 indexed listingId, address indexed seller, address buyer, uint256 price, uint256 fee)",
    "event OfferAccepted(uint256 indexed tokenId, uint256 indexed offerId, address indexed seller, address buyer, uint256 amount, uint256 fee)",
    "event Listed(uint256 indexed tokenId, uint256 indexed listingId, address indexed seller, uint256 price, uint256 expiry, uint256 lockAmount, uint256 maxLockAmount, uint256 lockEnd)",
    "event ListingCanceled(uint256 indexed tokenId, uint256 indexed listingId, address indexed seller)",
    "event OfferMade(uint256 indexed tokenId, uint256 indexed offerId, address indexed buyer, uint256 amount, uint256 expiry, uint256 minLockAmount, uint256 maxLockEnd, address seller)",
]);

export const VE_TOPICS = [["Sold", "OfferAccepted", "Listed", "ListingCanceled", "OfferMade"].map((name) => VE_MARKET.getEvent(name).topicHash)];

// A veHEMI market event as an activity row, or null for any other log
export function decodeVeHemi(log) {
    try {
        const parsed = VE_MARKET.parseLog(log);
        if (!parsed) return null;
        const a = parsed.args;
        const row = {
            tx: log.transactionHash, logIndex: log.index, blockNumber: log.blockNumber,
            market: "vehemi", collection: VE_HEMI, tokenId: a.tokenId.toString(),
        };
        switch (parsed.name) {
            case "Sold":
                return { ...row, type: "SOLD", viaOffer: false, from: a.seller.toLowerCase(), to: a.buyer.toLowerCase(), price: a.price.toString() };
            case "OfferAccepted":
                return { ...row, type: "SOLD", viaOffer: true, from: a.seller.toLowerCase(), to: a.buyer.toLowerCase(), price: a.amount.toString() };
            case "Listed":
                return { ...row, type: "LIST", from: a.seller.toLowerCase(), to: null, price: a.price.toString() };
            case "ListingCanceled":
                return { ...row, type: "CANCEL", from: a.seller.toLowerCase(), to: null, price: "0" };
            case "OfferMade":
                return { ...row, type: "OFFER", from: a.buyer.toLowerCase(), to: a.seller.toLowerCase(), price: a.amount.toString() };
        }
        return null;
    } catch {
        return null;
    }
}

// Drops the cancels a re-list or accepted offer emits, and marks a seller's re-list as UPDATE
export function settleVeHemiCancels(rows) {
    const key = (r) => `${r.tx}:${r.tokenId}`;
    const cancels = new Map(rows.filter((r) => r.type === "CANCEL").map((r) => [key(r), r]));
    const cleared = new Set();
    for (const r of rows) {
        const cancel = r.type !== "CANCEL" && cancels.get(key(r));
        if (!cancel) continue;
        cleared.add(cancel);
        if (r.type === "LIST" && r.from === cancel.from) r.type = "UPDATE";
    }
    return rows.filter((r) => !cleared.has(r));
}
