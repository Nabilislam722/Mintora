import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useBalance } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useLocation } from "wouter";
import NftCard from "../components/NftCard";
import { Button } from "@/components/ui/button";
import { Wallet, Copy, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "wouter";

export default function Profile() {
  const { address: urlAddress } = useParams();
  const { isConnected, address: walletAddress } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const address = urlAddress || walletAddress;
  const isOwnProfile = !urlAddress || urlAddress.toLowerCase() === walletAddress?.toLowerCase();
  const { data: balanceData } = useBalance({ address });
  const { data: dbUser } = useQuery({
    queryKey: [`/api/users/${address}`],
    queryFn: async () => {
      const res = await fetch(`/api/users/${address}`);
      if (!res.ok) return { username: "", bio: "", profileImageUrl: "", bannerImageUrl: "" };
      return res.json();
    },
    enabled: !!address,
  });



  const { data: nfts, isLoading: nftsLoading } = useQuery({
    queryKey: [`/api/nfts?owner=${address}`],
    queryFn: async () => {
      const res = await fetch(`/api/nfts?owner=${address}`);
      if (!res.ok) throw new Error("Failed to fetch NFTs");
      return res.json();
    },
    enabled: !!address,
  });

  const shortenAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast({ title: "Copied!", description: "Address copied to clipboard" });
    }
  };

  const avatarUrl = dbUser?.profileImageUrl || null;
  const bannerUrl = dbUser?.bannerImageUrl || null;

  if (!isConnected || !address) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto glass rounded-2xl border border-white/10 p-8">
          <Wallet className="w-16 h-16 text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-display font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-muted-foreground mb-6">
            Connect your wallet to view your NFT collection and manage your profile.
          </p>
          <Button onClick={openConnectModal} className="bg-primary hover:bg-primary/90 text-black font-semibold rounded-xl">
            <Wallet className="w-4 h-4 mr-2" /> Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Banner */}
      <div
        className="relative h-48 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: bannerUrl ? `url(${bannerUrl})` : "linear-gradient(to right,#22c55e33,#3b82f633)" }}
      >
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="container mx-auto px-4 -mt-16 relative z-10">
        <div className="flex flex-col md:flex-row gap-6 mb-8">

          {/* Avatar */}
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-background bg-card flex-shrink-0 shadow-xl">
            {avatarUrl
              ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-4xl font-display font-bold text-black">{address.slice(2, 4).toUpperCase()}</span>
              </div>
            }
          </div>

          {/* Info */}
          <div className="flex-1 pt-4 md:pt-20">
            <h1 className="text-3xl font-display font-bold mb-1">{dbUser?.username || "Unnamed User"}</h1>

            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <span className="font-mono bg-white/5 px-2 py-0.5 rounded text-sm">{shortenAddress(address)}</span>
              <button onClick={copyAddress} className="hover:text-white transition-colors p-1">
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {dbUser?.bio && (
              <p className="text-muted-foreground mb-6 max-w-2xl leading-relaxed">{dbUser.bio}</p>
            )}

            <div className="flex flex-wrap gap-4">
              <div className="glass rounded-xl px-4 py-3 border border-white/10 min-w-[120px]">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Balance</p>
                <p className="font-bold text-lg">
                  {balanceData ? parseFloat(balanceData.formatted).toFixed(4) : "0.0000"}
                  <span className="text-primary text-xs ml-1">ETH</span>
                </p>
              </div>
              <div className="glass rounded-xl px-4 py-3 border border-white/10 min-w-[120px]">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">NFTs Owned</p>
                <p className="font-bold text-lg">{nfts?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Edit button → goes to /settings */}
          {isOwnProfile && (
            <Button  
              className="bg-foreground/90 hover:bg-white/50 hover:text-black rounded-2xl h-11 self-start md:mt-24 transition-colors duration-300 ease-in-out"
              onClick={() => navigate("/settings")}
            >
              <Settings className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>

        <hr className="border-white/5 mb-10" />

        {/* NFT grid */}
        <div>
          <h2 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
            My Collection
            <span className="text-sm font-normal text-muted-foreground">({nfts?.length || 0})</span>
          </h2>

          {nftsLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : nfts?.length === 0 ? (
            <div className="glass rounded-2xl border border-white/10 p-16 text-center">
              <p className="text-muted-foreground mb-6 text-lg">Your gallery is empty</p>
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-border font-semibold rounded-2xl px-8">
                <a href="/collections">Start Exploring</a>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {nfts?.map(nft => <NftCard key={nft._id} nft={nft} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}