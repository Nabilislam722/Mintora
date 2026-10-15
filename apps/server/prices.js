// Token USD prices from CryptoRank (free plan: 10,000 credits/month, 10 req/min).
// One request (1 credit) covers every token, and the result is shared by all visitors
// for PRICE_TTL, so the API is hit at most ~3 times a day no matter how much traffic we get.

// CryptoRank currency ids, from GET /v3/currencies/map
const CRYPTORANK_IDS = { ETH: 3, HEMI: 192009, USDC: 5487 };

export const PRICE_TTL = 8 * 60 * 60 * 1000;
const RETRY_DELAY = 5 * 60 * 1000;

let cache = null; // { prices: { ETH, HEMI, USDC }, updatedAt }
let inFlight = null;
let retryAfter = 0;

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

// Concurrent callers share one request; if CryptoRank fails we keep serving the last
// prices and wait RETRY_DELAY before trying again, so an outage can't drain credits
export async function getPrices() {
  const now = Date.now();
  if (cache && (now - cache.updatedAt < PRICE_TTL || now < retryAfter)) return cache;
  if (!cache && now < retryAfter) throw new Error("Prices temporarily unavailable");

  inFlight ??= fetchPrices()
    .then((fresh) => (cache = fresh))
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
