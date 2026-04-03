import { db } from "./db.js";
import { users, collections, nfts } from "../shared/schema.js";
import { eq, ilike, or, and } from "drizzle-orm";

class DatabaseStorage {
  async getUser(address) {
    const [user] = await db.select().from(users).where(eq(users.walletAddress, address));
    return user;
  }

  async upsertUser(insertUser) {
    const existing = await this.getUser(insertUser.walletAddress);
    if (existing) {
      const [updated] = await db.update(users)
        .set(insertUser)
        .where(eq(users.walletAddress, insertUser.walletAddress))
        .returning();
      return updated;
    }
    const [created] = await db.insert(users).values(insertUser).returning();
    return created;
  }

  async getCollections() {
    return await db.select().from(collections);
  }

  async getCollectionBySlug(slug) {
    const [collection] = await db.select().from(collections).where(eq(collections.slug, slug));
    return collection;
  }

  async createCollection(collection) {
    const [created] = await db.insert(collections).values(collection).returning();
    return created;
  }

  async getNfts(filters) {
    let query = db.select({
      nfts: nfts,
      collection: collections
    })
      .from(nfts)
      .leftJoin(collections, eq(nfts.collectionId, collections.id));

    const conditions = [];

    if (filters?.collectionId) {
      conditions.push(eq(nfts.collectionId, filters.collectionId));
    }
    if (filters?.owner) {
      conditions.push(eq(nfts.ownerAddress, filters.owner));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(nfts.name, `%${filters.search}%`),
          ilike(collections.name, `%${filters.search}%`)
        )
      );
    }
    if (filters?.featured) {
      conditions.push(eq(nfts.noVrfFee, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const results = await query;
    return results.map(r => ({ ...r.nfts, collection: r.collection }));
  }

  async getNft(id) {
    const [result] = await db.select({
      nfts: nfts,
      collection: collections
    })
      .from(nfts)
      .leftJoin(collections, eq(nfts.collectionId, collections.id))
      .where(eq(nfts.id, id));

    if (!result) return undefined;
    return { ...result.nfts, collection: result.collection };
  }

  async createNft(nft) {
    const [created] = await db.insert(nfts).values(nft).returning();
    return created;
  }

  async updateNft(id, updates) {
    const [updated] = await db.update(nfts)
      .set(updates)
      .where(eq(nfts.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
