import { ethers } from 'ethers';
import axios from 'axios';
import mongoose from 'mongoose';
import { NFT } from './models/NFT.js';
import { Collection } from './models/Collection.js';
import { discoverTokenIds } from './lib/token-discovery.js';
import { createHemiProvider } from './lib/provider.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/nft_marketplace';
const MARKETPLACE_ADDRESS = "0xf93AF302727E0ef59522Cd9D9Ff19Ba6b5BB7755";

const IPFS_GATEWAYS = [
    "https://amaranth-imperial-otter-134.mypinata.cloud/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://dweb.link/ipfs/",
    "https://nftstorage.link/ipfs/",
    "https://ipfs.io/ipfs/",
];

const GATEWAY_HOSTNAMES = [
    'ipfs.io',
    'mypinata.cloud',
    'gateway.pinata.cloud',
    'cloudflare-ipfs.com',
    'dweb.link',
    'nftstorage.link',
];

const FETCH_TIMEOUT_MS = 15000;

const ERC721_ABI = [
    "function name() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function ownerOf(uint256 tokenId) view returns (address)"
];

const MARKETPLACE_ABI = [
    "function getListing(address nft, uint256 tokenId) view returns (address seller, uint256 price)"
];

const requestCache = new Map();

// Whether the URI points at a known IPFS gateway
function isGatewayWrappedUrl(uri) {
    return GATEWAY_HOSTNAMES.some(host => uri.includes(host));
}

