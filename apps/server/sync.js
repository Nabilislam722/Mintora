import { ethers } from 'ethers';
import axios from 'axios';
import mongoose from 'mongoose';
import { NFT } from './models/NFT.js';
import { Collection } from './models/Collection.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/nft_marketplace';
const HEMI_RPC = "https://rpc.hemi.network/rpc";
const MARKETPLACE_ADDRESS = "0xAf9194ad4D453Ce8f9B819f65542dfCbfB36E078";

// Gateway configuration
// All of these are raced in parallel per request (see raceFirstSuccess /
// raceFirstReachable), so order here only matters as a tie-breaker — a
// slow or dead gateway can never block resolution as long as one other
// gateway in the list is healthy.
//
// NOTE: your DEDICATED Pinata gateway only serves CIDs that were pinned
// through YOUR Pinata account. Any CID pinned by someone else (e.g. an
// asset from the original collection you didn't personally re-pin) will
// always 404 / ERR_ID:00006 there, no matter how many retries — it's a
// permissions boundary, not flakiness. It's kept in the race below because
// it's fast for content you DO own, but resolution never blindly trusts it.
const IPFS_GATEWAYS = [
    "https://amaranth-imperial-otter-134.mypinata.cloud/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",                      
    "https://cloudflare-ipfs.com/ipfs/",
    "https://dweb.link/ipfs/",
    "https://nftstorage.link/ipfs/",
    "https://ipfs.io/ipfs/",                                 
];

// Any of these hostnames appearing in a tokenURI mean "this is a gateway
// wrapper around an IPFS CID", not a genuine bespoke HTTP metadata API —
// so we unwrap it back down to a raw CID+path and re-resolve across ALL
// gateways above, instead of being stuck with whichever gateway happened
// to be baked into the tokenURI.
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

// In-memory cache: url -> parsed metadata object, or 'FAILED'
const requestCache = new Map();

function isGatewayWrappedUrl(uri) {
    return GATEWAY_HOSTNAMES.some(host => uri.includes(host));
}

/**
 * Strip any ipfs:// prefix or any known gateway prefix down to the raw
 * CID(+path). Returns null if the URI isn't IPFS-shaped at all.
 */
function extractCidPath(uri) {
    if (uri.startsWith('ipfs://')) {
        return uri.replace(/^ipfs:\/\//, '');
    }
    if (uri.startsWith('http') && isGatewayWrappedUrl(uri)) {
        // strips e.g. https://<any-host>/ipfs/<cid>/<path> -> <cid>/<path>
        const match = uri.match(/\/ipfs\/(.+)$/);
        return match ? match[1] : null;
    }
    return null;
}

/**
 * Check whether a gateway URL actually serves this content, without
 * downloading the whole body. Some gateways (notably Pinata's DEDICATED
 * gateway) only serve CIDs pinned under that specific account and will
 * 404 / ERR_ID:00006 on everything else — a HEAD check is the only way
 * to know in advance rather than guessing.
 */
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

/**
 * Race a reachability check across every URL in parallel and resolve with
 * the first URL that actually responds successfully — never just the
 * first one in the array. Resolves null only once ALL have failed.
 */
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

/**
 * Resolve an IPFS/HTTP URI into a gateway URL that has actually been
 * VERIFIED to serve this content — used for anything getting saved to the
 * DB ( an image URL). Unlike a plain string substitution, this can't
 * silently pick a gateway (like a dedicated Pinata gateway) that 404s on
 * content it doesn't personally have pinned.
 */
async function resolveVerifiedGatewayUrl(uri) {
    if (!uri || typeof uri !== 'string') return null;
    uri = uri.trim();

    // Already a plain HTTP(S) URL that is NOT a known IPFS gateway → use as-is
    if (uri.startsWith('http') && !isGatewayWrappedUrl(uri)) {
        return uri;
    }

    const cidPath = extractCidPath(uri);
    if (!cidPath) return null;

    const urls = IPFS_GATEWAYS.map(gw => `${gw}${cidPath}`);
    console.log(`   ↳ verifying ${urls.length} gateways for image: ${cidPath}`);

    const winner = await raceFirstReachable(urls);
    if (winner) return winner;

    // Nothing verified as reachable — fall back to the shared public
    // Pinata gateway anyway so the DB isn't left with an empty string;
    // it's the most likely to eventually serve arbitrary public CIDs.
    console.warn(`   ↳ no gateway verified reachable for image: ${cidPath}, defaulting to shared gateway`);
    return `https://gateway.pinata.cloud/ipfs/${cidPath}`;
}


function buildPathCandidates(uri, tokenId) {
    if (!uri || typeof uri !== 'string') return { kind: 'none', candidates: [] };

    uri = uri.trim();

    if (uri.startsWith('data:')) return { kind: 'data', candidates: [] };

    //   Plain HTTP(S) non-gateway URL → NOT an IPFS multi-gateway case   
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

    //   IPFS / gateway-wrapped URL                     ─
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
            cleanPath, // unrevealed / pre-reveal fallback (whole folder is one JSON)
        ],
    };
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
 * Fire fetchJson against every URL in parallel and resolve as soon as the
 * FIRST one succeeds. Only resolves null once ALL of them have failed.
 * This is what makes a dead/slow gateway harmless — we don't wait for it,
 * we just take whichever gateway answers first.
 */
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

