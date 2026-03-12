import { NFT } from "./models/NFT.js";
import { Collection } from "./models/Collection.js"
import { User } from "./models/User.js";
import { Featured } from "./models/Featured.js"
import mongoose from 'mongoose';

export async function registerRoutes(app) {
  // --- USERS ---
  app.get("/api/users/:address", async (req, res) => {
    try {
      const user = await User.findOne({ walletAddress: req.params.address.toLowerCase() });
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { walletAddress, username, profileImageUrl, bannerImageUrl, bio } = req.body;
      if (!walletAddress) return res.status(400).json({ message: "Address required" });

      const user = await User.findOneAndUpdate(
        { walletAddress: walletAddress.toLowerCase() },
        { $set: { username, profileImageUrl, bannerImageUrl, bio } },
        { upsert: true, new: true }
      );
      res.json(user);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  // --- COLLECTIONS ---
  app.get("/api/collections", async (req, res) => {
    try {
      const collections = await Collection.find();
      res.json(collections);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/collections/:slug", async (req, res) => {
    try {
      const collection = await Collection.findOne({ slug: req.params.slug });
      if (!collection) return res.status(404).json({ message: "Collection not found" });
      res.json(collection);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- NFTs ---
  app.get("/api/nfts", async (req, res) => {
    let { limit = 50, owner, collectionId } = req.query;
    const finalLimit = Math.min(parseInt(limit), 100);

    try {
      let query = {};
      if (owner) {
        query.ownerAddress = owner.toLowerCase();
      } else if (collectionId) {
        query.collectionId = collectionId;
      } else {
        query.isListed = true;
      }

      const nfts = await NFT.find(query)
        .populate("collectionId")
        .sort({ lastSyncedAt: -1 })
        .limit(finalLimit);

      res.json(nfts);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- NFT DETAILS ---
  app.get("/api/nfts/:collectionId/:tokenId", async (req, res) => {
    try {
      const { collectionId, tokenId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(collectionId)) {
        return res.status(400).json({ message: "Invalid Collection ID format" });
      }

      const nft = await NFT.findOne({
        collectionId: new mongoose.Types.ObjectId(collectionId),
        tokenId: tokenId
      }).populate("collectionId");

      if (!nft) return res.status(404).json({ message: "NFT not found" });
      res.json(nft);
    } catch (err) {
      res.status(500).json({ message: "Server error during NFT lookup" });
    }
  });

  // --- FEATURED ---
  app.get("/api/featured", async (req, res) => {
    try {
      const featuredItems = await Featured.find();
      if (!featuredItems?.length) {
        return res.status(404).json({ message: "No featured items found" });
      }
      res.json(featuredItems);
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/featurednft", async (req, res) => {
    try {
      const featuredNfts = await NFT.aggregate([
        { $match: { isListed: true, priority: { $gt: 0 } } },
        { $sort: { priority: -1, lastSyncedAt: -1 } },
        {
          $group: {
            _id: "$collectionId",
            doc: { $first: "$$ROOT" }
          }
        },
        { $replaceRoot: { newRoot: "$doc" } },
        { $sort: { priority: -1 } },
        { $limit: 8 }
      ]);

      await NFT.populate(featuredNfts, { path: "collectionId" });

      if (!featuredNfts.length) {
        return res.status(404).json({ message: "No featured items found" });
      }

      res.json(featuredNfts);
    } catch (err) {
      res.status(500).json({ message: "Featured NFT API Error" });
    }
  });
}