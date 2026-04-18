import { ethers } from "ethers";
import mongoose from "mongoose";
import { NFT } from "./models/NFT.js";
import { Collection } from "./models/Collection.js";
import { SyncState } from "./models/SyncState.js";

const HEMI_RPC = "https://rpc.hemi.network/rpc";
const MARKETPLACE_ADDRESS = "0xf93AF302727E0ef59522Cd9D9Ff19Ba6b5BB7755";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RECOVERY_INTERVAL = 60_000;
const REFRESH_INTERVAL = 120_000;
const BLOCK_CHUNK = 500;
const LOOKBACK_BLOCKS = 10;   // always rescan last N blocks — catches anything live missed
const WORKER_INTERVAL = 100;
const MAX_BATCH = 20;

const MARKETPLACE_ABI = [
    "event ItemListed(address indexed seller, address indexed nft, uint256 indexed tokenId, uint256 price)",
    "event ItemSold(address indexed buyer, address indexed nft, uint256 indexed tokenId, uint256 price)",
    "event ItemCanceled(address indexed seller, address indexed nft, uint256 indexed tokenId)",
    "event ItemUpdated(address indexed seller, address indexed nft, uint256 indexed tokenId, uint256 newPrice)"
];

const ERC721_ABI = [
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const ERC721_INTERFACE = new ethers.Interface(ERC721_ABI);
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

const EVENT_TYPE_MAP = {
    ItemListed: "LIST",
    ItemSold: "SOLD",
    ItemUpdated: "UPDATE",
    ItemCanceled: "CANCEL",
};

let provider;
let marketplace;
let lastProcessedBlock = 0;
let isSyncing = false;
let isReconnecting = false;

const activeListeners = new Map();
const recoveryQueue = [];
let processing = false;

let saveBlockTimer = null;
let pendingBlock = 0;


class LRUSet {
    constructor(max) {
        this.max = max;
        this.set = new Set();
        this.q = [];
    }
    has(k) { return this.set.has(k); }
    add(k) {
        if (this.set.has(k)) return;
        if (this.q.length >= this.max) this.set.delete(this.q.shift());
        this.set.add(k);
        this.q.push(k);
    }
}

const seen = new LRUSet(10_000);
const eventKey = e => {
       // handle both the Live payload wrapper and the direct log object
    const logObj = e.log || e; 
    return `${logObj.transactionHash}-${logObj.index ?? logObj.logIndex}`;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));


async function withRetry(fn, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            if (i === retries - 1) throw err;
            await sleep(1_000 * (i + 1));
        }
    }
}


function scheduleSaveBlock(block) {
    if (block > pendingBlock) pendingBlock = block;
    if (saveBlockTimer) return;
    saveBlockTimer = setTimeout(async () => {
        saveBlockTimer = null;
        lastProcessedBlock = pendingBlock;
        await SyncState.updateOne(
            { key: "lastBlock" },
            { value: pendingBlock },
            { upsert: true }
        ).catch(err => console.error("saveBlock failed:", err));
    }, 1_000);
}

async function saveBlockNow(block) {
    lastProcessedBlock = block;
    pendingBlock = block;
    if (saveBlockTimer) {
        clearTimeout(saveBlockTimer);
        saveBlockTimer = null;
    }
    await SyncState.updateOne(
        { key: "lastBlock" },
        { value: block },
        { upsert: true }
    );
}

async function loadBlock() {
    const doc = await SyncState.findOne({ key: "lastBlock" });
    return doc?.value ?? 0;
}


function createProvider() {
    const p = new ethers.JsonRpcProvider(HEMI_RPC, undefined, {
        pollingInterval: 500
    });
    p.on("error", async (err) => {
        console.error("Provider error:", err.message);
        await reconnect();
    });
    return p;
}

