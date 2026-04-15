import { ethers } from 'ethers';
import axios from 'axios';
import mongoose from 'mongoose';
import { NFT } from './models/NFT.js';
import { Collection } from './models/Collection.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/nft_marketplace';
const HEMI_RPC = "https://rpc.hemi.network/rpc";
const MARKETPLACE_ADDRESS = "0xAf9194ad4D453Ce8f9B819f65542dfCbfB36E078";
const PINATA_GATEWAY = "https://amaranth-imperial-otter-134.mypinata.cloud/ipfs/";
const PUBLIC_GATEWAY = "https://ipfs.io/ipfs/";

const ERC721_ABI = [
    "function name() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function ownerOf(uint256 tokenId) view returns (address)"
];

const MARKETPLACE_ABI = [
    "function getListing(address nft, uint256 tokenId) view returns (address seller, uint256 price)"
];

// In-memory cache: url -> parsed metadata object, or 'FAILED'
const requestCache = new Map();

/**
 * Normalise any IPFS/HTTP URI into a clean public HTTPS URL.
 * Returns null if the URI is empty or unrecognisable.
 */
function normaliseUrl(uri) {
    if (!uri || typeof uri !== 'string') return null;

    uri = uri.trim();

    // Already a plain HTTP(S) URL that is NOT a known IPFS gateway → use as-is
    if (uri.startsWith('http') &&
        !uri.includes('ipfs.io') &&
        !uri.includes('mypinata.cloud') &&
        !uri.includes('cloudflare-ipfs.com') &&
        !uri.includes('dweb.link')) {
        return uri;
    }

    // Extract the raw CID+path from any supported format
    let cidPath = uri
        .replace(/^ipfs:\/\//, '')
        .replace(/^https?:\/\/[^/]+\/ipfs\//, '');  // strips any gateway prefix

    if (!cidPath) return null;

    return `${PUBLIC_GATEWAY}${cidPath}`;
}

/**
 * Build the ordered list of URLs to try for a tokenURI.
 *
 * Three known patterns:
 *   1. Bare CID        – each token has its own unique CID (e.g. Hemi Bros)
 *                        ipfs://bafkrei<unique>  →  just fetch that CID directly
 *   2. Folder / base   – shared base CID with token IDs appended
 *                        ipfs://Qm.../  →  try .../1  .../1.json
 *   3. Plain HTTP API  – https://api.example.com/metadata/  →  append token ID
 */
function buildUrlList(uri, tokenId) {
    if (!uri || typeof uri !== 'string') return [];

    uri = uri.trim();

    // Data URI (base64 inline JSON)
    // Handled separately before calling this function; included here for safety.
    if (uri.startsWith('data:')) return [];

    // Plain HTTP(S) non-gateway URL
    if (uri.startsWith('http') &&
        !uri.includes('ipfs.io') &&
        !uri.includes('mypinata.cloud') &&
        !uri.includes('cloudflare-ipfs.com') &&
        !uri.includes('dweb.link')) {

        const base = uri.endsWith('/') ? uri : `${uri}/`;
        // Some APIs use no slash and just tack on the ID
        const noSlash = uri.endsWith('/') ? uri.slice(0, -1) : uri;

        // If the URI already ends with the token ID, fetch it directly
        if (noSlash.endsWith(`/${tokenId}`) || noSlash.endsWith(`/${tokenId}.json`)) {
            return [uri];
        }

        return [
            `${base}${tokenId}`,
            `${base}${tokenId}.json`,
            `${noSlash}${tokenId}`,       // handles no-trailing-slash base
            `${noSlash}${tokenId}.json`,
        ];
    }

    // ── IPFS / gateway URL ─────────────────────────────────────────────────
    // Strip everything down to the raw CID+path
    let cidPath = uri
        .replace(/^ipfs:\/\//, '')
        .replace(/^https?:\/\/[^/]+\/ipfs\//, '');

    if (!cidPath) return [];

    // Remove any trailing slash for consistent logic below
    const cleanPath = cidPath.endsWith('/') ? cidPath.slice(0, -1) : cidPath;

    // A bare CID has no '/' → the URI is already a direct pointer to one file
    const isBareCID = !cleanPath.includes('/');

    if (isBareCID) {
        return [`${PUBLIC_GATEWAY}${cleanPath}`];
    }

    // Folder / base path
    // Already ends with the token ID → direct fetch
    if (cleanPath.endsWith(`/${tokenId}`) || cleanPath.endsWith(`/${tokenId}.json`)) {
        return [`${PUBLIC_GATEWAY}${cleanPath}`];
    }

    return [
        `${PUBLIC_GATEWAY}${cleanPath}/${tokenId}`,
        `${PUBLIC_GATEWAY}${cleanPath}/${tokenId}.json`,
        `${PUBLIC_GATEWAY}${cleanPath}`,   // unrevealed / pre-reveal fallback
    ];
}

/**
 * Fetch and parse JSON metadata from a single URL.
 * Returns the parsed object, or null on any failure.
 * Results are memoised in requestCache to avoid duplicate network calls.
 */
async function fetchJson(url) {
    if (requestCache.has(url)) {
        const cached = requestCache.get(url);
        return cached === 'FAILED' ? null : cached;
    }

    try {
        const response = await axios.get(url, {
            timeout: 8000,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const data = response.data;

        // Must be a plain JSON object, not an array or an HTML directory listing
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            requestCache.set(url, data);
            return data;
        }

        // Some gateways return the JSON as a string
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    requestCache.set(url, parsed);
                    return parsed;
                }
            } catch (_) { /* not JSON */ }
        }

        requestCache.set(url, 'FAILED');
        return null;
    } catch (err) {
        requestCache.set(url, 'FAILED');
        return null;
    }
}

/**
 * Universal metadata resolver.
 * Handles: data URIs, bare CIDs, folder-base CIDs, plain HTTP APIs,
 * private gateway URLs, and pre-reveal / unrevealed states.
 */
async function resolveMetadata(uri, tokenId) {
    if (!uri || typeof uri !== 'string') return null;

    uri = uri.trim();

    // ── 1. Inline base64 JSON ──────────────────────────────────────────────
    if (uri.startsWith('data:application/json;base64,')) {
        try {
            const b64 = uri.split(',')[1];
            return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
        } catch (_) {
            return null;
        }
    }

    // ── 2. Inline plain JSON (rare but exists) ─────────────────────────────
    if (uri.startsWith('data:application/json,')) {
        try {
            return JSON.parse(decodeURIComponent(uri.split(',').slice(1).join(',')));
        } catch (_) {
            return null;
        }
    }

    // ──Build URL candidates and try them in order ──────────────────────
    const urls = buildUrlList(uri, tokenId);

    for (const url of urls) {
        const data = await fetchJson(url);
        if (data) return data;
    }

    return null;
}

/**
 * Normalise an image URL from metadata into a reliable public HTTPS URL.
 */
function resolveImageUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';

    raw = raw.trim();

    // data: URI (SVG / base64 image) – keep as-is
    if (raw.startsWith('data:')) return raw;

    return normaliseUrl(raw) || raw;
}

// ── Main sync function ─────────────────────────────────────────────────────

async function syncExistingCollection(contractAddress) {
    if (!contractAddress) {
        console.error('❌ Usage: node sync.js <contractAddress>');
        process.exit(1);
    }

    await mongoose.connect(MONGODB_URI);
    const provider = new ethers.JsonRpcProvider(HEMI_RPC);
    const nftContract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);

    // ── Ensure collection record exists ───────────────────────────────────
    let collection = await Collection.findOne({ contractAddress: contractAddress.toLowerCase() });

    if (!collection) {
        console.log('📂 Collection not found in DB. Fetching details from chain...');
        try {
            const name = await nftContract.name();
            const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');
            collection = await Collection.create({
                name,
                slug,
                contractAddress: contractAddress.toLowerCase(),
                chain: 'hemi',
                isVerified: true,
                description: `Official ${name} collection on Hemi.`,
                logoUrl: "/placeholder-logo.png",
                bannerUrl: "/placeholder-logo.png",
                floorPrice: '0',
                volume: '0',
                sales: '0',
            });
            console.log(`✨ Auto-Created Collection: ${name}`);
        } catch (e) {
            console.error('❌ Could not fetch collection name from contract:', e.message);
            process.exit(1);
        }
    }

    // ── Determine token range ──────────────────────────────────────────────
    let totalSupply;
    try {
        totalSupply = await nftContract.totalSupply();
        console.log(`📦 Total supply: ${totalSupply}. Starting sync...`);
    } catch (e) {
        console.error('❌ Could not read totalSupply:', e.message);
        process.exit(1);
    }

    let synced = 0, skipped = 0, failed = 0;

    // Try token IDs 0 … totalSupply (inclusive) to cover both 0-indexed and
    // 1-indexed contracts.  Non-existent tokens are skipped gracefully.
    for (let i = 0; i <= Number(totalSupply); i++) {
        const tokenId = i.toString();

        try {
            // ── Fetch on-chain data in parallel ───────────────────────────
            const [uri, owner, listing] = await Promise.all([
                nftContract.tokenURI(tokenId),
                nftContract.ownerOf(tokenId),
                marketplace.getListing(contractAddress, tokenId).catch(() => ({
                    seller: ethers.ZeroAddress,
                    price: 0n,
                })),
            ]);

            // ── Resolve metadata ───────────────────────────────────────────
            const metadata = await resolveMetadata(uri, tokenId);

            if (!metadata) {
                console.warn(`⚠️  Unresolvable metadata for #${tokenId}  (uri: ${uri})`);
                skipped++;
                continue;
            }

            // ── Normalise image URL ────────────────────────────────────────
            const imageUrl = resolveImageUrl(
                metadata.image || metadata.image_url || metadata.imageUrl || ''
            );

            // ── Upsert NFT record ──────────────────────────────────────────
            await NFT.findOneAndUpdate(
                { tokenId, contractAddress: contractAddress.toLowerCase() },
                {
                    collectionId: collection._id,
                    name: metadata.name || `${collection.name} #${tokenId}`,
                    description: metadata.description || '',
                    imageUrl,
                    attributes: metadata.attributes || metadata.traits || [],
                    ownerAddress: owner.toLowerCase(),
                    isListed: listing.price > 0n,
                    price: listing.price.toString(),
                    seller: listing.seller !== ethers.ZeroAddress
                        ? listing.seller.toLowerCase()
                        : null,
                    lastSyncedAt: new Date(),
                },
                { upsert: true }
            );

            console.log(`✅ Synced  #${tokenId.padStart(5)}  –  ${metadata.name || '(no name)'}`);
            synced++;

            // Polite delay to avoid hammering IPFS gateways & RPC nodes
            await new Promise(r => setTimeout(r, 50));

        } catch (err) {
            if (err.code === 'CALL_EXCEPTION') {
                console.log(`⏩ Token #${tokenId} does not exist – skipping.`);
            } else {
                console.error(`❌ Token #${tokenId} error: ${err.message}`);
                failed++;
            }
        }
    }

    console.log(`\n🎉 Sync complete.  Synced: ${synced}  |  Skipped: ${skipped}  |  Failed: ${failed}`);
    await mongoose.disconnect();
    process.exit(0);
}

// ── Entry point ────────────────────────────────────────────────────────────
const targetAddress = process.argv[2];
syncExistingCollection(targetAddress);