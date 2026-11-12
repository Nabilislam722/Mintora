import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatEther, parseEther } from "viem";
import { AlertTriangle, ExternalLink, Info, Loader2, Pencil, ShoppingCart, Tag, Wallet, X } from "lucide-react";
import { useWeb3, MARKETPLACE_CONTRACT, listingState, listingStateReads } from "../lib/web3.jsx";
import { useToast } from "@/hooks/use-toast";
import { useEthPrice } from "@/hooks/use-token-prices";
import { useNftSync } from "@/hooks/use-nft-sync";
import ResilientNftImage from "@/components/ResilientNftImage";
import { VerifiedBadge } from "@/components/CollectionCard";
import { hemi } from "@/lib/hemi";
import { formatEth, shortAddress } from "@/lib/nft";
import { useSeo } from "@/hooks/use-seo";
import { NOT_FOUND_SEO, nftSeo } from "@/lib/seo";
import { isNotFoundError } from "@/lib/queryClient";

const FEE_ABI = [{ name: "marketplaceFee", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }];
const DEFAULT_FEE_BPS = 500;

const panelCls = "rounded-2xl border border-border/50 bg-card p-5";
const primaryBtn =
  "w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50";

const toUsd = (wei, ethPrice) =>
  ethPrice ? (Number(formatEther(wei)) * ethPrice).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }) : null;

// Wei from what the user typed, or null while it isn't a positive number
const parsePrice = (value) => {
  try {
    const wei = parseEther(value || "0");
    return wei > 0n ? wei : null;
  } catch {
    return null;
  }
};

