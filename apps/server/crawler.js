import { ethers } from "ethers";
import mongoose from "mongoose";
import { NFT } from "./models/NFT.js";
import { Collection } from "./models/Collection.js";

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

let provider = new ethers.JsonRpcProvider(HEMI_RPC, undefined, {
    pollingInterval: 2000
});
let recovering = false;
let marketplace;
let activeListeners = new Map();
let lastProcessedBlock = 0;
let recoveryRunning = false;


// Floor price + volume

async function updateFloorAndVolume(contractAddress, salePrice) {
    try {
        const cheapestNFT = await NFT.findOne({
            contractAddress,
            isListed: true,
            price: { $gt: "0" }
        })
            .sort({ price: 1 })
            .select("price");

        let newFloor = cheapestNFT ? cheapestNFT.price : "0";

        const collection = await Collection.findOne({ contractAddress });
        if (!collection) return;

        const currentVolumeWei = ethers.parseUnits(collection.volume || "0", "ether");
        const salePriceWei = BigInt(salePrice);
        const newVolumeWei = currentVolumeWei + salePriceWei;

        await Collection.updateOne(
            { contractAddress },
            {
                floorPrice: ethers.formatEther(newFloor),
                volume: ethers.formatEther(newVolumeWei.toString())
            }
        );

    } catch (err) {
        console.error(`Error updating stats for ${contractAddress}:`, err);
    }
}



// Marketplace listener
function setupMarketplaceListeners() {

    marketplace.on("ItemListed", async (seller, nft, tokenId, price, event) => {
        try {

            await NFT.updateOne(
                { contractAddress: nft.toLowerCase(), tokenId: tokenId.toString() },
                {
                    isListed: true,
                    price: price.toString(),
                    seller: seller.toLowerCase()
                }
            );

            lastProcessedBlock = event.blockNumber;

            console.log(`✨ Listed ${nft.slice(0, 6)} #${tokenId}`);

        } catch (err) {
            console.error("ItemListed error:", err);
        }
    });


    marketplace.on("ItemSold", async (buyer, nft, tokenId, price, event) => {
        try {

            const contractAddress = nft.toLowerCase();

            await NFT.updateOne(
                { contractAddress, tokenId: tokenId.toString() },
                {
                    isListed: false,
                    price: "0",
                    ownerAddress: buyer.toLowerCase(),
                    $unset: { seller: "" }
                }
            );

            await updateFloorAndVolume(contractAddress, price.toString());

            lastProcessedBlock = event.blockNumber;

            console.log(`💰 Sold ${nft.slice(0, 6)} #${tokenId}`);

        } catch (err) {
            console.error("ItemSold error:", err);
        }
    });


    marketplace.on("ItemUpdated", async (seller, nft, tokenId, newPrice, event) => {
        try {

            await NFT.updateOne(
                { contractAddress: nft.toLowerCase(), tokenId: tokenId.toString() },
                { price: newPrice.toString() }
            );

            lastProcessedBlock = event.blockNumber;

            console.log(`📝 Updated #${tokenId}`);

        } catch (err) {
            console.error("ItemUpdated error:", err);
        }
    });


    marketplace.on("ItemCanceled", async (seller, nft, tokenId, event) => {
        try {

            await NFT.updateOne(
                { contractAddress: nft.toLowerCase(), tokenId: tokenId.toString() },
                {
                    isListed: false,
                    price: "0",
                    $unset: { seller: "" }
                }
            );

            lastProcessedBlock = event.blockNumber;

            console.log(`❌ Canceled #${tokenId}`);

        } catch (err) {
            console.error("ItemCanceled error:", err);
        }
    });
}


// Transfer listeners
async function startTransferListener(contractAddress) {

    try {

        if (activeListeners.has(contractAddress)) return;

        console.log(`🔗 Watching Transfer events: ${contractAddress}`);

        const nftContract = new ethers.Contract(
            contractAddress,
            ERC721_ABI,
            provider
        );

        const listener = async (from, to, tokenId, event) => {

            try {

                await NFT.updateOne(
                    { contractAddress, tokenId: tokenId.toString() },
                    {
                        ownerAddress: to.toLowerCase(),
                        isListed: false,
                        price: "0",
                        $unset: { seller: "" }
                    }
                );

                lastProcessedBlock = event.blockNumber;

                console.log(`➡️ Transfer ${contractAddress.slice(0, 6)} #${tokenId}`);

            } catch (err) {
                console.error("Transfer update failed:", err);
            }

        };

        nftContract.on("Transfer", listener);

        activeListeners.set(contractAddress, {
            contract: nftContract,
            listener
        });

    } catch (err) {
        console.error("Transfer listener error:", err);
    }

}


// Refresh collection listeners
async function refreshNFTListeners() {

    try {

        const collections = await Collection.find({})
            .select("contractAddress");

        for (const col of collections) {

            const addr = col.contractAddress.toLowerCase();

            await startTransferListener(addr);

        }

    } catch (err) {
        console.error("Refresh listeners error:", err);
    }

}

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

// Recover missed events
async function recoverMissedEvents() {
    if (recovering) return;

    try {
        recovering = true;

        const currentBlock = await provider.getBlockNumber();

        if (!lastProcessedBlock) {
            lastProcessedBlock = currentBlock;
            return;
        }

        if (currentBlock <= lastProcessedBlock) return;

        const from = lastProcessedBlock + 1;
        const to = Math.min(currentBlock, from + 200);

        console.log(`🔎 Recovering events from ${from} → ${to}`);

        const events = await marketplace.queryFilter("*", from, to);

        for (const e of events) {
            marketplace.emit(e.eventName, ...e.args, e);
        }

        lastProcessedBlock = to;

    }
    catch (err) {
        console.error("Recovery failed:", err);
        await sleep(5000);

    } finally {
        recovering = false;
    }
}


// Start crawler
async function startCrawler() {

    try {

        marketplace = new ethers.Contract(
            MARKETPLACE_ADDRESS,
            MARKETPLACE_ABI,
            provider
        );

        console.log("📡 NFT Marketplace Crawler Started");

        setupMarketplaceListeners();

        await refreshNFTListeners();

        setInterval(refreshNFTListeners, 120000);

        setInterval(async () => {
            if (recoveryRunning) return;

            recoveryRunning = true;
            await recoverMissedEvents();
            recoveryRunning = false;

        }, 15000);


    } catch (err) {
        console.error("Crawler start failed:", err);
    }

}

// Init

async function init() {

    try {

        await mongoose.connect(
            "mongodb://127.0.0.1:27017/nft_marketplace"
        );

        console.log("📦 MongoDB Connected");

        await startCrawler();

    } catch (err) {
        console.error("Startup failed:", err);
    }

}


// Graceful shutdown

process.on("SIGINT", async () => {

    console.log("🛑 Shutting down crawler...");

    for (const [addr, data] of activeListeners.entries()) {
        data.contract.off("Transfer", data.listener);
    }

    await mongoose.disconnect();

    process.exit(0);

});


init();

