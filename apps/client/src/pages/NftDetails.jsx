import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAccount } from 'wagmi';
import { formatEther } from "viem";
import { ShoppingCart, CheckCircle2, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWeb3 } from "../lib/web3.jsx";
import { useToast } from "@/hooks/use-toast";

export default function NftDetails() {
  const { address, isConnected } = useAccount();
  const { buyItem, listItem, approveNft, cancelListing } = useWeb3();
  const { toast } = useToast();
  const { collectionId, tokenId } = useParams();
  const [priceError, setPriceError] = useState(false);
  const [listPrice, setListPrice] = useState("");

  const { data: nft, isLoading, refetch } = useQuery({
    queryKey: [`/api/nfts/${collectionId}/${tokenId}`],
    enabled: !!collectionId && !!tokenId,
  });

  const isOwner = address?.toLowerCase() === nft?.ownerAddress?.toLowerCase();

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const contractAddr = nft.collectionId?.contractAddress || nft.collection?.contractAddress;
      if (!contractAddr) throw new Error("Missing collection contract address.");
      return await buyItem(contractAddr, nft.tokenId, nft.price.toString(), true);
    },
    onSuccess: () => {
      toast({ title: "Purchase Successful!", description: "NFT is now yours." });
      setTimeout(() => refetch(), 3000);
    },
    onError: (err) => {
      toast({
        title: "Purchase Failed",
        description: err.message || "Transaction failed",
        variant: "destructive",
      });
    },
  });

  const listMutation = useMutation({
    mutationFn: async () => {
      if (!listPrice || parseFloat(listPrice) <= 0) {
        setPriceError(true);
        throw new Error("Must Enter a price");
      }

      setPriceError(false);
      const contractAddr = nft.collectionId?.contractAddress || nft.collection?.contractAddress;

      await approveNft(contractAddr, nft.tokenId);
      return await listItem(contractAddr, nft.tokenId, listPrice);
    },
    onSuccess: () => {
      toast({ title: "Successfully Listed!", description: "Your NFT is now on the market." });
      setListPrice("");
      setTimeout(() => refetch(), 3000);
    },
    onError: (err) => {
      toast({
        title: "Listing Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const contractAddr = nft.collectionId?.contractAddress || nft.collection?.contractAddress;
      if (!contractAddr) throw new Error("Missing collection contract address.");

      return await cancelListing(contractAddr, nft.tokenId);
    },
    onSuccess: () => {
      toast({ title: "Listing Canceled", description: "Your NFT is no longer on the market." });
      setTimeout(() => refetch(), 3000);
    },
    onError: (err) => {
      toast({
        title: "Cancellation Error",
        description: err.message || "Failed to cancel the listing.",
        variant: "destructive",
      });
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Visuals */}
        <div>
          <div className="rounded-2xl overflow-hidden bg-card border border-white/10 shadow-2xl">
            <img src={nft.imageUrl} alt={nft.name} className="w-full aspect-square object-cover" />
          </div>

          {nft.attributes?.length > 0 && (
            <div className="mt-6 glass rounded-xl border border-white/10 p-6">
              <h3 className="font-bold mb-4">Attributes</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {nft.attributes.map((attr, idx) => (
                  <div key={idx} className="bg-secondary/50 rounded-lg p-3 text-center border border-white/5">
                    <p className="text-[10px] text-muted-foreground uppercase">{attr.trait_type}</p>
                    <p className="font-semibold truncate text-sm">{attr.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col">
          {nft.collectionId && (
            <Link href={`/collections/${nft.collectionId.slug}`} className="flex items-center gap-2 text-primary hover:underline mb-2">
              <span className="text-sm font-medium">{nft.collectionId.name}</span>
              <CheckCircle2 className="w-4 h-4 fill-current" />
            </Link>
          )}

          <h1 className="text-4xl font-bold mb-2">{nft.name}</h1>
          <p className="text-muted-foreground mb-6 font-mono text-sm">Token ID: #{nft.tokenId}</p>

          <div className="glass rounded-2xl border border-white/10 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground text-sm uppercase tracking-widest">Price</span>
              <Badge className={nft.isListed ? "bg-green-500/20 text-green-400" : "bg-zinc-500/20 text-zinc-400"}>
                {nft.isListed ? "For Sale" : "Not Listed"}
              </Badge>
            </div>
            <div className="text-4xl font-bold">
              {nft.isListed ? `${formatEther(BigInt(nft.price))} ETH` : "—"}
            </div>
          </div>

          {/* Action Area */}
          <div className="space-y-4 mb-8">
            {!nft.isListed && isOwner ? (
              // 1. Owner & Not Listed -> Show Listing Form
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Enter listing price in ETH..."
                    value={listPrice}
                    onChange={(e) => {
                      setListPrice(e.target.value);
                      if (e.target.value) setPriceError(false);
                    }}
                    className={`h-14 bg-white/5 rounded-xl pl-4 pr-12 text-lg transition-all ${priceError ? "border-red-500 ring-1 ring-red-500" : "border-white/10"
                      }`}
                  />
                  <span className={`absolute right-4 top-1/2 -translate-y-1/2 font-bold ${priceError ? "text-red-500" : "text-muted-foreground"}`}>
                    ETH
                  </span>
                </div>

                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-black font-bold rounded-xl h-14 text-lg"
                  onClick={() => listMutation.mutate()}
                  disabled={listMutation.isPending}
                >
                  {listMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Tag className="w-5 h-5 mr-2" />}
                  {listMutation.isPending ? "Confirming..." : "List Now"}
                </Button>
              </div>
            ) : nft.isListed && isOwner ? (
              // 2. Owner & Listed -> Show Cancel Button
              <Button
                size="lg"
                variant="destructive"
                className="w-full font-bold rounded-xl h-14 text-lg hover:bg-red-700 transition-colors duration-200"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : "Cancel Listing"}
              </Button>
            ) : nft.isListed && !isOwner ? (
              // 3. Not Owner & Listed -> Show Buy Button
              <div className="flex gap-3">
                <Button
                  size="lg"
                  className="flex-1 bg-primary hover:bg-primary/90 text-black hover:text-primary-border transition-colors duration-300 ease-in-out rounded-xl h-14 text-lg"
                  onClick={() => purchaseMutation.mutate()}
                  disabled={purchaseMutation.isPending}
                >
                  {purchaseMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <ShoppingCart className="w-5 h-5 mr-2" />}
                  {purchaseMutation.isPending ? "Buying..." : "Buy Now"}
                </Button>
              </div>
            ) : (
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                <p className="text-muted-foreground">This NFT is not currently for sale.</p>
              </div>
            )}
          </div>

          <div className="glass rounded-xl border border-white/10 p-6">
            <h3 className="font-bold mb-4">Chain Info</h3>
            <div className="space-y-4">
              <DetailRow label="Contract" value={nft.collectionId?.contractAddress || "N/A"} isMono />
              <DetailRow label="Token ID" value={nft.tokenId} />
              <DetailRow label="Network" value="HEMI" />
              <DetailRow label="Owner" value={`${nft.ownerAddress.slice(0, 6)}...${nft.ownerAddress.slice(-4)}`} isMono />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, isMono }) {
  return (
    <div className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${isMono ? "font-mono text-xs text-primary" : "font-medium"}`}>{value}</span>
    </div>
  );
}