import { ethers } from "ethers";
import { SyncState } from "../models/SyncState.js";

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const ERC721_ENUMERABLE = "0x780e9d63";
const DISCOVERY_ABI = [
    "function supportsInterface(bytes4 interfaceId) view returns (bool)",
    "function totalSupply() view returns (uint256)",
    "function tokenByIndex(uint256 index) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
];
const BATCH = 25;

const sortIds = (ids) => ids.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));

// Runs `fn` over `items` 25 at a time
async function inBatches(items, fn) {
    const out = [];
    for (let i = 0; i < items.length; i += BATCH) {
        out.push(...(await Promise.all(items.slice(i, i + BATCH).map(fn))));
    }
    return out;
}

// The first block with the contract's code (binary search, cached in SyncState)
async function getDeployBlock(provider, address) {
    const key = `deployBlock:${address.toLowerCase()}`;
    const cached = await SyncState.findOne({ key }).lean();
    if (cached) return cached.value;

    let lo = 0;
    let hi = await provider.getBlockNumber();
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const code = await provider.getCode(address, mid);
        if (code && code !== "0x") hi = mid;
        else lo = mid + 1;
    }
    await SyncState.updateOne({ key }, { $set: { value: lo } }, { upsert: true });
    return lo;
}

// The contract's Transfer logs in a block range, shrinking chunks when the RPC refuses one
async function getTransferLogs(provider, address, fromBlock, toBlock) {
    const logs = [];
    let chunk = 500_000;
    for (let start = fromBlock; start <= toBlock; ) {
        const end = Math.min(start + chunk - 1, toBlock);
        try {
            logs.push(...(await provider.getLogs({ address, topics: [TRANSFER_TOPIC], fromBlock: start, toBlock: end })));
            start = end + 1;
            chunk = Math.min(chunk * 2, 5_000_000);
        } catch (err) {
            if (chunk <= 1_000) throw err;
            chunk = Math.floor(chunk / 4);
        }
    }
    return logs;
}

// Whether the token still exists (ownerOf succeeds)
async function exists(contract, tokenId) {
    try {
        await contract.ownerOf(tokenId);
        return true;
    } catch {
        return false;
    }
}

// A collection's live token ids and burned known ones: tokenByIndex, Transfer history or 0..supply
export async function discoverTokenIds(provider, address, knownIds = []) {
    const contract = new ethers.Contract(address, DISCOVERY_ABI, provider);
    let ids;
    let method;

    if (await contract.supportsInterface(ERC721_ENUMERABLE).catch(() => false)) {
        const supply = Number(await contract.totalSupply());
        const indexes = Array.from({ length: supply }, (_, i) => i);
        ids = (await inBatches(indexes, (i) => contract.tokenByIndex(i))).map(String);
        method = "enumerable";
    } else {
        const latest = await provider.getBlockNumber();
        const deployBlock = await getDeployBlock(provider, address);
        const live = new Set();
        for (const log of await getTransferLogs(provider, address, deployBlock, latest)) {
            if (log.topics.length !== 4) continue;
            const tokenId = BigInt(log.topics[3]).toString();
            const to = ethers.getAddress(ethers.dataSlice(log.topics[2], 12));
            if (to === ethers.ZeroAddress) live.delete(tokenId);
            else live.add(tokenId);
        }
        ids = [...live];
        method = "transfer-logs";

        if (ids.length === 0) {
            const supply = Number(await contract.totalSupply().catch(() => 0n));
            ids = Array.from({ length: supply + 1 }, (_, i) => String(i));
            method = "supply-range-fallback";
        }
    }

    const live = new Set(ids);
    const missing = knownIds.filter((id) => !live.has(id));
    const stillExist = await inBatches(missing, (id) => exists(contract, id));
    const removed = missing.filter((_, i) => !stillExist[i]);
    ids.push(...missing.filter((_, i) => stillExist[i]));

    return { ids: sortIds([...new Set(ids)]), removed, method };
}