async function reconnect() {
    if (isReconnecting) return;
    isReconnecting = true;
    console.log("🔄 Reconnecting...");

    provider.off("block");
    for (const [, { contract, listener }] of activeListeners) {
        try { contract.off("Transfer", listener); } catch { }
    }
    activeListeners.clear();

    await sleep(3_000);

    provider = createProvider();
    marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);

    setupBlockTracker();
    setupListeners();
    await refreshNFTListeners();

    isReconnecting = false;
    console.log("✅ Reconnected");
}


function setupBlockTracker() {
    provider.on("block", (blockNumber) => {
        scheduleSaveBlock(blockNumber);
    });
}


async function dispatchLive(type, args, event) {
    const key = eventKey(event);
    if (seen.has(key)) return;
    seen.add(key);

    try {
        switch (type) {
            case "LIST": await handleItemListed(...args, event); break;
            case "SOLD": await handleItemSold(...args, event); break;
            case "UPDATE": await handleItemUpdated(...args, event); break;
            case "CANCEL": await handleItemCanceled(...args, event); break;
            case "TRANSFER": await handleTransfer(...args, event); break;
        }
    } catch (err) {
        console.error(`Handler error [${type}]:`, err);
    }
}

function enqueueRecovery(type, args, event) {
    const key = eventKey(event);
    if (seen.has(key)) return;
    seen.add(key);
    recoveryQueue.push({ type, args, event });
}

async function processRecoveryQueue() {
    if (processing || recoveryQueue.length === 0) return;
    processing = true;

    try {
        const batch = recoveryQueue.splice(0, MAX_BATCH);
        const nftOps = [];
        const statsToUpdate = new Map(); // Track which collections need a floor update

        for (const job of batch) {
            const { type, args } = job;

            // Shared normalization
            const contractAddress = (type === "TRANSFER" ? args[3] : args[1]).toLowerCase();
            const tokenId = args[2].toString();

            switch (type) {
                case "LIST":
                    nftOps.push({
                        updateOne: {
                            filter: { contractAddress, tokenId },
                            update: { isListed: true, price: args[3].toString(), seller: args[0].toLowerCase() }
                        }
                    });
                    break;

                case "SOLD":
                    nftOps.push({
                        updateOne: {
                            filter: { contractAddress, tokenId },
                            update: { $set: { isListed: false, price: "0", ownerAddress: args[0].toLowerCase() }, $unset: { seller: "" } } // <-- Explicit $set added
                        }
                    });
                    // Queue stats update: price is args[3]
                    statsToUpdate.set(contractAddress, (statsToUpdate.get(contractAddress) || 0n) + BigInt(args[3].toString()));
                    break;

                case "UPDATE":
                    nftOps.push({
                        updateOne: {
                            filter: { contractAddress, tokenId },
                            update: { price: args[3].toString() }
                        }
                    });
                    break;

                case "CANCEL":
                    nftOps.push({
                        updateOne: {
                            filter: { contractAddress, tokenId },
                            update: { $set: { isListed: false, price: "0" }, $unset: { seller: "" } }
                        }
                    });
                    break;

                case "TRANSFER":
                    //mint_skip
                    if (args[0].toLowerCase() === ZERO_ADDRESS) break;

                    nftOps.push({
                        updateOne: {
                            filter: { contractAddress, tokenId },
                            update: { $set: { ownerAddress: args[1].toLowerCase(), isListed: false, price: "0" }, $unset: { seller: "" } } // <-- Explicit $set added
                        }
                    });
                    break;
            }
        }

        if (nftOps.length > 0) {
            await NFT.bulkWrite(nftOps, { ordered: false });
        }

        // Trigger stats updates in the background (Non-blocking)
        for (const [address, volumeAdded] of statsToUpdate) {
            updateFloorAndVolume(address, volumeAdded).catch(err =>
                console.error(`Stats background error: ${address}`, err)
            );
        }

    } catch (err) {
        console.error("BulkWrite Worker Error:", err);
    } finally {
        processing = false;
    }
}


