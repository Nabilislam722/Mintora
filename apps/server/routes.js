import { NFT } from "./models/NFT.js";
import { Collection } from "./models/Collection.js"
import { User } from "./models/User.js";
import { Featured } from "./models/Featured.js";
import { Activity } from "./models/Activity.js";
import mongoose from 'mongoose';

export async function registerRoutes(app) {

  app.get("/api/search", async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ nfts: [], collections: [], users: [] });

    const regex = new RegExp(q.trim(), "i");
    const isAddress = q.trim().startsWith("0x");

    const [nfts, collections, users] = await Promise.all([
      NFT.find({ name: regex }).limit(5).populate("collectionId", "name"),
      Collection.find({ name: regex }).limit(5),
      User.find(
        isAddress
          ? { walletAddress: { $regex: q.trim(), $options: "i" } }
          : { username: regex }
      ).limit(5),
    ]);

    res.json({ nfts, collections, users });
  });

  //Users
  app.get("/api/users/:address", async (req, res) => {
    try {
      const user = await User.findOne({ walletAddress: req.params.address.toLowerCase() });
      if (!user) return res.json({
        walletAddress: req.params.address.toLowerCase(),
        username: "",
        profileImageUrl: "",
        bannerImageUrl: "",
        bio: "",
      });

      res.json(user);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  app.patch("/api/users/:address", async (req, res) => {
    try {
      const { username, bio, url, profileImageUrl, bannerImageUrl } = req.body;

      const user = await User.findOneAndUpdate(
        { walletAddress: req.params.address.toLowerCase() },
        { $set: { username, bio, profileImageUrl, bannerImageUrl } },
        { upsert: true, returnDocument: "after" }
      );
      res.json(user);
    } catch (err) {
      res.status(400).json({ message: err.message });
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
    let { limit = 500, owner, collectionId } = req.query;
    const finalLimit = Math.min(parseInt(limit), 1000);

    try {
      let query = {};
      let sortConfig = { lastSyncedAt: -1 };

      if (owner) {
        query.ownerAddress = owner.toLowerCase();
      }
      else if (collectionId) {
        query.collectionId = collectionId;
        sortConfig = { tokenId: 1 };
      }
      else {
        query.isListed = true;
      }

      const nfts = await NFT.find(query)
        .populate("collectionId")
        .collation({ locale: "en_US", numericOrdering: true })
        .sort(sortConfig)
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
  //activity logs
  app.get('/api/activity', async (req, res) => {
    try {
      const { limit = 20, page = 1, collection, address } = req.query;

      const filter = {};
      if (collection) filter.collection = collection.toLowerCase();
      if (address) filter.$or = [{ from: address.toLowerCase() }, { to: address.toLowerCase() }];

      const [items, total] = await Promise.all([
        Activity.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean(),
        Activity.countDocuments(filter),
      ]);

      // Collect all unique addresses and collection addresses
      const addresses = [...new Set(items.flatMap(i => [i.from, i.to].filter(Boolean)))]
      const collectionAddresses = [...new Set(items.map(i => i.collection).filter(Boolean))]

      // Fetch users and collections in parallel
      const [users, collections] = await Promise.all([
        User.find({ walletAddress: { $in: addresses } }).select('walletAddress username profileImageUrl').lean(),
        Collection.find({ contractAddress: { $in: collectionAddresses } }).select('contractAddress name imageUrl').lean(),
      ])

      const userMap = Object.fromEntries(users.map(u => [u.walletAddress, u]))
      const collectionMap = Object.fromEntries(collections.map(c => [c.contractAddress, c]))

      // Enrich each item
      const enriched = items.map(item => ({
        ...item,
        fromUser: userMap[item.from] ?? null,
        toUser: userMap[item.to] ?? null,
        collectionInfo: collectionMap[item.collection] ?? null,
      }))

      res.json({ items: enriched, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
      console.error('Activity route error:', err.message)
      res.status(500).json({ error: err.message })
    }
  });
}