import { ethers } from "ethers";
import { Activity } from "../models/Activity.js";
import { Collection } from "../models/Collection.js";
import { DataDump } from "../models/DataDump.js";
import { CRAWLER_CURSORS, SyncState } from "../models/SyncState.js";
import { getPrices } from "../prices.js";
import { addMonths, monthKey, monthRange } from "./months.js";
import { createHemiProvider } from "./provider.js";
import { withSellers } from "./sellers.js";

export const FEE_BPS = { nft: 500, vehemi: 500 };
const TOP_COLLECTIONS = 10;
const CAUGHT_UP_BLOCKS = 50;
const HOUR = 60 * 60_000;
const LIVE_REFRESH = 6 * HOUR;

const ZERO = ethers.ZeroAddress;
const MARKETS = ["nft", "vehemi"];
const marketOf = (row) => (row.market === "vehemi" ? "vehemi" : "nft");
const isWallet = (a) => !!a && a !== ZERO;
const round = (n, digits) => Math.round(n * 10 ** digits) / 10 ** digits;

function toWei(value) {
  try {
    return BigInt(value || 0);
  } catch {
    return 0n;
  }
}
const tokens = (wei) => Number(ethers.formatEther(wei));

// Wallets that acted in a row: both sides of a sale, the lister or delister, an offer's buyer
function actors(row) {
  if (row.type === "TRANSFER") return [];
  return (row.type === "SOLD" ? [row.from, row.to] : [row.from]).filter(isWallet);
}

// Every wallet that acted in `rows` (plain transfers don't count)
export function activeWallets(rows) {
  return new Set(rows.flatMap(actors));
}

const emptyMarket = () => ({
  sales: 0, volume: 0, volumeUsd: 0, feesEst: 0, listings: 0, delistings: 0,
  uniqueBuyers: 0, uniqueSellers: 0, avgSaleUsd: 0,
});

// A month's stats from its Activity rows, without touching the database
export function summarize({ rows, prices, seenBefore = new Set(), activeLastMonth = new Set(), collectionNames = new Map() }) {
  const usd = { nft: prices.ethUsd || 0, vehemi: prices.hemiUsd || 0 };
  const out = { nft: emptyMarket(), vehemi: emptyMarket() };
  const volume = { nft: 0n, vehemi: 0n };
  const buyers = { nft: new Set(), vehemi: new Set() };
  const sellers = { nft: new Set(), vehemi: new Set() };
  const biggest = { nft: null, vehemi: null };
  const collections = new Map();
  let offersAccepted = 0;

  for (const row of rows) {
    const m = marketOf(row);
    if (row.type === "LIST") out[m].listings++;
    else if (row.type === "CANCEL") out[m].delistings++;
    else if (row.type === "SOLD") {
      const wei = toWei(row.price);
      out[m].sales++;
      volume[m] += wei;
      if (isWallet(row.to)) buyers[m].add(row.to);
      if (isWallet(row.from)) sellers[m].add(row.from);
      if (!biggest[m] || wei > biggest[m].wei) biggest[m] = { wei, row };
      if (m === "vehemi" && row.viaOffer) offersAccepted++;
      if (m === "nft") {
        const c = collections.get(row.collection) ?? { sales: 0, wei: 0n };
        c.sales++;
        c.wei += wei;
        collections.set(row.collection, c);
      }
    }
  }

  for (const m of MARKETS) {
    const s = out[m];
    s.volume = tokens(volume[m]);
    s.volumeUsd = round(s.volume * usd[m], 2);
    s.feesEst = round((s.volume * FEE_BPS[m]) / 10_000, 8);
    s.uniqueBuyers = buyers[m].size;
    s.uniqueSellers = sellers[m].size;
    s.avgSaleUsd = s.sales ? round(s.volumeUsd / s.sales, 2) : 0;
    if (biggest[m]) {
      const { wei, row } = biggest[m];
      const price = tokens(wei);
      s.biggestSale = { tokenId: row.tokenId, collection: row.collection, price, usd: round(price * usd[m], 2), tx: row.tx };
    }
  }

  const topCollections = [...collections]
    .map(([address, c]) => {
      const vol = tokens(c.wei);
      return { address, name: collectionNames.get(address) ?? null, sales: c.sales, volume: vol, volumeUsd: round(vol * usd.nft, 2) };
    })
    .sort((a, b) => b.volumeUsd - a.volumeUsd || b.volume - a.volume || b.sales - a.sales)
    .slice(0, TOP_COLLECTIONS);

  const active = [...activeWallets(rows)];
  const traders = new Set(MARKETS.flatMap((m) => [...buyers[m], ...sellers[m]]));
  return {
    nft: out.nft,
    vehemi: out.vehemi,
    vehemiOffersAccepted: offersAccepted,
    topCollections,
    wallets: {
      active: active.length,
      traders: traders.size,
      new: active.filter((a) => !seenBefore.has(a)).length,
      returning: active.filter((a) => activeLastMonth.has(a)).length,
    },
  };
}

// Non-transfer Activity rows in [start, end), with missing NFT sellers filled in
async function rowsBetween(start, end) {
  const rows = await Activity.find({ createdAt: { $gte: start, $lt: end }, type: { $ne: "TRANSFER" } }).lean();
  return withSellers(rows);
}