/**
 * Universal metadata resolver.
 * Handles: data URIs, bare CIDs, folder-base CIDs, plain HTTP APIs,
 * private gateway URLs, and pre-reveal / unrevealed states — resolving
 * IPFS content by racing every configured gateway in parallel.
 */
async function resolveMetadata(uri, tokenId) {
    if (!uri || typeof uri !== 'string') return null;
    uri = uri.trim();

    //  Inline base64 JSON  
    if (uri.startsWith('data:application/json;base64,')) {
        try {
            const b64 = uri.split(',')[1];
            return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
        } catch (_) {
            return null;
        }
    }

    // Inline plain JSON   
    if (uri.startsWith('data:application/json,')) {
        try {
            return JSON.parse(decodeURIComponent(uri.split(',').slice(1).join(',')));
        } catch (_) {
            return null;
        }
    }

    const { kind, candidates } = buildPathCandidates(uri, tokenId);

    if (kind === 'none' || candidates.length === 0) return null;

    //   Plain HTTP API: no gateway fan-out, just try each URL variant    
    if (kind === 'http') {
        for (const url of candidates) {
            console.log(`   ↳ trying ${url}`);
            const data = await fetchJson(url);
            if (data) return data;
        }
        return null;
    }

    //   IPFS: expand each path candidate across ALL gateways, race them   
    for (const cidPath of candidates) {
        const urls = IPFS_GATEWAYS.map(gw => `${gw}${cidPath}`);
        console.log(`   ↳ racing ${urls.length} gateways for: ${cidPath}`);

        const data = await raceFirstSuccess(urls);
        if (data) return data;

        console.warn(`   ↳ all gateways failed for: ${cidPath}`);
    }

    return null;
}

/**
 * Normalise an image URL from metadata into a reliable public HTTPS URL.
 * Verifies reachability across all gateways rather than blindly trusting
 * whichever one happens to be first in the list.
 */
async function resolveImageUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';

    raw = raw.trim();

    // data: URI (SVG / base64 image) – keep as-is
    if (raw.startsWith('data:')) return raw;

    return (await resolveVerifiedGatewayUrl(raw)) || raw;
}

// Main sync function  

async function syncExistingCollection(contractAddress) {
    if (!contractAddress) {
        console.error('❌ Usage: node sync.js <contractAddress>');
        process.exit(1);
    }

    await mongoose.connect(MONGODB_URI);
    const provider = new ethers.JsonRpcProvider(HEMI_RPC);
    const nftContract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);

    // Ensure collection record exists 
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

    // Determine token range  
    let totalSupply;
    try {
        totalSupply = await nftContract.totalSupply();
        console.log(`📦 Total supply: ${totalSupply}. Starting sync...`);
    } catch (e) {
        console.error('❌ Could not read totalSupply:', e.message);
        process.exit(1);
    }

    let synced = 0, skipped = 0, failed = 0;

    for (let i = 0; i <= Number(totalSupply); i++) {
        const tokenId = i.toString();

        try {
            const [uri, owner, listing] = await Promise.all([
                nftContract.tokenURI(tokenId),
                nftContract.ownerOf(tokenId),
                marketplace.getListing(contractAddress, tokenId).catch(() => ({
                    seller: ethers.ZeroAddress,
                    price: 0n,
                })),
            ]);

            console.log(`🔎 Resolving #${tokenId}  (uri: ${uri})`);
            const metadata = await resolveMetadata(uri, tokenId);

            if (!metadata) {
                console.warn(`⚠️  Unresolvable metadata for #${tokenId}  (uri: ${uri})`);
                skipped++;
                continue;
            }

            const imageUrl = await resolveImageUrl(
                metadata.image || metadata.image_url || metadata.imageUrl || ''
            );

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

// Entry point
const targetAddress = process.argv[2];
syncExistingCollection(targetAddress);