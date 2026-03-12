import { ethers } from 'ethers';
import mongoose from 'mongoose';
import { NFT } from './models/NFT.js';
import { Collection } from './models/Collection.js';

const HEMI_RPC = "https://rpc.hemi.network/rpc";
const MARKETPLACE_ADDRESS = "0xf93AF302727E0ef59522Cd9D9Ff19Ba6b5BB7755";

const MARKETPLACE_ABI = [
    "event ItemListed(address indexed seller, address indexed nft, uint256 indexed tokenId, uint256 price)",
    "event ItemSold(address indexed buyer, address indexed nft, uint256 indexed tokenId, uint256 price)",
    "event ItemCanceled(address indexed seller, address indexed nft, uint256 indexed tokenId)",
    "event ItemUpdated(address indexed seller, address indexed nft, uint256 indexed tokenId, uint256 newPrice)"
];

const ERC721_ABI = [
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

let activeListeners = new Set(); // To keep track of which NFTs we are watching

async function startCrawler() {
    const provider = new ethers.JsonRpcProvider(HEMI_RPC);
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);

    console.log("📡 Master Crawler Started. Watching Marketplace...");

    // --- 1. GLOBAL MARKETPLACE LISTENERS ---
    
    marketplace.on("ItemListed", async (seller, nft, tokenId, price) => {
        await NFT.findOneAndUpdate(
            { contractAddress: nft.toLowerCase(), tokenId: tokenId.toString() },
            { isListed: true, price: price.toString(), seller: seller.toLowerCase() }
        );
        console.log(`✨ [Listed] Contract: ${nft.slice(0,6)}... ID: ${tokenId}`);
    });

    marketplace.on("ItemSold", async (buyer, nft, tokenId, price) => {
        await NFT.findOneAndUpdate(
            { contractAddress: nft.toLowerCase(), tokenId: tokenId.toString() },
            { isListed: false, price: "0", ownerAddress: buyer.toLowerCase(), $unset: { seller: "" } }
        );
        console.log(`[Sold] ID: ${tokenId} to ${buyer}`);
    });

    marketplace.on("ItemUpdated", async (seller, nft, tokenId, newPrice) => {
        await NFT.findOneAndUpdate(
            { contractAddress: nft.toLowerCase(), tokenId: tokenId.toString() },
            { price: newPrice.toString() }
        );
        console.log(`📝 [Updated] ID: ${tokenId} Price: ${ethers.formatEther(newPrice)}`);
    });

    marketplace.on("ItemCanceled", async (seller, nft, tokenId) => {
        await NFT.findOneAndUpdate(
            { contractAddress: nft.toLowerCase(), tokenId: tokenId.toString() },
            { isListed: false, price: "0", $unset: { seller: "" } }
        );
        console.log(`❌ [Canceled] ID: ${tokenId}`);
    });

    // --- 2. DYNAMIC TRANSFER LISTENERS ---
    
    async function refreshNFTListeners() {
        // Find all collections in the DB
        const collections = await Collection.find({});
        
        for (const col of collections) {
            const addr = col.contractAddress.toLowerCase();
            
            // If we aren't already watching this NFT contract, start watching it
            if (!activeListeners.has(addr)) {
                console.log(`🔗 New Collection Detected: Starting Transfer Listener for ${addr}`);
                const nftContract = new ethers.Contract(addr, ERC721_ABI, provider);
                
                nftContract.on("Transfer", async (from, to, tokenId) => {
                    await NFT.findOneAndUpdate(
                        { contractAddress: addr, tokenId: tokenId.toString() },
                        { ownerAddress: to.toLowerCase(), isListed: false, price: "0", $unset: { seller: "" } }
                    );
                    console.log(` [Transfer] Contract: ${addr.slice(0,6)} ID: ${tokenId} -> ${to}`);
                });

                activeListeners.add(addr);
            }
        }
    }

    // Initial load of listeners
    await refreshNFTListeners();

    // Check for new collections every 2 minutes without stopping the program
    setInterval(refreshNFTListeners, 120000);
}

// Connect to DB and run
mongoose.connect('mongodb://127.0.0.1:27017/nft_marketplace')
    .then(() => startCrawler())
    .catch(err => console.error("Database connection failed", err));