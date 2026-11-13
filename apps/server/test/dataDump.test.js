import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { buildMonth, pendingMonths, summarize } from "../lib/dataDump.js";
import { monthKey } from "../lib/months.js";
import { Activity } from "../models/Activity.js";
import { DataDump, recordPriceSample } from "../models/DataDump.js";

const wallet = (c) => `0x${c.repeat(40)}`;
const [A, B, C, D, E, S, T1, T2] = ["a", "b", "c", "d", "e", "f", "1", "2"].map(wallet);
const VE = "0x371d3718d5b7f75eab050fae6da7df3092031c89";
const COL = "0x00000000000000000000000000000000000000c1";
const wei = (n) => (BigInt(Math.round(n * 1e6)) * 10n ** 12n).toString();

describe("summarize", () => {
  const rows = [
    { type: "SOLD", market: "vehemi", viaOffer: false, from: A, to: B, collection: VE, tokenId: "1", price: wei(100), tx: "0x01" },
    { type: "SOLD", market: "vehemi", viaOffer: true, from: C, to: A, collection: VE, tokenId: "2", price: wei(50), tx: "0x02" },
    { type: "LIST", market: "vehemi", from: C, to: null, collection: VE, tokenId: "3", price: wei(70), tx: "0x03" },
    { type: "OFFER", market: "vehemi", from: D, to: E, collection: VE, tokenId: "4", price: wei(60), tx: "0x04" },
    { type: "SOLD", from: S, to: B, collection: COL, tokenId: "7", price: wei(1), tx: "0x05" },
    { type: "LIST", from: S, to: null, collection: COL, tokenId: "8", price: wei(2), tx: "0x06" },
    { type: "UPDATE", from: S, to: null, collection: COL, tokenId: "8", price: wei(1.5), tx: "0x07" },
    { type: "CANCEL", from: S, to: null, collection: COL, tokenId: "8", price: "0", tx: "0x08" },
    { type: "TRANSFER", from: T1, to: T2, collection: COL, tokenId: "9", price: "0", tx: "0x09" },
  ];
  const stats = summarize({
    rows,
    prices: { ethUsd: 2000, hemiUsd: 0.05 },
    seenBefore: new Set([A, S]),
    activeLastMonth: new Set([B, T1]),
    collectionNames: new Map([[COL, "Test Bros"]]),
  });

  test("veHEMI: a bought listing and an accepted offer are both sales", () => {
    assert.deepEqual(stats.vehemi, {
      sales: 2, volume: 150, volumeUsd: 7.5, feesEst: 7.5, listings: 1, delistings: 0,
      uniqueBuyers: 2, uniqueSellers: 2, avgSaleUsd: 3.75,
      biggestSale: { tokenId: "1", collection: VE, price: 100, usd: 5, tx: "0x01" },
    });
    assert.equal(stats.vehemiOffersAccepted, 1);
  });

  test("NFTs: sale, listing and delisting count; a price change and a transfer don't", () => {
    assert.deepEqual(stats.nft, {
      sales: 1, volume: 1, volumeUsd: 2000, feesEst: 0.05, listings: 1, delistings: 1,
      uniqueBuyers: 1, uniqueSellers: 1, avgSaleUsd: 2000,
      biggestSale: { tokenId: "7", collection: COL, price: 1, usd: 2000, tx: "0x05" },
    });
    assert.deepEqual(stats.topCollections, [{ address: COL, name: "Test Bros", sales: 1, volume: 1, volumeUsd: 2000 }]);
  });

  test("wallets: transfers and an offer's holder aren't activity; new and returning", () => {
    assert.deepEqual(stats.wallets, {
      active: 5,
      traders: 4,
      new: 3,
      returning: 1,
    });
  });

  test("a month with nothing in it", () => {
    const empty = summarize({ rows: [], prices: { ethUsd: 0, hemiUsd: 0 } });
    assert.equal(empty.nft.sales, 0);
    assert.equal(empty.nft.biggestSale, undefined);
    assert.deepEqual(empty.wallets, { active: 0, traders: 0, new: 0, returning: 0 });
  });
});