async function updateFloorAndVolume(contractAddress, salePriceBigInt) {
    setImmediate(async () => {
        try {
            const cheapest = await NFT.findOne({ contractAddress, isListed: true })
                .sort({ price: 1 })
                .select('price')
                .lean();

            await Collection.updateOne(
                { contractAddress },
                {
                    $set: { floorPrice: ethers.formatEther(cheapest?.price || "0") },
                    $inc: { volume: parseFloat(ethers.formatEther(salePriceBigInt)) }
                }
            );
        } catch (err) {
            console.error("Stats error:", err);
        }
    });
}


async function handleItemListed(seller, nft, tokenId, price, event) {
    await NFT.updateOne(
        { contractAddress: nft.toLowerCase(), tokenId: tokenId.toString() },
        { isListed: true, price: price.toString(), seller: seller.toLowerCase() }
    );
    console.log(`✨ Listed   ${nft.slice(0, 8)}… #${tokenId}`);
}

async function handleItemSold(buyer, nft, tokenId, price, event) {
    const contractAddress = nft.toLowerCase();
    await NFT.updateOne(
        { contractAddress, tokenId: tokenId.toString() },
        { $set: { isListed: false, price: "0", ownerAddress: buyer.toLowerCase() }, $unset: { seller: "" } }
    );
    await updateFloorAndVolume(contractAddress, BigInt(price.toString()));
    console.log(`💰 Sold     ${nft.slice(0, 8)}… #${tokenId}`);
}

async function handleItemUpdated(seller, nft, tokenId, newPrice, event) {
    await NFT.updateOne(
        { contractAddress: nft.toLowerCase(), tokenId: tokenId.toString() },
        { price: newPrice.toString() }
    );
    console.log(`📝 Updated  ${nft.slice(0, 8)}… #${tokenId}`);
}

async function handleItemCanceled(seller, nft, tokenId, event) {
    await NFT.updateOne(
        { contractAddress: nft.toLowerCase(), tokenId: tokenId.toString() },
        { $set: { isListed: false, price: "0" }, $unset: { seller: "" } }
    );
    console.log(`❌ Canceled ${nft.slice(0, 8)}… #${tokenId}`);
}

async function handleTransfer(from, to, tokenId, contractAddress, event) {
    //mint
    if (from.toLowerCase() === ZERO_ADDRESS) return;
    //burn
    if (to.toLowerCase() === ZERO_ADDRESS) {
        await NFT.deleteOne({
            contractAddress: contractAddress.toLowerCase(),
            tokenId: tokenId.toString()
        });
        console.log(`🔥 Burned   ${contractAddress.slice(0, 8)}… #${tokenId}`);
        return;
    }

    await NFT.updateOne(
        { contractAddress: contractAddress.toLowerCase(), tokenId: tokenId.toString() },
        { $set: { ownerAddress: to.toLowerCase(), isListed: false, price: "0" }, $unset: { seller: "" } }
    );
    console.log(`➡️  Transfer ${contractAddress.slice(0, 8)}… #${tokenId}`);
}


function setupListeners() {
    marketplace.on("ItemListed", (s, n, i, p, e) => dispatchLive("LIST", [s, n, i, p], e));
    marketplace.on("ItemSold", (b, n, i, p, e) => dispatchLive("SOLD", [b, n, i, p], e));
    marketplace.on("ItemUpdated", (s, n, i, p, e) => dispatchLive("UPDATE", [s, n, i, p], e));
    marketplace.on("ItemCanceled", (s, n, i, e) => dispatchLive("CANCEL", [s, n, i], e));
}

async function startTransferListener(contractAddress) {
    if (activeListeners.has(contractAddress)) return;

    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    const listener = (from, to, tokenId, event) =>
        dispatchLive("TRANSFER", [from, to, tokenId, contractAddress], event);

    contract.on("Transfer", listener);
    activeListeners.set(contractAddress, { contract, listener });
    console.log(`🔗 Watching transfers: ${contractAddress}`);
}

