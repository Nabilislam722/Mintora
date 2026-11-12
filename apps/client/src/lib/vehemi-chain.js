import { formatUnits, zeroAddress } from "viem";
import { LISTED_EVENT, MARKET_ABI, OFFER_MADE_EVENT, VE_HEMI_ABI } from "./vehemi-abi.js";
import { MARKET_DEPLOY_BLOCK, VE_HEMI_CONTRACT, VE_HEMI_MARKET, sameAddress } from "./vehemi.js";

const LOG_SPAN = 1_000_000n;
const DAY = 864e5;
const ve = { address: VE_HEMI_CONTRACT, abi: VE_HEMI_ABI };
const market = { address: VE_HEMI_MARKET, abi: MARKET_ABI };
const toHemi = (wei) => Number(formatUnits(wei, 18));
const unique = (values) => [...new Set(values)];

// Every `event` the market has emitted matching `args`, read in spans from its deploy block
async function marketLogs(client, event, args) {
  const latest = await client.getBlockNumber();
  const spans = [];
  for (let from = MARKET_DEPLOY_BLOCK; from <= latest; from += LOG_SPAN) {
    const to = from + LOG_SPAN - 1n < latest ? from + LOG_SPAN - 1n : "latest";
    spans.push(client.getLogs({ address: VE_HEMI_MARKET, event, args, fromBlock: from, toBlock: to }));
  }
  return (await Promise.all(spans)).flat();
}

// Positions by token id, or null for ids that don't exist
async function readPositions(client, ids) {
  if (!ids.length) return [];
  const results = await client.multicall({
    contracts: ids.flatMap((id) => [
      { ...ve, functionName: "ownerOf", args: [id] },
      { ...ve, functionName: "getLockedBalance", args: [id] },
      { ...ve, functionName: "balanceOfNFT", args: [id] },
      { ...ve, functionName: "getUserPoint", args: [id, 1n] },
      { ...ve, functionName: "isTransferable", args: [id] },
    ]),
  });
  return ids.map((id, i) => {
    const [owner, lock, weight, firstPoint, transferable] = results.slice(i * 5, i * 5 + 5).map((r) => r.result);
    if (!owner || !lock) return null;
    const lockAmountWei = lock.amount > 0n ? lock.amount : 0n;
    const end = Number(lock.end) * 1000;
    const created = firstPoint ? Number(firstPoint.point.timestamp) * 1000 : end;
    return {
      id: Number(id),
      tokenId: id,
      owner,
      hemi: toHemi(lockAmountWei),
      lockAmountWei,
      weight: toHemi(weight ?? 0n),
      transferable: transferable ?? false,
      end,
      created,
      left: Math.max(0, Math.ceil((end - Date.now()) / DAY)),
      total: Math.max(0, Math.round((end - created) / DAY)),
    };
  });
}

const toListing = (l) => ({
  listingId: l.id,
  seller: l.seller,
  price: toHemi(l.price),
  priceWei: l.price,
  expiry: Number(l.expiry) * 1000,
  listedHemi: toHemi(l.lockAmount),
  listedLockAmountWei: l.lockAmount,
});

const blockTimes = new Map();

// Timestamps (ms) of these blocks, each fetched once since a block's time never changes
async function timesOf(client, blocks) {
  const missing = unique(blocks).filter((b) => !blockTimes.has(b));
  const fetched = await Promise.all(missing.map((blockNumber) => client.getBlock({ blockNumber }).catch(() => null)));
  fetched.forEach((block, i) => block && blockTimes.set(missing[i], Number(block.timestamp) * 1000));
  return blockTimes;
}

// Every listing that would fill right now, newest token ids first, with `listedAt` (ms) from its Listed event
export async function fetchListings(client) {
  const logs = await marketLogs(client, LISTED_EVENT);
  const ids = unique(logs.map((log) => log.args.tokenId));
  if (!ids.length) return [];
  const checks = await client.multicall({
    contracts: ids.flatMap((id) => [
      { ...market, functionName: "isListingValid", args: [id] },
      { ...market, functionName: "getListing", args: [id] },
    ]),
  });
  const live = ids
    .map((id, i) => ({ id, valid: checks[i * 2].result, listing: checks[i * 2 + 1].result }))
    .filter((x) => x.valid && x.listing);
  const listedIn = new Map(logs.map((log) => [log.args.listingId, log.blockNumber]));
  const blocks = live.map((x) => listedIn.get(x.listing.id)).filter((b) => b != null);
  const [positions, times] = await Promise.all([readPositions(client, live.map((x) => x.id)), timesOf(client, blocks)]);
  return live
    .map((x, i) => positions[i] && { ...positions[i], ...toListing(x.listing), listedAt: times.get(listedIn.get(x.listing.id)) ?? null })
    .filter(Boolean)
    .sort((a, b) => b.id - a.id);
}