// The CID and path of an ipfs:// or gateway URI, or null if it isn't IPFS
function extractCidPath(uri) {
    if (uri.startsWith('ipfs://')) {
        return uri.replace(/^ipfs:\/\//, '');
    }
    if (uri.startsWith('http') && isGatewayWrappedUrl(uri)) {
        const match = uri.match(/\/ipfs\/(.+)$/);
        return match ? match[1] : null;
    }
    return null;
}

// Whether a URL answers a HEAD request (cached)
async function checkReachable(url) {
    const cacheKey = `HEAD:${url}`;
    if (requestCache.has(cacheKey)) {
        return requestCache.get(cacheKey) !== 'FAILED';
    }
    try {
        const response = await axios.head(url, {
            timeout: FETCH_TIMEOUT_MS,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            validateStatus: (status) => status >= 200 && status < 300,
        });
        requestCache.set(cacheKey, response.status);
        return true;
    } catch (err) {
        requestCache.set(cacheKey, 'FAILED');
        return false;
    }
}

// The first of `urls` that answers, or null if none do
function raceFirstReachable(urls) {
    if (urls.length === 0) return Promise.resolve(null);

    return new Promise((resolve) => {
        let remaining = urls.length;
        let settled = false;

        urls.forEach((url) => {
            checkReachable(url).then((ok) => {
                remaining--;
                if (ok && !settled) {
                    settled = true;
                    resolve(url);
                } else if (remaining === 0 && !settled) {
                    settled = true;
                    resolve(null);
                }
            });
        });
    });
}

// A gateway URL verified to serve the URI's content, or Pinata's public gateway
async function resolveVerifiedGatewayUrl(uri) {
    if (!uri || typeof uri !== 'string') return null;
    uri = uri.trim();

    if (uri.startsWith('http') && !isGatewayWrappedUrl(uri)) {
        return uri;
    }

    const cidPath = extractCidPath(uri);
    if (!cidPath) return null;

    const urls = IPFS_GATEWAYS.map(gw => `${gw}${cidPath}`);
    console.log(`   ↳ verifying ${urls.length} gateways for image: ${cidPath}`);

    const winner = await raceFirstReachable(urls);
    if (winner) return winner;

    console.warn(`   ↳ no gateway verified reachable for image: ${cidPath}, defaulting to shared gateway`);
    return `https://gateway.pinata.cloud/ipfs/${cidPath}`;
}

// The metadata URLs to try for a token, from its tokenURI
function buildPathCandidates(uri, tokenId) {
    if (!uri || typeof uri !== 'string') return { kind: 'none', candidates: [] };

    uri = uri.trim();

    if (uri.startsWith('data:')) return { kind: 'data', candidates: [] };

    if (uri.startsWith('http') && !isGatewayWrappedUrl(uri)) {
        const base = uri.endsWith('/') ? uri : `${uri}/`;
        const noSlash = uri.endsWith('/') ? uri.slice(0, -1) : uri;

        if (noSlash.endsWith(`/${tokenId}`) || noSlash.endsWith(`/${tokenId}.json`)) {
            return { kind: 'http', candidates: [uri] };
        }

        return {
            kind: 'http',
            candidates: [
                `${base}${tokenId}`,
                `${base}${tokenId}.json`,
                `${noSlash}${tokenId}`,
                `${noSlash}${tokenId}.json`,
            ],
        };
    }

    const cidPath = extractCidPath(uri);
    if (!cidPath) return { kind: 'none', candidates: [] };

    const cleanPath = cidPath.endsWith('/') ? cidPath.slice(0, -1) : cidPath;
    const isBareCID = !cleanPath.includes('/');

    if (isBareCID) {
        return { kind: 'ipfs', candidates: [cleanPath] };
    }

    if (cleanPath.endsWith(`/${tokenId}`) || cleanPath.endsWith(`/${tokenId}.json`)) {
        return { kind: 'ipfs', candidates: [cleanPath] };
    }

    return {
        kind: 'ipfs',
        candidates: [
            `${cleanPath}/${tokenId}`,
            `${cleanPath}/${tokenId}.json`,
            cleanPath,
        ],
    };
}

// Fetches and parses a JSON object from a URL (cached), or null
async function fetchJson(url) {
    if (requestCache.has(url)) {
        const cached = requestCache.get(url);
        return cached === 'FAILED' ? null : cached;
    }

    try {
        const response = await axios.get(url, {
            timeout: FETCH_TIMEOUT_MS,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const data = response.data;

        if (data && typeof data === 'object' && !Array.isArray(data)) {
            requestCache.set(url, data);
            return data;
        }

        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    requestCache.set(url, parsed);
                    return parsed;
                }
            } catch (_) {}
        }

        requestCache.set(url, 'FAILED');
        return null;
    } catch (err) {
        const status = err.response?.status;
        if (status && status < 500 && status !== 429) requestCache.set(url, 'FAILED');
        return null;
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// resolveMetadata with up to 3 tries, waiting longer each time
async function resolveMetadataWithRetry(uri, tokenId, attempts = 3) {
    for (let i = 1; i <= attempts; i++) {
        const metadata = await resolveMetadata(uri, tokenId);
        if (metadata) return metadata;
        if (i < attempts) {
            console.warn(`   ↳ retrying #${tokenId} in ${2 * i}s`);
            await sleep(2000 * i);
        }
    }
    return null;
}

// The first JSON any of `urls` returns, or null if all fail
function raceFirstSuccess(urls) {
    if (urls.length === 0) return Promise.resolve(null);

    return new Promise((resolve) => {
        let remaining = urls.length;
        let settled = false;

        urls.forEach((url) => {
            fetchJson(url).then((data) => {
                remaining--;
                if (data && !settled) {
                    settled = true;
                    resolve(data);
                } else if (remaining === 0 && !settled) {
                    settled = true;
                    resolve(null);
                }
            });
        });
    });
}

// A token's metadata from its tokenURI: data URIs, HTTP APIs, or IPFS through every gateway
async function resolveMetadata(uri, tokenId) {
    if (!uri || typeof uri !== 'string') return null;
    uri = uri.trim();

    if (uri.startsWith('data:application/json;base64,')) {
        try {
            const b64 = uri.split(',')[1];
            return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
        } catch (_) {
            return null;
        }
    }

    if (uri.startsWith('data:application/json,')) {
        try {
            return JSON.parse(decodeURIComponent(uri.split(',').slice(1).join(',')));
        } catch (_) {
            return null;
        }
    }

    const { kind, candidates } = buildPathCandidates(uri, tokenId);

    if (kind === 'none' || candidates.length === 0) return null;

    if (kind === 'http') {
        for (const url of candidates) {
            console.log(`   ↳ trying ${url}`);
            const data = await fetchJson(url);
            if (data) return data;
        }
        return null;
    }

    for (const cidPath of candidates) {
        const urls = IPFS_GATEWAYS.map(gw => `${gw}${cidPath}`);
        console.log(`   ↳ racing ${urls.length} gateways for: ${cidPath}`);

        const data = await raceFirstSuccess(urls);
        if (data) return data;

        console.warn(`   ↳ all gateways failed for: ${cidPath}`);
    }

    return null;
}

// A reachable HTTPS URL for a metadata image
async function resolveImageUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';

    raw = raw.trim();

    if (raw.startsWith('data:')) return raw;

    return (await resolveVerifiedGatewayUrl(raw)) || raw;
}

// Syncs every token of a collection (owner, listing and metadata) into the database
async function syncExistingCollection(contractAddress) {
    if (!contractAddress) {
        console.error('❌ Usage: node sync.js <contractAddress>');
        process.exit(1);
    }

    await mongoose.connect(MONGODB_URI);
    const provider = createHemiProvider('collection sync');
    const nftContract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);

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

    const contractKey = contractAddress.toLowerCase();
    const knownIds = (await NFT.find({ contractAddress: contractKey }, { tokenId: 1 }).lean()).map((n) => n.tokenId);
    let tokenIds;
    try {
        const { ids, removed, method } = await discoverTokenIds(provider, contractAddress, knownIds);
        tokenIds = ids;
        console.log(`📦 Found ${ids.length} tokens via ${method}. Starting sync...`);
        if (removed.length) {
            await NFT.deleteMany({ contractAddress: contractKey, tokenId: { $in: removed } });
            console.log(`🔥 Removed ${removed.length} burned tokens: ${removed.join(', ')}`);
        }
    } catch (e) {
        console.error('❌ Could not discover token ids:', e.message);
        process.exit(1);
    }

    let synced = 0, failed = 0;
    const withoutMetadata = [];

    for (const tokenId of tokenIds) {
        try {
            const [uri, owner, listing] = await Promise.all([
                nftContract.tokenURI(tokenId),
                nftContract.ownerOf(tokenId),
                marketplace.getListing(contractAddress, tokenId).catch(() => ({
                    seller: ethers.ZeroAddress,
                    price: 0n,
                })),
            ]);
            const chainState = {
                collectionId: collection._id,
                ownerAddress: owner.toLowerCase(),
                isListed: listing.price > 0n,
                price: listing.price.toString(),
                seller: listing.seller !== ethers.ZeroAddress ? listing.seller.toLowerCase() : null,
                lastSyncedAt: new Date(),
            };

            console.log(`🔎 Resolving #${tokenId}  (uri: ${uri})`);
            const metadata = await resolveMetadataWithRetry(uri, tokenId);

            if (!metadata) {
                await NFT.updateOne(
                    { tokenId, contractAddress: contractKey },
                    {
                        $set: chainState,
                        $setOnInsert: { name: `${collection.name} #${tokenId}`, description: '', imageUrl: '', attributes: [] },
                    },
                    { upsert: true }
                );
                console.warn(`⚠️  Metadata unreachable for #${tokenId}; stored without it  (uri: ${uri})`);
                withoutMetadata.push(tokenId);
                continue;
            }

            const imageUrl = await resolveImageUrl(
                metadata.image || metadata.image_url || metadata.imageUrl || ''
            );

            await NFT.findOneAndUpdate(
                { tokenId, contractAddress: contractKey },
                {
                    ...chainState,
                    name: metadata.name || `${collection.name} #${tokenId}`,
                    description: metadata.description || '',
                    imageUrl,
                    attributes: metadata.attributes || metadata.traits || [],
                },
                { upsert: true }
            );

            console.log(`✅ Synced  #${tokenId.padStart(5)}  –  ${metadata.name || '(no name)'}`);
            synced++;

            await sleep(50);

        } catch (err) {
            if (err.code === 'CALL_EXCEPTION') {
                console.log(`⏩ Token #${tokenId} does not exist – skipping.`);
            } else {
                console.error(`❌ Token #${tokenId} error: ${err.message}`);
                failed++;
            }
        }
    }

    console.log(`\n🎉 Sync complete.  Synced: ${synced}  |  Without metadata: ${withoutMetadata.length}  |  Failed: ${failed}`);
    if (withoutMetadata.length) {
        console.log(`   Stored without metadata (run the sync again to fill it in): ${withoutMetadata.join(', ')}`);
    }
    await mongoose.disconnect();
    process.exit(0);
}

const targetAddress = process.argv[2];
syncExistingCollection(targetAddress);