describe("building and freezing months", () => {
  let connected = false;

  before(async () => {
    try {
      await mongoose.connect(process.env.TEST_MONGODB_URI ?? "mongodb://127.0.0.1:27017/mintora_test_datadump", {
        serverSelectionTimeoutMS: 2000,
      });
      await mongoose.connection.dropDatabase();
      await Promise.all([Activity.init(), DataDump.init()]);
      connected = true;
    } catch {}
    if (!connected) return;

    const at = (iso) => new Date(iso);
    let n = 0;
    const row = (r) => ({ tx: `0xt${++n}`, logIndex: 0, price: "0", to: null, ...r });
    await Activity.insertMany([
      row({ type: "LIST", from: S, collection: COL, tokenId: "7", price: wei(1), createdAt: at("2026-01-05T00:00:00Z") }),
      row({ type: "SOLD", from: null, to: B, collection: COL, tokenId: "7", price: wei(1), createdAt: at("2026-01-10T00:00:00Z") }),
      row({ type: "SOLD", market: "vehemi", viaOffer: false, from: A, to: B, collection: VE, tokenId: "1", price: wei(100), createdAt: at("2026-01-20T00:00:00Z") }),
      row({ type: "SOLD", market: "vehemi", viaOffer: true, from: B, to: D, collection: VE, tokenId: "1", price: wei(120), createdAt: at("2026-02-03T00:00:00Z") }),
      row({ type: "CANCEL", from: S, collection: COL, tokenId: "8", createdAt: at("2026-02-04T00:00:00Z") }),
      row({ type: "TRANSFER", from: T1, to: T2, collection: COL, tokenId: "9", createdAt: at("2026-02-05T00:00:00Z") }),
    ]);
    await DataDump.insertMany([
      { month: "2026-01", prices: { ethUsd: 3000, hemiUsd: 0.1, samples: 4 } },
      { month: "2026-02", prices: { ethUsd: 2500, hemiUsd: 0.08, samples: 2 } },
    ]);
  });

  after(async () => {
    if (connected) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test("finished months from the first activity are pending", async (t) => {
    if (!connected) return t.skip("MongoDB isn't running");
    assert.deepEqual(await pendingMonths(undefined, new Date("2026-03-15T00:00:00Z")), ["2026-01", "2026-02"]);
  });

  test("January builds from Activity with its sampled prices, and is frozen", async (t) => {
    if (!connected) return t.skip("MongoDB isn't running");
    await buildMonth("2026-01", { final: true });
    const jan = await DataDump.findOne({ month: "2026-01" }).lean();
    assert.equal(jan.final, true);
    assert.equal(jan.nft.sales, 1);
    assert.equal(jan.nft.volumeUsd, 3000);
    assert.equal(jan.nft.uniqueSellers, 1, "the old sale's seller comes from S's listing");
    assert.equal(jan.vehemi.volumeUsd, 10);
    assert.deepEqual(jan.prices, { ethUsd: 3000, hemiUsd: 0.1, samples: 4 });
    assert.deepEqual(jan.wallets, { active: 3, traders: 3, new: 3, returning: 0 });
  });

  test("a frozen month never changes, even when Activity does", async (t) => {
    if (!connected) return t.skip("MongoDB isn't running");
    const before = await DataDump.findOne({ month: "2026-01" }).lean();
    await Activity.create({ tx: "0xlate", logIndex: 0, type: "SOLD", from: A, to: C, collection: COL, tokenId: "5", price: wei(9), createdAt: new Date("2026-01-25T00:00:00Z") });
    assert.equal(await buildMonth("2026-01", { final: true }), null);
    assert.equal(await buildMonth("2026-01", { final: false }), null);
    assert.deepEqual(await DataDump.findOne({ month: "2026-01" }).lean(), before);
    assert.equal(await DataDump.countDocuments({ month: "2026-01" }), 1);
  });

  test("after a restart over the boundary, only the missed month is pending, and it builds", async (t) => {
    if (!connected) return t.skip("MongoDB isn't running");
    assert.deepEqual(await pendingMonths(undefined, new Date("2026-03-15T00:00:00Z")), ["2026-02"]);
    await buildMonth("2026-02", { final: true });
    const feb = await DataDump.findOne({ month: "2026-02" }).lean();
    assert.equal(feb.final, true);
    assert.equal(feb.vehemi.sales, 1);
    assert.equal(feb.vehemiOffersAccepted, 1);
    assert.equal(feb.vehemi.volumeUsd, 9.6);
    assert.equal(feb.nft.delistings, 1);
    assert.equal(feb.nft.sales, 0);
    assert.deepEqual(feb.wallets, { active: 3, traders: 2, new: 1, returning: 2 });
    assert.deepEqual(await pendingMonths(undefined, new Date("2026-03-15T00:00:00Z")), []);
  });

  test("price samples keep a running average for the current month", async (t) => {
    if (!connected) return t.skip("MongoDB isn't running");
    await recordPriceSample({ HEMI: 0.04, ETH: 3000 });
    await recordPriceSample({ HEMI: 0.06, ETH: 3200 });
    await recordPriceSample({ HEMI: null, ETH: 3100 });
    const { prices } = await DataDump.findOne({ month: monthKey(new Date()) }).lean();
    assert.equal(prices.samples, 2);
    assert.ok(Math.abs(prices.hemiUsd - 0.05) < 1e-12);
    assert.equal(prices.ethUsd, 3100);
  });
});