// One position with its market state: `listing` only while it would fill, `storedListing` whatever is stored
export async function fetchPosition(client, tokenId) {
  const [[position], extra] = await Promise.all([
    readPositions(client, [tokenId]),
    client.multicall({
      contracts: [
        { ...ve, functionName: "getApproved", args: [tokenId] },
        { ...market, functionName: "isListingValid", args: [tokenId] },
        { ...market, functionName: "getListing", args: [tokenId] },
      ],
    }),
  ]);
  if (!position) return null;
  const [approved, valid, stored] = extra.map((r) => r.result);
  const storedListing = stored && stored.seller !== zeroAddress ? { ...position, ...toListing(stored) } : null;
  return {
    ...position,
    approved: sameAddress(approved, VE_HEMI_MARKET),
    listing: valid ? storedListing : null,
    storedListing,
  };
}

// Offers still stored for these token ids, best first, with whether each could be accepted now
export async function fetchOffers(client, tokenIds) {
  if (!tokenIds.length) return [];
  const logs = await marketLogs(client, OFFER_MADE_EVENT, { tokenId: tokenIds });
  const pairs = unique(logs.map((log) => `${log.args.tokenId}:${log.args.buyer}`)).map((key) => {
    const [tokenId, buyer] = key.split(":");
    return { tokenId: BigInt(tokenId), buyer };
  });
  if (!pairs.length) return [];
  const results = await client.multicall({
    contracts: pairs.flatMap(({ tokenId, buyer }) => [
      { ...market, functionName: "getOffer", args: [tokenId, buyer] },
      { ...market, functionName: "isOfferValid", args: [tokenId, buyer] },
    ]),
  });
  return pairs
    .map(({ tokenId, buyer }, i) => {
      const offer = results[i * 2].result;
      if (!offer || offer.id === 0n) return null;
      return {
        tokenId,
        id: Number(tokenId),
        buyer,
        offerId: offer.id,
        amount: toHemi(offer.amount),
        amountWei: offer.amount,
        expiry: Number(offer.expiry) * 1000,
        seller: offer.seller,
        maxLockEnd: Number(offer.maxLockEnd) * 1000,
        minLockAmountWei: offer.minLockAmount,
        valid: results[i * 2 + 1].result === true,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.amount - a.amount);
}

// HEMI that `buyer`'s other open offers can still pull
export async function openOffersTotal(client, buyer, excludeTokenId) {
  const ids = unique((await marketLogs(client, OFFER_MADE_EVENT, { buyer })).map((log) => log.args.tokenId)).filter(
    (id) => id !== excludeTokenId
  );
  if (!ids.length) return 0n;
  const [[nonce, ...offers], block] = await Promise.all([
    client
      .multicall({
        contracts: [
          { ...market, functionName: "nonces", args: [buyer] },
          ...ids.map((id) => ({ ...market, functionName: "getOffer", args: [id, buyer] })),
        ],
      })
      .then((results) => results.map((r) => r.result)),
    client.getBlock(),
  ]);
  const now = Number(block.timestamp);
  return offers.reduce(
    (sum, o) => (o && o.id !== 0n && Number(o.expiry) > now && o.nonce === nonce ? sum + o.amount : sum),
    0n
  );
}

// Every offer `buyer` still has stored, for the approvals panel
export async function fetchBuyerOffers(client, buyer) {
  const ids = unique((await marketLogs(client, OFFER_MADE_EVENT, { buyer })).map((log) => log.args.tokenId));
  if (!ids.length) return [];
  const [nonce, ...rest] = await client.multicall({
    contracts: [
      { ...market, functionName: "nonces", args: [buyer] },
      ...ids.flatMap((id) => [
        { ...market, functionName: "getOffer", args: [id, buyer] },
        { ...market, functionName: "isOfferValid", args: [id, buyer] },
        { ...ve, functionName: "ownerOf", args: [id] },
      ]),
    ],
  });
  return ids
    .map((id, i) => {
      const [offer, valid, holder] = rest.slice(i * 3, i * 3 + 3).map((r) => r.result);
      if (!offer || offer.id === 0n) return null;
      return {
        id: Number(id),
        tokenId: id,
        amountWei: offer.amount,
        amount: toHemi(offer.amount),
        expiry: Number(offer.expiry) * 1000,
        cancelled: offer.nonce !== nonce.result,
        acceptable: valid === true,
        moved: !holder || !sameAddress(holder, offer.seller),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.expiry - b.expiry);
}
