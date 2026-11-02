// Picks which URL an NFT image loads from, keeping IPFS gateway requests to a minimum:
// - an image that loaded before is asked for at the exact same URL, so the browser answers from its own cache;
// - a gateway that failed for an image isn't asked for it again for a while (many CIDs are on no gateway at all);
// - gateways that fail for everything (usually 429 Too Many Requests) rest for a while, for every image.

// Public gateways, best first. cloudflare-ipfs.com no longer exists, and nftstorage.link / w3s.link redirect to the
// same rate-limited backend as ipfs.io and dweb.link, so they'd only add failed requests.
const PUBLIC_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
];
// Only serves content pinned on our Pinata account, so it's the last resort
const DEDICATED_GATEWAY = "https://maroon-impressed-toucan-831.mypinata.cloud/ipfs/";
const GATEWAYS = [...PUBLIC_GATEWAYS, DEDICATED_GATEWAY];

// CID -> the URL that last loaded it. IPFS content never changes, so a URL that worked keeps working.
const URL_KEY = "resolved_nft_img:";
const URL_TTL = 30 * 24 * 60 * 60 * 1000;
const URL_REFRESH = 24 * 60 * 60 * 1000; // how often a URL in use gets its timestamp renewed
const urls = new Map(); // in-memory copy, so the same CID isn't read from localStorage for every card

// CID -> { source: until }: where it failed, so it isn't asked there again until then
const MISSES_KEY = "ipfs_img_misses";
const MISS_MS = 15 * 60 * 1000;
const MAX_MISSES = 500; // CIDs remembered, oldest dropped first

// A gateway rests when it keeps failing and hasn't served anything lately. One that still serves some images (and
// 404s on CIDs it doesn't have) stays awake.
const HEALTH_KEY = "ipfs_gateway_health";
const FAILS_TO_REST = 3;
const QUIET_MS = 2 * 60 * 1000; // no success for this long
const REST_MS = 10 * 60 * 1000;

const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or blocked: the in-memory copies still work for this visit
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

// { preferred: public gateway that last worked, gateways: { gateway: { fails, lastOk, restUntil } } }
const savedHealth = store.get(HEALTH_KEY);
const health = { preferred: savedHealth?.preferred ?? null, gateways: savedHealth?.gateways ?? {} };
const misses = store.get(MISSES_KEY) ?? {};

// "bafy…/1.png" for ipfs://… and …/ipfs/… URLs, else null
export function cidPathOf(src) {
  if (!src || typeof src !== "string") return null;
  if (src.startsWith("ipfs://")) return src.slice(7).replace(/^ipfs\//, "") || null;
  const match = src.match(/\/ipfs\/(.+)$/);
  return match ? match[1] : null;
}

const gatewayOf = (url) => GATEWAYS.find((gw) => url?.startsWith(gw));
// What a miss is recorded against: the gateway, or the whole URL for hosts we don't know
const sourceOf = (url) => gatewayOf(url) ?? url;
const missed = (cid, url) => (misses[cid]?.[sourceOf(url)] ?? 0) > Date.now();

function cachedUrl(cid) {
  if (!urls.has(cid)) urls.set(cid, store.get(URL_KEY + cid));
  const entry = urls.get(cid);
  return entry && Date.now() - entry.timestamp < URL_TTL ? entry.url : null;
}

// Gateways in the order to try: the one that last worked, then the others, then any that are resting. Resting
// ones stay at the end rather than dropping out, in case nothing else has the file.
function rankedGateways() {
  const now = Date.now();
  const resting = (gw) => (health.gateways[gw]?.restUntil ?? 0) > now;
  const awake = GATEWAYS.filter((gw) => !resting(gw));
  const preferred = awake.includes(health.preferred) ? [health.preferred] : [];
  return [...new Set([...preferred, ...awake, ...GATEWAYS.filter(resting)])];
}

// URLs to try for an image, in order. Empty when there's no image, or it has recently failed everywhere.
export function imageCandidates(src) {
  const cid = cidPathOf(src);
  if (!cid) return src ? [src] : [];
  // A host we don't know (e.g. a collection's own gateway) may be the only one with the file, so it goes early.
  // A known gateway in the stored URL gets no special place: health decides.
  const unknownHost = !src.startsWith("ipfs://") && !gatewayOf(src) ? src : null;
  const all = [cachedUrl(cid), unknownHost, ...rankedGateways().map((gw) => gw + cid)];
  return [...new Set(all.filter((url) => url && !missed(cid, url)))];
}

function saveMisses() {
  const now = Date.now();
  for (const cid of Object.keys(misses)) {
    for (const source of Object.keys(misses[cid])) if (misses[cid][source] <= now) delete misses[cid][source];
    if (!Object.keys(misses[cid]).length) delete misses[cid];
  }
  const cids = Object.keys(misses);
  for (const cid of cids.slice(0, Math.max(0, cids.length - MAX_MISSES))) delete misses[cid];
  store.set(MISSES_KEY, misses);
}

export function reportImageLoaded(src, url) {
  const cid = cidPathOf(src);
  if (cid) {
    const entry = urls.get(cid);
    if (entry?.url !== url || Date.now() - entry.timestamp > URL_REFRESH) {
      const fresh = { url, timestamp: Date.now() };
      urls.set(cid, fresh);
      store.set(URL_KEY + cid, fresh);
    }
    if (misses[cid]) {
      delete misses[cid];
      saveMisses();
    }
  }
  const gw = gatewayOf(url);
  if (!gw) return;
  health.gateways[gw] = { fails: 0, lastOk: Date.now(), restUntil: 0 };
  // The dedicated gateway only has our own pins, so it never becomes everyone's first choice
  if (PUBLIC_GATEWAYS.includes(gw)) health.preferred = gw;
  store.set(HEALTH_KEY, health);
}

export function reportImageFailed(src, url) {
  const cid = cidPathOf(src);
  if (cid) {
    if (urls.get(cid)?.url === url) {
      urls.set(cid, null);
      store.remove(URL_KEY + cid);
    }
    misses[cid] = { ...misses[cid], [sourceOf(url)]: Date.now() + MISS_MS };
    saveMisses();
  }
  const gw = gatewayOf(url);
  if (!gw) return;
  const h = { fails: 0, lastOk: 0, restUntil: 0, ...health.gateways[gw] };
  h.fails++;
  if (h.fails >= FAILS_TO_REST && Date.now() - h.lastOk > QUIET_MS) {
    h.fails = 0;
    h.restUntil = Date.now() + REST_MS;
    if (health.preferred === gw) health.preferred = null;
  }
  health.gateways[gw] = h;
  store.set(HEALTH_KEY, health);
}
