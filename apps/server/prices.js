import { recordPriceSample } from "./models/DataDump.js";

const CRYPTORANK_IDS = { ETH: 3, HEMI: 192009, USDC: 5487 };

export const PRICE_TTL = 4 * 60 * 60 * 1000;
const RETRY_DELAY = 5 * 60 * 1000;

let cache = null;
let inFlight = null;
let retryAfter = 0;

// Fetches ETH, HEMI and USDC prices in USD from CryptoRank in one request
async function fetchPrices() {
  const ids = Object.values(CRYPTORANK_IDS).join(",");
  const res = await fetch(`https://api.cryptorank.io/v3/currencies/list?currencyIds=${ids}`, {
    headers: { "X-Api-Key": process.env.CRYPTORANK_API_KEY },
  });
  if (!res.ok) throw new Error(`CryptoRank request failed: ${res.status}`);
  const { data } = await res.json();
  const byId = new Map(data.map((coin) => [coin.id, Number(coin.price)]));
  const prices = Object.fromEntries(Object.entries(CRYPTORANK_IDS).map(([symbol, id]) => [symbol, byId.get(id) ?? null]));
  return { prices, updatedAt: Date.now() };
}

// Cached prices, refetched every 4 hours; on failure keeps the last ones and retries in 5 minutes
export async function getPrices() {
  const now = Date.now();
  if (cache && (now - cache.updatedAt < PRICE_TTL || now < retryAfter)) return cache;
  if (!cache && now < retryAfter) throw new Error("Prices temporarily unavailable");

  inFlight ??= fetchPrices()
    .then((fresh) => {
      cache = fresh;
      recordPriceSample(fresh.prices).catch((err) => console.error("Price sample not saved:", err.message));
      return fresh;
    })
    .catch((err) => {
      retryAfter = Date.now() + RETRY_DELAY;
      throw err;
    })
    .finally(() => (inFlight = null));

  try {
    return await inFlight;
  } catch (err) {
    if (cache) return cache;
    throw err;
  }
}
