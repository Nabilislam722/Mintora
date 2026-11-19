import { ethers } from "ethers";
import { EmailSubscription } from "../models/EmailSubscription.js";
import { NFT } from "../models/NFT.js";
import { sendEmail, offerEmail, veHemiSoldEmail, nftSoldEmail, emailConfigured, SITE_URL } from "./email.js";

// Events older than this are skipped, so a crawler catching up doesn't email about old offers and sales
const MAX_AGE = 60 * 60_000;

const amount = (wei) => Number(ethers.formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: 4 });

// Who an activity row should email and which setting covers it, or null if it emails no one.
// A sale through an accepted offer isn't emailed: the seller accepted it themselves.
export function recipientOf(row) {
    if (row.type === "OFFER") return { address: row.to, setting: "offers" };
    if (row.type === "SOLD" && !row.viaOffer) return { address: row.from, setting: "sales" };
    return null;
}

// The email for an activity row
async function compose(row) {
    if (row.market === "vehemi") {
        const args = { tokenId: row.tokenId, amount: amount(row.price) };
        return row.type === "OFFER" ? offerEmail(args) : veHemiSoldEmail(args);
    }
    const nft = await NFT.findOne({ contractAddress: row.collection, tokenId: row.tokenId }, { name: 1, collectionId: 1 })
        .populate("collectionId", "name")
        .lean();
    return nftSoldEmail({
        name: nft?.name || `#${row.tokenId}`,
        collection: nft?.collectionId?.name,
        amount: amount(row.price),
        url: nft?.collectionId ? `${SITE_URL}/nfts/${nft.collectionId._id}/${row.tokenId}` : SITE_URL,
    });
}

// Emails the wallets new activity rows are about (`createdAt` is the block time).
// Never throws: a mail problem must not stop the crawler.
export async function notifyActivity(rows) {
    if (!emailConfigured()) return;
    const now = Date.now();
    const jobs = rows
        .map((row) => ({ row, to: recipientOf(row) }))
        .filter(({ row, to }) => to?.address && to.address !== ethers.ZeroAddress && now - row.createdAt < MAX_AGE);
    if (!jobs.length) return;

    try {
        const subs = await EmailSubscription.find({
            walletAddress: { $in: [...new Set(jobs.map((j) => j.to.address))] },
            email: { $gt: "" },
        }).lean();
        const byWallet = new Map(subs.map((s) => [s.walletAddress, s]));

        for (const { row, to } of jobs) {
            const sub = byWallet.get(to.address);
            if (!sub?.[to.setting]) continue;
            try {
                await sendEmail({ to: sub.email, ...(await compose(row)), unsubscribeToken: sub.unsubscribeToken });
                console.log(`📧 Emailed ${to.address.slice(0, 8)}… about ${row.market === "vehemi" ? "veHEMI " : ""}${row.type} #${row.tokenId}`);
            } catch (err) {
                console.error(`📧 Email to ${to.address.slice(0, 8)}… failed:`, err.message);
            }
        }
    } catch (err) {
        console.error("📧 Notifications failed:", err.message);
    }
}
