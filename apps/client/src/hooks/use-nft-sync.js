import { useQueryClient } from "@tanstack/react-query";

const POLL_INTERVAL = 3_000;
const GIVE_UP_AFTER = 120_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const latest = new Map();

// The URL of a query keyed by an API address, or null for any other key
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

// Whether a query depends on NFT ownership or listings (lists, floors, volume, activity)
const isAffected = ({ queryKey }) => {
  if (queryKey[0] === "activity") return true;
  const path = keyUrl(queryKey)?.pathname ?? "";
  return ["/api/nfts", "/api/collections", "/api/activity"].some((p) => path.includes(p));
};

const sameValue = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
const isSynced = (server, patch) => !!server && Object.entries(patch).every(([k, v]) => sameValue(server[k], v));

// One loaded list with the NFT updated, added or removed
function patchList(list, url, nft, patch) {
  if (!Array.isArray(list)) return list;
  const index = list.findIndex((n) => String(n._id) === String(nft._id));
  const next = { ...(index >= 0 ? list[index] : nft), ...patch };
  const owner = url.searchParams.get("owner");

  let belongs;
  if (url.pathname.endsWith("/api/featurednft")) belongs = index >= 0 && next.isListed;
  else if (owner) belongs = sameValue(owner, next.ownerAddress);
  else if (url.searchParams.has("collectionId")) belongs = index >= 0;
  else belongs = next.isListed;

  if (index >= 0) return belongs ? list.map((n, i) => (i === index ? next : n)) : list.filter((_, i) => i !== index);
  return belongs ? [next, ...list] : list;
}

// After a confirmed trade: shows its result everywhere now, then refreshes once the API has it
export function useNftSync() {
  const queryClient = useQueryClient();

  return async function sync(detailKey, nft, patch) {
    const token = {};
    latest.set(detailKey[0], token);

    queryClient.invalidateQueries({ predicate: ({ queryKey: [key] }) => key === "balance" || key === "readContracts" });

    queryClient.setQueryData(detailKey, (old) => old && { ...old, ...patch });
    for (const query of queryClient.getQueryCache().findAll({ predicate: ({ queryKey }) => isList(keyUrl(queryKey)) })) {
      const url = keyUrl(query.queryKey);
      queryClient.setQueryData(query.queryKey, (list) => patchList(list, url, nft, patch));
    }

    const until = Date.now() + GIVE_UP_AFTER;
    while (Date.now() < until) {
      await sleep(POLL_INTERVAL);
      if (latest.get(detailKey[0]) !== token) return;
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
      }
    }

    if (latest.get(detailKey[0]) === token) latest.delete(detailKey[0]);
    queryClient.invalidateQueries({ predicate: isAffected, refetchType: "none" });
  };
}