// Price → marketplace fee → what the seller gets
function SaleBreakdown({ priceWei, feeBps, ethPrice, priceLabel = "Listing price" }) {
  const feeWei = priceWei != null ? (priceWei * BigInt(feeBps)) / 10000n : null;
  const receiveWei = priceWei != null ? priceWei - feeWei : null;
  const rows = [
    [priceLabel, priceWei],
    [`Marketplace fee (${feeBps / 100}%)`, feeWei, true],
  ];
  return (
    <div className="rounded-xl bg-secondary/40 border border-white/5 text-sm">
      <div className="divide-y divide-white/5">
        {rows.map(([label, wei, negative]) => (
          <div key={label} className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums">{wei != null ? `${negative ? "−" : ""}${formatEth(wei, 6)} ETH` : "—"}</span>
          </div>
        ))}
        <div className="flex justify-between items-baseline px-3 py-2.5">
          <span className="font-medium">You receive</span>
          <span className="text-right">
            <span className="font-semibold tabular-nums">{receiveWei != null ? `${formatEth(receiveWei, 6)} ETH` : "—"}</span>
            {receiveWei != null && toUsd(receiveWei, ethPrice) && (
              <span className="block text-[11px] text-muted-foreground tabular-nums">≈ {toUsd(receiveWei, ethPrice)}</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function PriceInput({ value, onChange, error, ethPrice, autoFocus }) {
  const wei = parsePrice(value);
  return (
    <div>
      <div className="relative">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          autoFocus={autoFocus}
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-12 rounded-xl bg-secondary/50 border outline-none pl-4 pr-14 text-lg font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
            error ? "border-destructive" : "border-white/10 focus:border-primary/50"
          }`}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">ETH</span>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">{wei && toUsd(wei, ethPrice) ? `≈ ${toUsd(wei, ethPrice)}` : " "}</p>
    </div>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right min-w-0 truncate">{children}</span>
    </div>
  );
}

export default function NftDetails() {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { buyItem, listItem, cancelListing, updateListing } = useWeb3();
  const { toast } = useToast();
  const ethPrice = useEthPrice();
  const { collectionId, tokenId } = useParams();
  const [priceError, setPriceError] = useState(false);
  const [listPrice, setListPrice] = useState("");
  const [editing, setEditing] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [listStep, setListStep] = useState(null);
  const syncNft = useNftSync();

  const queryKey = [`${BASE_URL}/api/nfts/${collectionId}/${tokenId}`];

  const { data: nft, isLoading, error: nftError } = useQuery({
    queryKey,
    enabled: !!collectionId && !!tokenId,
  });

  useSeo(nft ? nftSeo(nft, collectionId) : isNotFoundError(nftError) ? NOT_FOUND_SEO : null);

  const { data: feeData } = useReadContract({ address: MARKETPLACE_CONTRACT, abi: FEE_ABI, functionName: "marketplaceFee", chainId: hemi.id });
  const feeBps = feeData != null ? Number(feeData) : DEFAULT_FEE_BPS;

  const isOwner = address?.toLowerCase() === nft?.ownerAddress?.toLowerCase();
  const contractAddr = nft?.collectionId?.contractAddress || nft?.collection?.contractAddress;

  const shownListed = !!nft?.isListed && !!nft?.price && nft.price !== "0";
  const { data: listingReads } = useReadContracts({
    contracts: contractAddr && address && nft ? listingStateReads(contractAddr, nft.tokenId, address) : [],
    query: { enabled: !!contractAddr && !!nft && isOwner && !shownListed },
  });
  const oldListing = isOwner && !shownListed ? listingState(listingReads, address) : { oldPrice: 0n, approved: false };

  // Shows the trade's result now, then refreshes once the API has recorded it
  const patchAndSync = (patch) => syncNft(queryKey, nft, patch);

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (!contractAddr) throw new Error("Missing collection contract address.");
      return await buyItem(contractAddr, nft.tokenId, nft.price.toString(), true);
    },
    onSuccess: () => {
      toast({ title: "Purchase Successful!", description: "NFT is now yours." });
      patchAndSync({ isListed: false, price: "0", ownerAddress: address.toLowerCase() });
    },
    onError: (err) => {
      toast({ title: "Purchase Failed", description: err.message || "Transaction failed", variant: "destructive" });
    },
  });

  const listMutation = useMutation({
    mutationFn: async () => {
      if (!parsePrice(listPrice)) {
        setPriceError(true);
        throw new Error("Must enter a price");
      }
      setPriceError(false);
      if (!contractAddr) throw new Error("Missing collection contract address.");
      return await listItem(contractAddr, nft.tokenId, listPrice, setListStep);
    },
    onSettled: () => setListStep(null),
    onSuccess: () => {
      toast({ title: "Successfully Listed!", description: "Your NFT is now on the market." });
      patchAndSync({ isListed: true, price: parseEther(listPrice).toString() });
      setListPrice("");
    },
    onError: (err) => {
      toast({ title: "Listing Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!parsePrice(newPrice)) throw new Error("Must enter a price");
      return await updateListing(contractAddr, nft.tokenId, newPrice);
    },
    onSuccess: () => {
      toast({ title: "Price Updated", description: "Your listing has the new price." });
      patchAndSync({ isListed: true, price: parseEther(newPrice).toString() });
      setEditing(false);
      setNewPrice("");
    },
    onError: (err) => {
      toast({ title: "Update Error", description: err.message || "Failed to update the price.", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!contractAddr) throw new Error("Missing collection contract address.");
      return await cancelListing(contractAddr, nft.tokenId);
    },
    onSuccess: () => {
      toast({ title: "Listing Canceled", description: "Your NFT is no longer on the market." });
      patchAndSync({ isListed: false, price: "0" });
    },
    onError: (err) => {
      toast({ title: "Cancellation Error", description: err.message || "Failed to cancel the listing.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">NFT Not Found</h1>
      </div>
    );
  }

  const collection = nft.collectionId;
  const listed = nft.isListed && !!nft.price && nft.price !== "0";
  const priceWei = listed ? BigInt(nft.price) : null;
  const royaltyNote = "Creator royalties, if the collection sets any, are also deducted when it sells.";

  let action;
  if (listed && !isOwner) {
    action = (
      <>
        <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5 text-sm">
          <div className="flex justify-between items-baseline px-3 py-2.5">
            <span className="font-medium">You pay</span>
            <span className="text-right">
              <span className="font-semibold tabular-nums">{formatEth(priceWei, 6)} ETH</span>
              {toUsd(priceWei, ethPrice) && <span className="block text-[11px] text-muted-foreground tabular-nums">≈ {toUsd(priceWei, ethPrice)}</span>}
            </span>
          </div>
        </div>
        {isConnected ? (
          <button type="button" className={primaryBtn} onClick={() => purchaseMutation.mutate()} disabled={purchaseMutation.isPending}>
            {purchaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            {purchaseMutation.isPending ? "Confirm in wallet…" : "Buy now"}
          </button>
        ) : (
          <button type="button" className={primaryBtn} onClick={openConnectModal}>
            <Wallet className="w-4 h-4" /> Connect wallet to buy
          </button>
        )}
        <p className="flex gap-2 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          You pay the listed price plus network gas. The NFT is transferred to your wallet in the same transaction.
        </p>
      </>
    );
  } else if (!listed && isOwner) {
    action = (
      <>
        {oldListing.oldPrice > 0n && (
          <div
            className={`flex gap-2.5 rounded-xl border px-3.5 py-3 text-xs ${
              oldListing.approved
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">An old listing of yours is still stored: {formatEth(oldListing.oldPrice, 6)} ETH</p>
              <p className="mt-0.5 opacity-90">
                {oldListing.approved
                  ? "The marketplace is approved for this NFT, so anyone can buy it at that price right now."
                  : "It would sell at that price as soon as the marketplace is approved for this NFT."}{" "}
                Listing below replaces it safely, or you can cancel it now.
              </p>
              <button
                type="button"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending || listMutation.isPending}
                className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-background/60 font-semibold hover:bg-background disabled:opacity-50 transition-colors"
              >
                {cancelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                {cancelMutation.isPending ? "Confirm in wallet…" : "Cancel old listing"}
              </button>
            </div>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Set a price</label>
          <div className="mt-1.5">
            <PriceInput
              value={listPrice}
              onChange={(v) => {
                setListPrice(v);
                if (v) setPriceError(false);
              }}
              error={priceError}
              ethPrice={ethPrice}
            />
          </div>
        </div>
        <SaleBreakdown priceWei={parsePrice(listPrice)} feeBps={feeBps} ethPrice={ethPrice} />
        <button type="button" className={primaryBtn} onClick={() => listMutation.mutate()} disabled={listMutation.isPending || cancelMutation.isPending}>
          {listMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
          {listMutation.isPending ? (listStep ? `${listStep}: confirm in wallet` : "Checking the marketplace…") : "List for sale"}
        </button>
        <p className="flex gap-2 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>
            Approve the marketplace for this NFT (skipped if it already is), then create the listing. If an old listing of
            yours is still stored for it, it's replaced first, so it can never sell at its old price. {royaltyNote}
          </span>
        </p>
      </>
    );
  } else if (listed && isOwner) {
    action = editing ? (
      <>
        <div>
          <label className="text-xs text-muted-foreground">New price</label>
          <div className="mt-1.5">
            <PriceInput value={newPrice} onChange={setNewPrice} ethPrice={ethPrice} autoFocus />
          </div>
        </div>
        <SaleBreakdown priceWei={parsePrice(newPrice)} feeBps={feeBps} ethPrice={ethPrice} priceLabel="New price" />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setEditing(false); setNewPrice(""); }}
            className="h-12 rounded-xl border border-white/10 bg-secondary/50 hover:bg-secondary text-sm font-semibold transition-colors"
          >
            Back
          </button>
          <button type="button" className={primaryBtn} onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !parsePrice(newPrice)}>
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {updateMutation.isPending ? "Confirm in wallet…" : "Update price"}
          </button>
        </div>
      </>
    ) : (
      <>
        <p className="text-xs text-muted-foreground">When it sells</p>
        <SaleBreakdown priceWei={priceWei} feeBps={feeBps} ethPrice={ethPrice} />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setEditing(true); setNewPrice(formatEther(priceWei)); }}
            className="h-12 rounded-xl border border-white/10 bg-secondary/50 hover:bg-secondary text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Pencil className="w-4 h-4" /> Change price
          </button>
          <button
            type="button"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="h-12 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            {cancelMutation.isPending ? "Confirm…" : "Cancel listing"}
          </button>
        </div>
        <p className="flex gap-2 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          {royaltyNote}
        </p>
      </>
    );
  } else {
    action = (
      <div className="rounded-xl bg-secondary/40 border border-white/5 p-4 text-center text-sm text-muted-foreground">
        This NFT isn't listed for sale right now.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:pr-12">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        <div className="lg:sticky lg:top-24 min-w-0">
          <div className="w-fit max-w-full mx-auto rounded-2xl overflow-hidden border border-border/50 bg-card shadow-2xl">
            <ResilientNftImage
              src={nft.imageUrl}
              alt={nft.name}
              loading="eager"
              className="block w-auto h-auto max-w-full max-h-[80vh] min-w-[min(24rem,85vw)] object-contain"
            />
          </div>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <div>
            {collection && (
              <Link href={`/collections/${collection.slug}`} className="inline-flex items-center gap-2 mb-3 text-sm font-semibold text-primary hover:underline">
                {collection.logoUrl && <img src={collection.logoUrl} alt="" className="w-6 h-6 rounded-md object-cover" />}
                {collection.name}
                <VerifiedBadge verified={collection.isVerified} />
              </Link>
            )}
            <h1 className="text-3xl sm:text-4xl font-display font-bold leading-tight break-words">{nft.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="px-2 py-0.5 rounded-md bg-secondary/60 border border-white/5 font-mono text-xs text-foreground">#{nft.tokenId}</span>
              <span>
                Owned by{" "}
                <Link href={`/profile/${nft.ownerAddress}`} className="font-medium text-foreground hover:text-primary">
                  {isOwner ? "you" : shortAddress(nft.ownerAddress)}
                </Link>
              </span>
            </div>
          </div>

          <section className={`${panelCls} flex flex-col gap-4`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{listed ? "Current price" : "Price"}</p>
                {listed ? (
                  <>
                    <p className="text-3xl font-display font-bold tabular-nums">
                      {formatEth(priceWei, 6)} <span className="text-base font-normal text-muted-foreground">ETH</span>
                    </p>
                    {toUsd(priceWei, ethPrice) && <p className="text-sm text-muted-foreground tabular-nums">≈ {toUsd(priceWei, ethPrice)}</p>}
                  </>
                ) : (
                  <p className="text-3xl font-display font-bold text-muted-foreground">—</p>
                )}
              </div>
              <span
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  listed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-secondary/60 text-muted-foreground border-white/10"
                }`}
              >
                {listed ? "For sale" : "Not listed"}
              </span>
            </div>
            {action}
          </section>

          {nft.description && (
            <section className={panelCls}>
              <h2 className="font-display font-bold mb-2">Description</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{nft.description}</p>
            </section>
          )}

          {nft.attributes?.length > 0 && (
            <section className={panelCls}>
              <h2 className="font-display font-bold mb-3">
                Traits <span className="ml-1 text-sm font-normal text-muted-foreground">{nft.attributes.length}</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {nft.attributes.map((attr, idx) => (
                  <div key={idx} className="rounded-xl bg-secondary/40 border border-white/5 px-3 py-2.5 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{attr.trait_type}</p>
                    <p className="text-sm font-semibold truncate">{attr.value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={panelCls}>
            <h2 className="font-display font-bold mb-3">Details</h2>
            <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5">
              <DetailRow label="Contract">
                {contractAddr ? (
                  <a
                    href={`https://explorer.hemi.xyz/token/${contractAddr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                  >
                    {shortAddress(contractAddr)} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="Token ID">#{nft.tokenId}</DetailRow>
              <DetailRow label="Token standard">ERC-721</DetailRow>
              <DetailRow label="Network">Hemi</DetailRow>
              <DetailRow label="Marketplace fee">{feeBps / 100}%</DetailRow>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
