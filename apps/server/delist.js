import mongoose from "mongoose";
import { NFT } from "./models/NFT.js";

async function cleanSlate() {
    try {
        console.log("📦 Connecting to MongoDB...");
        await mongoose.connect("mongodb://127.0.0.1:27017/nft_marketplace");

        console.log("🧹 Force-delisting all items in DB...");
        const result = await NFT.updateMany(
            { isListed: true },
            { 
                $set: { isListed: false, price: "0" }, 
                $unset: { seller: "" } 
            }
        );

        console.log(`✅ Success! Delisted ${result.modifiedCount} items from the frontend.`);
    } catch (error) {
        console.error("❌ Error running script:", error);
    } finally {
        await mongoose.disconnect();
    }
}

cleanSlate();