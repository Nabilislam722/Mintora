import { ethers } from "ethers";
import mongoose from "mongoose";
import { NFT } from "./models/NFT.js";
import { Collection } from "./models/Collection.js";
import { SyncState, CRAWLER_CURSORS } from "./models/SyncState.js";
import { Activity } from "./models/Activity.js";
import { getFloorPrices } from "./lib/floor.js";
import { createHemiProvider } from "./lib/provider.js";
import { VE_HEMI_MARKET, VE_HEMI_MARKET_DEPLOY_BLOCK, VE_TOPICS, decodeVeHemi, settleVeHemiCancels } from "./lib/vehemi-events.js";

const MARKETPLACE_ADDRESS = "0xf93AF302727E0ef59522Cd9D9Ff19Ba6b5BB7755".toLowerCase();
const ZERO_ADDRESS = ethers.ZeroAddress;

const POLL_INTERVAL = 4_000;
const OVERLAP = 5;
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

// Last block of `key`'s source whose events are all saved
async function loadBlock(key) {
    const doc = await SyncState.findOne({ key }).lean();
    return doc?.value ?? 0;
}

async function saveBlock(key, block) {
    await SyncState.updateOne({ key }, { $set: { value: block } }, { upsert: true });
}

// One NFT market or collection log as an event, or null if it isn't one we index
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

const blockTimes = new Map();
// Caches the timestamps of the events' blocks, so rows show when they happened
async function loadBlockTimes(events) {
    const missing = [...new Set(events.map((e) => e.blockNumber))].filter((n) => !blockTimes.has(n));
    const blocks = await Promise.all(missing.map((n) => provider.getBlock(n)));
    blocks.forEach((b, i) => blockTimes.set(missing[i], new Date(b.timestamp * 1000)));
    while (blockTimes.size > 2_000) blockTimes.delete(blockTimes.keys().next().value);
}

// The NFT document write an event makes
function nftOp({ type, collection, tokenId, actor, to, price }) {
    const filter = { contractAddress: collection, tokenId };
    const delisted = { isListed: false, price: "0" };
    switch (type) {
        case "LIST":
        case "UPDATE": return { updateOne: { filter, update: { $set: { isListed: true, price, seller: actor } } } };
        case "CANCEL": return { updateOne: { filter, update: { $set: delisted, $unset: { seller: "" } } } };
        case "SOLD": return { updateOne: { filter, update: { $set: { ...delisted, ownerAddress: actor }, $unset: { seller: "" } } } };
        case "TRANSFER":
            if (to === ZERO_ADDRESS) return { deleteOne: { filter } };
            return { updateOne: { filter, update: { $set: { ...delisted, ownerAddress: to }, $unset: { seller: "" } } } };
    }
}

// The activity row for an NFT market or collection event
function nftActivity(e) {
    const from = e.type === "TRANSFER" ? e.from : e.type === "SOLD" ? e.seller ?? null : e.actor;
    const to = e.type === "TRANSFER" ? e.to : e.type === "SOLD" ? e.actor : null;
    const { tx, logIndex, type, collection, tokenId, price, blockNumber } = e;
    return { tx, logIndex, type, from, to, collection, tokenId, price, blockNumber };
}

// Inserts an activity row once; reading the same log again changes nothing
function insertActivity(row) {
    return {
        updateOne: {
            filter: { tx: row.tx, logIndex: row.logIndex },
            update: { $setOnInsert: { ...row, createdAt: blockTimes.get(row.blockNumber) ?? new Date() } },
            upsert: true,
        },
    };
}

const LOG_LABEL = { LIST: "✨ Listed  ", SOLD: "💰 Sold    ", UPDATE: "📝 Updated ", CANCEL: "❌ Canceled", TRANSFER: "➡️  Transfer" };

