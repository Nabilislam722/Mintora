import { useQueryClient } from "@tanstack/react-query";

// The API reads NFTs from the database, which the crawler fills from the chain a few seconds after each block.
// So after a trade: show the result straight away on the NFT's page and in every NFT list already loaded, then
// ask the API until it has the same state, and only then refresh everything else that depends on it. Refetching
// any earlier brings back the old state, which is what made people reload the page.
const POLL_INTERVAL = 3_000;
const GIVE_UP_AFTER = 120_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The newest sync for each NFT page, so a later trade (list, then change the price) takes over from an earlier one
const latest = new Map();

// The URL of a query keyed by an API address (`${BASE_URL}/api/nfts?owner=…`), or null for any other key
function keyUrl(queryKey) {
  const [key] = queryKey;
  if (typeof key !== "string" || !key.includes("/api/")) return null;
  try {
    return new URL(key, window.location.origin);
  } catch {
    return null;
  }
}

const isList = (url) => url && (url.pathname.endsWith("/api/nfts") || url.pathname.endsWith("/api/featurednft"));

// Data that depends on who owns an NFT and what it's listed for: lists, floors, volume and activity. Top NFTs
// are left out: the server keeps them for a minute, so asking again could bring back one that just sold, and the
// home page already refreshes them every 20 s.
const isAffected = ({ queryKey }) => {
  if (queryKey[0] === "activity") return true;
  const path = keyUrl(queryKey)?.pathname ?? "";
  return ["/api/nfts", "/api/collections", "/api/activity"].some((p) => path.includes(p));
};

const sameValue = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
const isSynced = (server, patch) => !!server && Object.entries(patch).every(([k, v]) => sameValue(server[k], v));

// One loaded list with the NFT updated, added (it now belongs there) or removed (it no longer does)
function patchList(list, url, nft, patch) {
  if (!Array.isArray(list)) return list;
  const index = list.findIndex((n) => String(n._id) === String(nft._id));
  const next = { ...(index >= 0 ? list[index] : nft), ...patch };
  const owner = url.searchParams.get("owner");

  let belongs;
  if (url.pathname.endsWith("/api/featurednft")) belongs = index >= 0 && next.isListed; // the server picks these
  else if (owner) belongs = sameValue(owner, next.ownerAddress); // a wallet's items
  else if (url.searchParams.has("collectionId")) belongs = index >= 0; // a collection's items
  else belongs = next.isListed; // the site-wide feed of listings

  if (index >= 0) return belongs ? list.map((n, i) => (i === index ? next : n)) : list.filter((_, i) => i !== index);
  return belongs ? [next, ...list] : list;
}

// Returns sync(detailKey, nft, patch): call it once a trade's transaction is confirmed. `detailKey` is the
// NFT page's query key, `nft` the NFT as that page loaded it, and `patch` the fields the trade changed, as the
// API will report them (e.g. { isListed: false, price: "0", ownerAddress } after a sale).
export function useNftSync() {
  const queryClient = useQueryClient();

  return async function sync(detailKey, nft, patch) {
    const token = {};
    latest.set(detailKey[0], token);

    // Balances moved on-chain already (price, gas)
    queryClient.invalidateQueries({ predicate: ({ queryKey: [key] }) => key === "balance" || key === "readContracts" });

    queryClient.setQueryData(detailKey, (old) => old && { ...old, ...patch });
    for (const query of queryClient.getQueryCache().findAll({ predicate: ({ queryKey }) => isList(keyUrl(queryKey)) })) {
      const url = keyUrl(query.queryKey);
      queryClient.setQueryData(query.queryKey, (list) => patchList(list, url, nft, patch));
    }

    const until = Date.now() + GIVE_UP_AFTER;
    while (Date.now() < until) {
      await sleep(POLL_INTERVAL);
      if (latest.get(detailKey[0]) !== token) return; // a newer trade on this NFT is being synced instead
      try {
        const res = await fetch(detailKey[0], { credentials: "include", cache: "no-store" });
        const server = res.ok ? await res.json() : null;
        if (isSynced(server, patch)) {
          latest.delete(detailKey[0]);
          queryClient.setQueryData(detailKey, server);
          await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== detailKey[0] && isAffected(q) });
          return;
        }
      } catch {
        // Network hiccup: ask again on the next round
      }
    }

    // The crawler is behind. Keep showing the trade's result, and load fresh data the next time each page opens.
    if (latest.get(detailKey[0]) === token) latest.delete(detailKey[0]);
    queryClient.invalidateQueries({ predicate: isAffected, refetchType: "none" });
  };
}
