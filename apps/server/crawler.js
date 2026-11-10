import { ethers } from "ethers";
import mongoose from "mongoose";
import { NFT } from "./models/NFT.js";
import { Collection } from "./models/Collection.js";
import { SyncState } from "./models/SyncState.js";
import { Activity } from "./models/Activity.js";
import { getFloorPrices } from "./lib/floor.js";
import { createHemiProvider } from "./lib/provider.js";

const MARKETPLACE_ADDRESS = "0xf93AF302727E0ef59522Cd9D9Ff19Ba6b5BB7755".toLowerCase();
const ZERO_ADDRESS = ethers.ZeroAddress;

// Hemi makes a block about every 12 s, so this sees each one within a few seconds of it
const POLL_INTERVAL = 4_000;
// Each pass re-reads this many blocks below the last saved one. Applying an event again leaves the same state,
// so this costs only a few log rows, and it catches logs that a load-balanced RPC node hadn't indexed yet when
// another node reported the block.
const OVERLAP = 5;
// Blocks per eth_getLogs when catching up. Halved while the RPC refuses a range, then grown back.
const MAX_SPAN = 10_000;
const MIN_SPAN = 100;
const MAX_BACKOFF = 60_000;

const MARKETPLACE = new ethers.Interface([
    "event ItemListed(address indexed seller, address indexed nft, uint256 indexed tokenId, uint256 price)",
    "event ItemSold(address indexed buyer, address indexed nft, uint256 indexed tokenId, uint256 price)",
    "event ItemCanceled(address indexed seller, address indexed nft, uint256 indexed tokenId)",
    "event ItemUpdated(address indexed seller, address indexed nft, uint256 indexed tokenId, uint256 newPrice)",
]);
const ERC721 = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

const EVENT_TYPES = { ItemListed: "LIST", ItemSold: "SOLD", ItemUpdated: "UPDATE", ItemCanceled: "CANCEL" };
const TRANSFER_TOPIC = ERC721.getEvent("Transfer").topicHash;
const TOPICS = [[...Object.keys(EVENT_TYPES).map((name) => MARKETPLACE.getEvent(name).topicHash), TRANSFER_TOPIC]];

const provider = createHemiProvider("crawler");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The saved position is the last block whose events are all in the database
async function loadBlock() {
    const doc = await SyncState.findOne({ key: "lastBlock" }).lean();
    return doc?.value ?? 0;
}

async function saveBlock(block) {
    await SyncState.updateOne({ key: "lastBlock" }, { $set: { value: block } }, { upsert: true });
}

// One normalised event per log we index, or null for anything else
function decode(log) {
    const address = log.address.toLowerCase();
    const base = { tx: log.transactionHash, logIndex: log.index, blockNumber: log.blockNumber };
    try {
        if (address === MARKETPLACE_ADDRESS) {
            const parsed = MARKETPLACE.parseLog(log);
            const type = parsed && EVENT_TYPES[parsed.name];
            if (!type) return null;
            const [actor, nft, tokenId, price] = parsed.args;
            return {
                ...base, type,
                actor: actor.toLowerCase(),
                collection: nft.toLowerCase(),
                tokenId: tokenId.toString(),
                price: price?.toString() ?? "0",
            };
        }
        // An ERC-20 Transfer has the same topic but only 3 topics, since its amount isn't indexed
        if (log.topics[0] !== TRANSFER_TOPIC || log.topics.length !== 4) return null;
        const [from, to, tokenId] = ERC721.parseLog(log).args;
        return {
            ...base, type: "TRANSFER",
            from: from.toLowerCase(),
            to: to.toLowerCase(),
            collection: address,
            tokenId: tokenId.toString(),
            price: "0",
        };
    } catch {
        return null;
    }
}

const isMint = (e) => e.type === "TRANSFER" && e.from === ZERO_ADDRESS;
const isBurn = (e) => e.type === "TRANSFER" && e.to === ZERO_ADDRESS;

// Block times, so events read during a catch-up show when they happened rather than when they were read
const blockTimes = new Map();
async function loadBlockTimes(events) {
    const missing = [...new Set(events.map((e) => e.blockNumber))].filter((n) => !blockTimes.has(n));
    // ethers sends these as JSON-RPC batches
    const blocks = await Promise.all(missing.map((n) => provider.getBlock(n)));
    blocks.forEach((b, i) => blockTimes.set(missing[i], new Date(b.timestamp * 1000)));
    while (blockTimes.size > 2_000) blockTimes.delete(blockTimes.keys().next().value);
}

function nftOp({ type, collection, tokenId, actor, to, price }) {
    const filter = { contractAddress: collection, tokenId };
    const delisted = { isListed: false, price: "0" };
    switch (type) {
        // updateListing only succeeds on a live listing whose seller still owns the NFT, so it relists too
        case "LIST":
        case "UPDATE": return { updateOne: { filter, update: { $set: { isListed: true, price, seller: actor } } } };
        case "CANCEL": return { updateOne: { filter, update: { $set: delisted, $unset: { seller: "" } } } };
        case "SOLD": return { updateOne: { filter, update: { $set: { ...delisted, ownerAddress: actor }, $unset: { seller: "" } } } };
        case "TRANSFER":
            if (to === ZERO_ADDRESS) return { deleteOne: { filter } };
            return { updateOne: { filter, update: { $set: { ...delisted, ownerAddress: to }, $unset: { seller: "" } } } };
    }
}