// The month's sampled average prices, or today's prices if it has no samples
async function pricesFor(month, needed) {
  const doc = await DataDump.findOne({ month }, { prices: 1 }).lean();
  if (doc?.prices?.samples > 0) return doc.prices;
  try {
    const { prices } = await getPrices();
    if (prices.ETH > 0 && prices.HEMI > 0) return { ethUsd: prices.ETH, hemiUsd: prices.HEMI, samples: 0 };
  } catch (err) {
    if (needed) throw new Error(`no USD prices (${err.message})`);
  }
  if (needed) throw new Error("no USD prices");
  return { ethUsd: 0, hemiUsd: 0, samples: 0 };
}

// A month's stats and the prices they used, computed from Activity
export async function computeMonth(month) {
  const [start, end] = monthRange(month);
  const [prevStart] = monthRange(addMonths(month, -1));
  const [rows, prevRows] = await Promise.all([rowsBetween(start, end), rowsBetween(prevStart, start)]);

  const active = [...activeWallets(rows)];
  const earlier = active.length
    ? await withSellers(await Activity.find({
        createdAt: { $lt: start },
        type: { $ne: "TRANSFER" },
        $or: [{ from: { $in: active } }, { to: { $in: active }, type: "SOLD" }],
      }).lean())
    : [];
  const activeSet = new Set(active);
  const seenBefore = new Set(earlier.flatMap(actors).filter((a) => activeSet.has(a)));

  const nftCollections = [...new Set(rows.filter((r) => r.type === "SOLD" && marketOf(r) === "nft").map((r) => r.collection))];
  const names = await Collection.find({ contractAddress: { $in: nftCollections } }, { contractAddress: 1, name: 1 }).lean();

  const prices = await pricesFor(month, rows.some((r) => r.type === "SOLD"));
  const stats = summarize({
    rows,
    prices,
    seenBefore,
    activeLastMonth: activeWallets(prevRows),
    collectionNames: new Map(names.map((c) => [c.contractAddress, c.name])),
  });
  return { stats, prices };
}

// Builds and saves a month; a frozen month is never written again (returns null)
export async function buildMonth(month, { final }) {
  const { stats, prices } = await computeMonth(month);
  const usedToday = prices.samples === 0 ? { prices: { hemiUsd: prices.hemiUsd, ethUsd: prices.ethUsd, samples: 0 } } : {};
  try {
    await DataDump.updateOne(
      { month, final: { $ne: true } },
      { $set: { ...stats, ...usedToday, month, final, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    if (err.code === 11000) return null;
    throw err;
  }
  return stats;
}

// Finished months from `from` (or the first active month) that aren't frozen yet
export async function pendingMonths(from, now = new Date()) {
  let start = from;
  if (!start) {
    const first = await Activity.findOne({}, { createdAt: 1 }).sort({ createdAt: 1 }).lean();
    if (!first) return [];
    start = monthKey(first.createdAt);
  }
  const last = addMonths(monthKey(now), -1);
  const frozen = new Set((await DataDump.find({ final: true }, { month: 1 }).lean()).map((d) => d.month));
  const months = [];
  for (let m = start; m <= last; m = addMonths(m, 1)) if (!frozen.has(m)) months.push(m);
  return months;
}

let provider;

// Whether the crawler has read both markets up to about 10 minutes from the chain head
export async function crawlerCaughtUp() {
  const keys = Object.values(CRAWLER_CURSORS);
  const saved = await SyncState.find({ key: { $in: keys } }).lean();
  if (saved.length < keys.length) return false;
  provider ??= createHemiProvider("data dump");
  const head = await provider.getBlockNumber();
  return saved.every((s) => head - s.value <= CAUGHT_UP_BLOCKS);
}

// The log line for a built month
const describe = (month, stats, final) =>
  `📊 Data dump ${month}${final ? " (final)" : " (live)"}: ` +
  `NFT ${stats.nft.sales} sales · ${stats.nft.volume} ETH | veHEMI ${stats.vehemi.sales} sales · ${stats.vehemi.volume} HEMI | ` +
  `${stats.wallets.active} active wallets`;

let waitingLogged = false;

// Builds and freezes every pending month once the crawler has caught up
export async function finalizeMonths({ from } = {}) {
  const months = await pendingMonths(from);
  if (!months.length) return [];
  if (!(await crawlerCaughtUp())) {
    if (!waitingLogged) console.log(`📊 Data dump: ${months.join(", ")} wait for the crawler to catch up`);
    waitingLogged = true;
    return [];
  }
  waitingLogged = false;
  const done = [];
  for (const month of months) {
    const stats = await buildMonth(month, { final: true });
    if (stats) {
      console.log(describe(month, stats, true));
      done.push(month);
    }
  }
  return done;
}

// Rebuilds the current month so its stats stay live
export async function refreshCurrentMonth() {
  const month = monthKey(new Date());
  const stats = await buildMonth(month, { final: false });
  if (stats) console.log(describe(month, stats, false));
}

// Wraps a job so it never overlaps itself and only logs its failures
function guarded(name, job) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (err) {
      console.error(`📊 Data dump ${name} failed:`, err.message);
    } finally {
      running = false;
    }
  };
}

// Freezes finished months now and hourly, and refreshes the current month now and every 6 hours
export function startDataDump() {
  const finalize = guarded("finalize", () => finalizeMonths());
  const refresh = guarded("refresh", refreshCurrentMonth);
  finalize().then(refresh);
  setInterval(finalize, HOUR);
  setInterval(refresh, LIVE_REFRESH);
}
