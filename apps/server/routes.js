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
import { requireAuth } from "./lib/auth.js";
import { isUserImageUrl } from "./lib/r2.js";

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

    res.json({ nfts, collections: await withLiveFloors(collections), users });
  });

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
  // Only the signed-in wallet can edit its own profile. Fields left out of the body stay as they are.
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
    // Images must be the wallet's own uploads ("" removes one)
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
      // Two wallets saving the same new name at once: the unique index lets only one through
      if (err.code === 11000 && err.keyPattern?.username) return res.status(409).json({ message: "That username is taken." });
      console.error("Profile save error:", err);
      res.status(500).json({ message: "Could not save the profile." });
    }
  });

  // Whether a username can be used, so the settings page can say so before anything is signed or uploaded.
  // `for` is the wallet asking, whose own current name counts as available.
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

  // Most sales in the last 7 days first, then by all-time volume (lib/trending.js)
  app.get("/api/collections", async (req, res) => {
    try {
      const collections = await Collection.find();
      res.json(await sortBySales(await withLiveFloors(collections)));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

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

  // What the list views (cards, rows, collection and wallet stats) use. Descriptions and attributes are only
  // shown on an NFT's own page, which has its own endpoint, and would make a whole collection several times
  // bigger to send.
  const LIST_FIELDS = "tokenId name imageUrl price priceChange isListed ownerAddress contractAddress collectionId";

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

      let nfts = NFT.find(query)
        .select(LIST_FIELDS)
        .populate("collectionId", "name")
        .collation({ locale: "en_US", numericOrdering: true })
        .sort(sortConfig)
        .lean();
      // Collection and wallet pages filter, search, sort and count in the browser, so they need every match:
      // capping them hid everything past the 500th token (Hemi Bros #6246, AirHemiHatchlings #500+) and made
      // the item, owner and listed counts wrong. Only the site-wide listed feed is capped.
      if (!owner && !collectionId) nfts = nfts.limit(Math.min(parseInt(limit) || 500, 1000));

      res.json(await nfts);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

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

  // Top NFTs: the best 5 listings for ?period (24h, 7d or 30d), scored on their collection's sales, their own
  // trading, freshness, price against recent sales, and hand-picked priority (lib/top-nfts.js)
  app.get("/api/featurednft", async (req, res) => {
    try {
      const period = SALES_PERIODS[req.query.period] ? req.query.period : "24h";
      res.json(await topNfts(period));
    } catch (err) {
      console.error("Top NFTs error:", err);
      res.status(500).json({ message: "Featured NFT API Error" });
    }
  });

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

  // Kinds of activity a feed can ask for: ?type=SOLD, or several (?type=LIST,UPDATE,CANCEL)
  const ACTIVITY_TYPES = new Set(["LIST", "SOLD", "UPDATE", "CANCEL", "TRANSFER"]);
  const MAX_ACTIVITY_PAGE = 50;
  const queryText = (value) => (typeof value === "string" ? value.trim() : "");

  // Newest first. Filters: ?collection (contract address), ?address (either side of the event), ?type, and
  // ?market=vehemi for veHEMI sales only.
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

      const [items, total] = await Promise.all([
        Activity.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Activity.countDocuments(filter),
      ]);

      // NFT sales recorded before the crawler saved sellers have none: their seller is who sent the NFT in the
      // sale's own Transfer, which is in the same transaction
      const noSeller = items.filter((i) => i.type === "SOLD" && !i.from && i.market !== "vehemi");
      const transfers = noSeller.length
        ? await Activity.find({ tx: { $in: noSeller.map((i) => i.tx) }, type: "TRANSFER" }).select("tx collection tokenId from").lean()
        : [];
      const sellers = new Map(transfers.map((t) => [`${t.tx}:${t.collection}:${t.tokenId}`, t.from]));
      const rows = items.map((i) =>
        noSeller.includes(i) ? { ...i, from: sellers.get(`${i.tx}:${i.collection}:${i.tokenId}`) ?? null } : i
      );

      const addresses = [...new Set(rows.flatMap((i) => [i.from, i.to].filter(Boolean)))];
      const collectionAddresses = [...new Set(rows.map((i) => i.collection).filter(Boolean))];
      // veHEMI positions aren't stored as NFTs: the site draws those itself
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

  // Sales and volume over the last 7 days, NFTs (ETH) and veHEMI (HEMI) apart (lib/sales-summary.js)
  app.get("/api/activity/summary", async (req, res) => {
    try {
      res.json(await salesSummary());
    } catch (err) {
      console.error("Activity summary error:", err.message);
      res.status(500).json({ message: "Could not load the sales summary." });
    }
  });
}