// Applies one block range of NFT market and collection logs, in chain order
async function applyLogs(logs) {
    const events = logs
        .sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index)
        .map(decode)
        .filter((e) => e && !isMint(e));
    if (!events.length) return;

    await NFT.bulkWrite(events.map(nftOp), { ordered: true });

    const senders = new Map(events.filter((e) => e.type === "TRANSFER").map((e) => [`${e.tx}:${e.collection}:${e.tokenId}`, e.from]));
    for (const e of events) if (e.type === "SOLD") e.seller = senders.get(`${e.tx}:${e.collection}:${e.tokenId}`);

    await loadBlockTimes(events);
    const { upsertedIds } = await Activity.bulkWrite(events.map((e) => insertActivity(nftActivity(e))), { ordered: false });
    const fresh = Object.keys(upsertedIds ?? {}).map((i) => events[Number(i)]);
    if (!fresh.length) return;

    const volumes = new Map();
    for (const e of fresh) {
        volumes.set(e.collection, (volumes.get(e.collection) ?? 0n) + (e.type === "SOLD" ? BigInt(e.price) : 0n));
        console.log(`${isBurn(e) ? "🔥 Burned  " : LOG_LABEL[e.type]} ${e.collection.slice(0, 8)}… #${e.tokenId}`);
    }

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

const VE_LOG_LABEL = { SOLD: "💎 veHEMI sold", LIST: "✨ veHEMI listed", UPDATE: "📝 veHEMI repriced", CANCEL: "❌ veHEMI delisted", OFFER: "🤝 veHEMI offer on" };

// Saves one block range of veHEMI market events as activity rows
async function applyVeHemiLogs(logs) {
    const rows = settleVeHemiCancels(logs.map(decodeVeHemi).filter(Boolean));
    if (!rows.length) return;
    await loadBlockTimes(rows);
    const { upsertedIds } = await Activity.bulkWrite(rows.map(insertActivity), { ordered: false });
    for (const i of Object.keys(upsertedIds ?? {})) {
        const r = rows[Number(i)];
        const amount = r.price !== "0" ? ` for ${ethers.formatEther(r.price)} HEMI` : "";
        console.log(`${VE_LOG_LABEL[r.type]} #${r.tokenId}${amount}${r.viaOffer ? " (offer accepted)" : ""}`);
    }
}

let stopping = false;

const SOURCES = [
    {
        name: "NFT market",
        key: CRAWLER_CURSORS.nft,
        async filter() {
            const collections = await Collection.find({}, { contractAddress: 1 }).lean();
            const address = [MARKETPLACE_ADDRESS, ...collections.map((c) => c.contractAddress?.toLowerCase()).filter(Boolean)];
            return { address, topics: TOPICS };
        },
        apply: applyLogs,
    },
    {
        name: "veHEMI market",
        key: CRAWLER_CURSORS.vehemi,
        startBlock: VE_HEMI_MARKET_DEPLOY_BLOCK,
        filter: async () => ({ address: VE_HEMI_MARKET, topics: VE_TOPICS }),
        apply: applyVeHemiLogs,
    },
].map((source) => ({ ...source, span: MAX_SPAN }));

// Reads one source from its saved block to `head`, saving progress after each range
async function scan(source, head) {
    let saved = await loadBlock(source.key);
    if (!saved) {
        if (!source.startBlock) {
            await saveBlock(source.key, head);
            console.log(`📌 ${source.name}: initialized at block ${head}`);
            return;
        }
        saved = source.startBlock - 1;
    }
    if (head <= saved) return;

    const filter = await source.filter();
    let from = Math.max(1, saved - OVERLAP);
    if (head - saved > MAX_SPAN) console.log(`⏩ ${source.name}: catching up ${saved} → ${head} (${head - saved} blocks)`);

    while (from <= head && !stopping) {
        const to = Math.min(head, from + source.span - 1);
        let logs;
        try {
            logs = await provider.getLogs({ ...filter, fromBlock: from, toBlock: to });
        } catch (err) {
            if (source.span <= MIN_SPAN) throw err;
            source.span = Math.max(MIN_SPAN, Math.floor(source.span / 2));
            console.warn(`${source.name}: getLogs ${from}–${to} failed (${err.shortMessage ?? err.message}); retrying ${source.span} blocks at a time`);
            continue;
        }
        await source.apply(logs);
        await saveBlock(source.key, to);
        from = to + 1;
        source.span = Math.min(MAX_SPAN, source.span * 2);
    }
}

// Scans every source up to the current chain head
async function pass() {
    const head = await provider.getBlockNumber();
    for (const source of SOURCES) {
        if (stopping) return;
        await scan(source, head);
    }
}

let current = null;

// Runs passes until stopped, waiting longer after each failure
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

// Finishes the current range, then disconnects and exits
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
    for (const source of SOURCES) {
        const saved = await loadBlock(source.key);
        console.log(`📡 ${source.name}: resuming from block ${saved || source.startBlock || "latest"}`);
    }
    run();
} catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
}
