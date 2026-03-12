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

// Add this cache object right above the function
const requestCache = new Map();

// --- UNIVERSAL METADATA WATERFALL ---
async function resolveMetadata(uri, tokenId) {
    if (!uri) return null;

    if (uri.startsWith('data:application/json;base64,')) {
        const base64Data = uri.split(',')[1];
        return JSON.parse(Buffer.from(base64Data, 'base64').toString());
    }

    let path = uri.replace("ipfs://", "").replace("https://ipfs.io/ipfs/", "").replace(PINATA_GATEWAY, "");
    let urlsToTry = [];

    if (uri.startsWith("http") && !uri.includes("ipfs.io") && !uri.includes("mypinata.cloud")) {
        urlsToTry.push(uri);
    } else {
        const separator = path.endsWith('/') ? '' : '/';
        if (path.endsWith(tokenId) || path.endsWith(`${tokenId}.json`)) {
            urlsToTry.push(`${PUBLIC_GATEWAY}${path}`);
        } else {
            urlsToTry.push(`${PUBLIC_GATEWAY}${path}${separator}${tokenId}`);
            urlsToTry.push(`${PUBLIC_GATEWAY}${path}${separator}${tokenId}.json`);
            urlsToTry.push(`${PUBLIC_GATEWAY}${path}`); // The unrevealed URL fallback
        }
    }

    for (const url of urlsToTry) {
        // 1. Check if we already fetched (or failed to fetch) this exact URL
        if (requestCache.has(url)) {
            const cachedData = requestCache.get(url);
            if (cachedData === 'FAILED') continue;
            return cachedData;
        }

        try {
            // 2. Disguise Axios as a real Google Chrome browser
            const response = await axios.get(url, {
                timeout: 200,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // 3. Ensure it's valid JSON, not an HTML directory page
            if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
                requestCache.set(url, response.data); // Save it to memory
                return response.data;
            } else {
                requestCache.set(url, 'FAILED'); // Cache the failure to prevent retries
            }
        } catch (err) {
            requestCache.set(url, 'FAILED'); // Cache the error to prevent retries
        }
    }

    return null;
}

async function syncExistingCollection(contractAddress) {
    await mongoose.connect(MONGODB_URI);
    const provider = new ethers.JsonRpcProvider(HEMI_RPC);
    const nftContract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);

    let collection = await Collection.findOne({ contractAddress: contractAddress.toLowerCase() });

    if (!collection) {
        console.log("📂 Collection not found in DB. Fetching details from Hemi...");
        try {
            const name = await nftContract.name();
            const slug = name.toLowerCase().replace(/ /g, "-").replace(/[^\w-]/g, "");
            collection = await Collection.create({
                name: name, slug: slug, contractAddress: contractAddress.toLowerCase(),
                chain: "hemi", isVerified: true, description: `Official ${name} collection on Hemi.`,
                logoUrl: "https://via.placeholder.com/500", bannerUrl: "https://via.placeholder.com/1500x500",
                floorPrice: "0", volume: "0", sales: "0"
            });
            console.log(`✨ Auto-Created Collection: ${name}`);
        } catch (e) {
            console.error("❌ Could not fetch collection name from contract.");
            process.exit(1);
        }
    }

    try {
        const totalSupply = await nftContract.totalSupply();
        console.log(`📦 Found ${totalSupply} tokens. Syncing...`);

        // Loop includes both 0 and totalSupply to handle both 0-indexed and 1-indexed contracts
        for (let i = 0; i <= Number(totalSupply); i++) {
            const tokenId = i.toString();
            try {
                const [uri, owner, listing] = await Promise.all([
                    nftContract.tokenURI(tokenId),
                    nftContract.ownerOf(tokenId),
                    marketplace.getListing(contractAddress, tokenId)
                ]);

                // Pass tokenId to the new waterfall resolver
                const metadata = await resolveMetadata(uri, tokenId);

                if (!metadata) {
                    console.log(`⚠️ Unresolvable metadata for #${tokenId} at base URI: ${uri}`);
                    continue;
                }

                let imageUrl = metadata.image || metadata.image_url || "";

                if (imageUrl.startsWith("ipfs://")) {
                    imageUrl = imageUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
                } else if (imageUrl.includes("mypinata.cloud")) {
                    // Failsafe: if a contract hardcoded a different private gateway, try to route it publicly
                    const imgCid = imageUrl.split("/ipfs/")[1];
                    if (imgCid) imageUrl = `https://ipfs.io/ipfs/${imgCid}`;
                }

                await NFT.findOneAndUpdate(
                    { tokenId, contractAddress: contractAddress.toLowerCase() },
                    {
                        collectionId: collection._id,
                        name: metadata.name || `${collection.name} #${tokenId}`,
                        description: metadata.description || "",
                        imageUrl,
                        attributes: metadata.attributes || [],
                        ownerAddress: owner.toLowerCase(),
                        isListed: listing.price > 0n, // Ethers v6 BigInt check
                        price: listing.price.toString(),
                        seller: listing.seller !== ethers.ZeroAddress ? listing.seller.toLowerCase() : null,
                        lastSyncedAt: new Date()
                    },
                    { upsert: true }
                );
                console.log(`✅ Synced #${tokenId} - ${metadata.name}`);

                await new Promise(r => setTimeout(r, 50));
            } catch (tokenErr) {
                // Gracefully handle tokens that don't exist (e.g., token 0 in a 1-indexed contract)
                if (tokenErr.code === 'CALL_EXCEPTION') {
                    console.log(`⏩ Token #${tokenId} does not exist in contract (skipping).`);
                } else {
                    console.error(`❌ Token #${tokenId} error:`, tokenErr.message);
                }
            }
        }
        console.log("Sync complete.");
        process.exit(0);
    } catch (err) {
        console.error("Fatal Error:", err.message);
        process.exit(1);
    }
}

const targetAddress = process.argv[2];
syncExistingCollection(targetAddress);