function activityOp(e) {
    const from = e.type === "TRANSFER" ? e.from : e.type === "SOLD" ? null : e.actor;
    const to = e.type === "TRANSFER" ? e.to : e.type === "SOLD" ? e.actor : null;
    return {
        updateOne: {
            filter: { tx: e.tx, logIndex: e.logIndex },
            update: {
                $setOnInsert: {
                    tx: e.tx, logIndex: e.logIndex, type: e.type, from, to,
                    collection: e.collection, tokenId: e.tokenId, price: e.price,
                    blockNumber: e.blockNumber, createdAt: blockTimes.get(e.blockNumber) ?? new Date(),
                },
            },
            upsert: true,
        },
    };
}

const LOG_LABEL = { LIST: "✨ Listed  ", SOLD: "💰 Sold    ", UPDATE: "📝 Updated ", CANCEL: "❌ Canceled", TRANSFER: "➡️  Transfer" };

// Applies a range's logs in chain order. Safe to run again over the same blocks: the NFT writes set state rather
// than change it, activity rows are keyed by tx and log index, and only rows this run inserted add to volume.
async function applyLogs(logs) {
    const events = logs
        .sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index)
        .map(decode)
        .filter((e) => e && !isMint(e));
    if (!events.length) return;

    // Ordered, so a listing and its cancel in the same range land in that order
    await NFT.bulkWrite(events.map(nftOp), { ordered: true });

    await loadBlockTimes(events);
    const { upsertedIds } = await Activity.bulkWrite(events.map(activityOp), { ordered: false });
    const fresh = Object.keys(upsertedIds ?? {}).map((i) => events[Number(i)]);
    if (!fresh.length) return;

    const volumes = new Map();
    for (const e of fresh) {
        volumes.set(e.collection, (volumes.get(e.collection) ?? 0n) + (e.type === "SOLD" ? BigInt(e.price) : 0n));
        console.log(`${isBurn(e) ? "🔥 Burned  " : LOG_LABEL[e.type]} ${e.collection.slice(0, 8)}… #${e.tokenId}`);
    }

    // Any listing change or burn can move the floor; only sales add volume
    const floors = await getFloorPrices([...volumes.keys()]);
    await Collection.bulkWrite([...volumes].map(([contractAddress, wei]) => ({
        updateOne: {
            filter: { contractAddress },
            update: {
                $set: { floorPrice: floors.get(contractAddress) ?? "0" },
                ...(wei > 0n && { $inc: { volume: parseFloat(ethers.formatEther(wei)) } }),
            },
        },
    })));
}

let stopping = false;
let span = MAX_SPAN;

// Reads every block from the saved position to the chain head, saving the position after each range is written
async function pass() {
    const head = await provider.getBlockNumber();
    const saved = await loadBlock();

    if (!saved) {
        await saveBlock(head);
        console.log(`📌 Initialized at block ${head}`);
        return;
    }
    if (head <= saved) return;

    const collections = await Collection.find({}, { contractAddress: 1 }).lean();
    // One query covers the marketplace and every collection's transfers
    const addresses = [MARKETPLACE_ADDRESS, ...collections.map((c) => c.contractAddress?.toLowerCase()).filter(Boolean)];

    let from = Math.max(1, saved - OVERLAP);
    if (head - saved > MAX_SPAN) console.log(`⏩ Catching up ${saved} → ${head} (${head - saved} blocks)`);

    while (from <= head && !stopping) {
        const to = Math.min(head, from + span - 1);
        let logs;
        try {
            logs = await provider.getLogs({ fromBlock: from, toBlock: to, address: addresses, topics: TOPICS });
        } catch (err) {
            if (span <= MIN_SPAN) throw err;
            span = Math.max(MIN_SPAN, Math.floor(span / 2));
            console.warn(`getLogs ${from}–${to} failed (${err.shortMessage ?? err.message}); retrying ${span} blocks at a time`);
            continue;
        }
        await applyLogs(logs);
        await saveBlock(to);
        from = to + 1;
        span = Math.min(MAX_SPAN, span * 2);
    }
}

let current = null;

async function run() {
    let failures = 0;
    while (!stopping) {
        current = pass();
        try {
            await current;
            failures = 0;
        } catch (err) {
            failures++;
            console.error(`Crawler pass failed (${failures} in a row):`, err.shortMessage ?? err.message);
        } finally {
            current = null;
        }
        if (!stopping) await sleep(failures ? Math.min(MAX_BACKOFF, POLL_INTERVAL * 2 ** failures) : POLL_INTERVAL);
    }
}

async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    console.log(`🛑 ${signal}: finishing the current range, then stopping`);
    await current?.catch(() => {});
    await mongoose.disconnect();
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
    await mongoose.connect(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/nft_marketplace");
    console.log("📦 MongoDB connected");
    console.log(`📡 Crawler started — resuming from block ${(await loadBlock()) || "latest"}`);
    run();
} catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
}
