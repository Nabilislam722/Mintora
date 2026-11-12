import { NFT } from "./models/NFT.js";
import { Collection } from "./models/Collection.js"
import { User, MAX_BIO, usernameProblem, usernameTaken } from "./models/User.js";
import { Featured } from "./models/Featured.js";
import { Activity } from "./models/Activity.js";
import mongoose from 'mongoose';
import { getPrices, PRICE_TTL } from "./prices.js";
import { withLiveFloors } from "./lib/floor.js";
import { sortBySales, SALES_PERIODS } from "./lib/trending.js";
import { topNfts } from "./lib/top-nfts.js";
import { salesSummary } from "./lib/sales-summary.js";
import { withSellers } from "./lib/sellers.js";
import { newestListingsFirst } from "./lib/listing-times.js";
import { DataDump } from "./models/DataDump.js";
import { requireAuth } from "./lib/auth.js";
import { isUserImageUrl } from "./lib/r2.js";

// The site's API routes
export async function registerRoutes(app) {
  // Searches NFTs, collections and users by name, or users by address
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

    res.json({ nfts, collections: await withLiveFloors(collections), users });
  });

  // A wallet's profile (empty fields if it has none)
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
  // Updates the signed-in wallet's own profile; fields left out stay as they are
  app.patch("/api/users/:address", requireAuth, async (req, res) => {
    const address = req.params.address.toLowerCase();
    if (address !== req.wallet) return res.status(403).json({ message: "You can only edit your own profile." });

    const { username, bio, profileImageUrl, bannerImageUrl } = req.body ?? {};
    const update = {};

    if (username !== undefined) {
      const name = String(username).trim();
      const problem = usernameProblem(name);
      if (problem) return res.status(400).json({ message: problem });
      update.username = name;
    }
    if (bio !== undefined) {
      const text = String(bio).trim();
      if (text.length > MAX_BIO) return res.status(400).json({ message: `Bios are up to ${MAX_BIO} characters.` });
      update.bio = text;
    }
    for (const [field, value] of Object.entries({ profileImageUrl, bannerImageUrl })) {
      if (value === undefined) continue;
      if (value !== "" && !isUserImageUrl(value, address))
        return res.status(400).json({ message: "Upload images through Mintora." });
      update[field] = value;
    }

    try {
      if (update.username && await usernameTaken(update.username, address))
        return res.status(409).json({ message: "That username is taken." });

      const user = await User.findOneAndUpdate(
        { walletAddress: address },
        { $set: update },
        { upsert: true, returnDocument: "after" }
      );
      res.json(user);
    } catch (err) {
      if (err.code === 11000 && err.keyPattern?.username) return res.status(409).json({ message: "That username is taken." });
      console.error("Profile save error:", err);
      res.status(500).json({ message: "Could not save the profile." });
    }
  });

  // Whether a username is free (`for` is the asking wallet, whose own name counts as free)
  app.get("/api/usernames/:name", async (req, res) => {
    const name = req.params.name.trim();
    const problem = usernameProblem(name);
    if (problem || !name) return res.json({ available: false, message: problem ?? "Enter a username." });
    try {
      const taken = await usernameTaken(name, String(req.query.for ?? "").toLowerCase());
      res.json(taken ? { available: false, message: "That username is taken." } : { available: true });
    } catch (err) {
      res.status(500).json({ message: "Could not check the username." });
    }
  });

  // Every collection, most sales this week first
  app.get("/api/collections", async (req, res) => {
    try {
      const collections = await Collection.find();
      res.json(await sortBySales(await withLiveFloors(collections)));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // One collection with its live floor
  app.get("/api/collections/:slug", async (req, res) => {
    try {
      const collection = await Collection.findOne({ slug: req.params.slug });
      if (!collection) return res.status(404).json({ message: "Collection not found" });
      const [withFloor] = await withLiveFloors([collection]);
      res.json(withFloor);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  const LIST_FIELDS = "tokenId name imageUrl price priceChange isListed ownerAddress contractAddress collectionId";

  // NFTs of a wallet (?owner) or a collection (?collectionId), or else the newest listings
  app.get("/api/nfts", async (req, res) => {
    const { limit = 500, owner, collectionId } = req.query;

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
        .select(LIST_FIELDS)
        .populate("collectionId", "name")
        .collation({ locale: "en_US", numericOrdering: true })
        .sort(sortConfig)
        .lean();
      if (owner || collectionId) return res.json(nfts);

      const latest = await newestListingsFirst(nfts);
      res.json(latest.slice(0, Math.min(parseInt(limit) || 500, 1000)));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // One NFT with its collection
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

  // The hand-picked featured items
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

  // The top 5 listed NFTs for ?period (24h, 7d or 30d)
  app.get("/api/featurednft", async (req, res) => {
    try {
      const period = SALES_PERIODS[req.query.period] ? req.query.period : "24h";
      res.json(await topNfts(period));
    } catch (err) {
      console.error("Top NFTs error:", err);
      res.status(500).json({ message: "Featured NFT API Error" });
    }
  });

  // USD prices of ETH, HEMI and USDC
  app.get("/api/prices", async (req, res) => {
    try {
      const { prices, updatedAt } = await getPrices();
      const secondsLeft = Math.max(0, Math.floor((updatedAt + PRICE_TTL - Date.now()) / 1000));
      res.set("Cache-Control", `public, max-age=${secondsLeft}`);
      res.json({ prices, updatedAt });
    } catch (err) {
      res.status(502).json({ message: err.message });
    }
  });

  const ACTIVITY_TYPES = new Set(["LIST", "SOLD", "UPDATE", "CANCEL", "TRANSFER"]);
  const MAX_ACTIVITY_PAGE = 50;
  const queryText = (value) => (typeof value === "string" ? value.trim() : "");

  // Activity, newest first, filtered by ?collection, ?address, ?type or ?market=vehemi
  app.get('/api/activity', async (req, res) => {
    try {
      const limit = Math.min(MAX_ACTIVITY_PAGE, Math.max(1, parseInt(req.query.limit) || 20));
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const collection = queryText(req.query.collection).toLowerCase();
      const address = queryText(req.query.address).toLowerCase();
      const types = queryText(req.query.type).split(",").filter((t) => ACTIVITY_TYPES.has(t));

      const filter = {};
      if (collection) filter.collection = collection;
      if (address) filter.$or = [{ from: address }, { to: address }];
      if (types.length) filter.type = { $in: types };
      if (req.query.market === "vehemi") filter.market = "vehemi";
      filter.$nor = [{ market: "vehemi", type: { $ne: "SOLD" } }];

      const [items, total] = await Promise.all([
        Activity.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Activity.countDocuments(filter),
      ]);

      const rows = await withSellers(items);

      const addresses = [...new Set(rows.flatMap((i) => [i.from, i.to].filter(Boolean)))];
      const collectionAddresses = [...new Set(rows.map((i) => i.collection).filter(Boolean))];
      const tokens = [...new Map(rows.filter((i) => i.market !== "vehemi" && i.collection && i.tokenId)
        .map((i) => [`${i.collection}:${i.tokenId}`, { contractAddress: i.collection, tokenId: i.tokenId }])).values()];

      const [users, collections, nfts] = await Promise.all([
        User.find({ walletAddress: { $in: addresses } }).select("walletAddress username profileImageUrl").lean(),
        Collection.find({ contractAddress: { $in: collectionAddresses } }).select("contractAddress name slug logoUrl").lean(),
        tokens.length ? NFT.find({ $or: tokens }).select("contractAddress tokenId name imageUrl collectionId").lean() : [],
      ]);

      const userMap = Object.fromEntries(users.map((u) => [u.walletAddress, u]));
      const collectionMap = Object.fromEntries(collections.map((c) => [c.contractAddress, c]));
      const nftMap = Object.fromEntries(nfts.map((n) => [`${n.contractAddress}:${n.tokenId}`, n]));

      const enriched = rows.map((item) => ({
        ...item,
        fromUser: userMap[item.from] ?? null,
        toUser: userMap[item.to] ?? null,
        collectionInfo: collectionMap[item.collection] ?? null,
        nft: nftMap[`${item.collection}:${item.tokenId}`] ?? null,
      }));

      res.json({ items: enriched, total, page, limit });
    } catch (err) {
      console.error("Activity route error:", err.message);
      res.status(500).json({ message: "Could not load activity." });
    }
  });

  // Sales and volume over the last 7 days, NFTs and veHEMI apart
  app.get("/api/activity/summary", async (req, res) => {
    try {
      res.json(await salesSummary());
    } catch (err) {
      console.error("Activity summary error:", err.message);
      res.status(500).json({ message: "Could not load the sales summary." });
    }
  });

  // Every month's stats, newest first
  app.get("/api/stats/monthly", async (req, res) => {
    try {
      res.json(await DataDump.find({}, { _id: 0, __v: 0 }).sort({ month: -1 }).lean());
    } catch (err) {
      console.error("Monthly stats error:", err.message);
      res.status(500).json({ message: "Could not load the monthly stats." });
    }
  });
}