async function refreshNFTListeners() {
    try {
        const collections = await Collection.find({}, { contractAddress: 1 }).lean();
        for (const { contractAddress } of collections) {
            await startTransferListener(contractAddress.toLowerCase());
        }
    } catch (err) {
        console.error("Refresh listeners error:", err);
    }
}


async function recoverTransfers(from, to) {
    const knownAddresses = [...activeListeners.keys()];
    if (knownAddresses.length === 0) return;

    const logs = await withRetry(() =>
        provider.getLogs({
            fromBlock: from,
            toBlock: to,
            address: knownAddresses,
            topics: [TRANSFER_TOPIC],
        })
    );

    for (const log of logs) {
        const contractAddress = log.address.toLowerCase();
        try {
            const parsed = ERC721_INTERFACE.parseLog(log);
            const [from_, to_, tokenId] = parsed.args;
            enqueueRecovery("TRANSFER", [from_, to_, tokenId, contractAddress], {
                transactionHash: log.transactionHash,
                index: log.index,
                logIndex: log.logIndex,
                blockNumber: log.blockNumber,
            });
        } catch { }
    }
}

async function recoverMissedEvents() {
    if (isSyncing) return;

    let currentBlock;
    try {
        currentBlock = await provider.getBlockNumber();
    } catch (err) {
        console.error("Could not fetch block number:", err.message);
        return;
    }

    if (!lastProcessedBlock) {
        await saveBlockNow(currentBlock);
        console.log(`📌 Initialized at block ${currentBlock}`);
        return;
    }

    // Always scan from a few blocks back so live listener misses are caught,
    // then continue forward if we're also behind from a restart/outage.
    const from = Math.max(1, lastProcessedBlock - LOOKBACK_BLOCKS);
    const to = currentBlock;

    if (from > to) return;

    isSyncing = true;

    try {
        let cursor = from;

        while (cursor <= to) {
            const chunkEnd = Math.min(to, cursor + BLOCK_CHUNK - 1);

            const marketplaceEvents = await withRetry(() =>
                marketplace.queryFilter("*", cursor, chunkEnd)
            );
            for (const e of marketplaceEvents) {
                const type = EVENT_TYPE_MAP[e.eventName];
                if (type) enqueueRecovery(type, [...e.args], e);
            }

            await recoverTransfers(cursor, chunkEnd);

            cursor = chunkEnd + 1;
            await sleep(300);
        }

        await saveBlockNow(to);
        console.log(`✅ Scanned ${from} → ${to}`);
    } catch (err) {
        console.error("Recovery error:", err);
        await sleep(5_000);
    } finally {
        isSyncing = false;
    }
}


async function startCrawler() {
    provider = createProvider();
    marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);

    lastProcessedBlock = await loadBlock();
    console.log(`📡 Crawler started — resuming from block ${lastProcessedBlock || "latest"}`);

    setupBlockTracker();
    setupListeners();
    await refreshNFTListeners();

    setInterval(processRecoveryQueue, WORKER_INTERVAL);
    setInterval(refreshNFTListeners, REFRESH_INTERVAL);
    setInterval(recoverMissedEvents, RECOVERY_INTERVAL);
}

async function init() {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/nft_marketplace");
        console.log("📦 MongoDB connected");
        await startCrawler();
    } catch (err) {
        console.error("Startup failed:", err);
        process.exit(1);
    }
}

process.on("SIGINT", async () => {
    console.log("🛑 Shutting down...");
    provider.off("block");
    for (const [, { contract, listener }] of activeListeners) {
        try { contract.off("Transfer", listener); } catch { }
    }
    if (saveBlockTimer) {
        clearTimeout(saveBlockTimer);
        await saveBlockNow(pendingBlock);
    }
    await mongoose.disconnect();
    process.exit(0);
});

init();