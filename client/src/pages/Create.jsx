import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Wallet, ImagePlus, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function Create() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [form, setForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    price: "",
    collectionId: "",
  });

  const { data: collections } = useQuery({
    queryKey: ["/api/collections"],
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/nfts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          collectionId: Number(data.collectionId),
          tokenId: Math.floor(Math.random() * 100000).toString(),
          ownerAddress: address,
          isListed: !!data.price,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (nft) => {
      toast({
        title: "NFT Created!",
        description: "Your NFT has been minted successfully.",
      });
      navigate(`/nfts/${nft.id}`);
    },
    onError: (err) => {
      toast({
        title: "Creation Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.imageUrl || !form.collectionId) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(form);
  };

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto glass rounded-2xl border border-white/10 p-8">
          <Wallet className="w-16 h-16 text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-display font-bold mb-4">Connect to Create</h1>
          <p className="text-muted-foreground mb-6">
            Connect your wallet to mint and list your own NFTs.
          </p>
          <Button
            onClick={connect}
            className="bg-primary hover:bg-primary/90 text-black font-semibold rounded-xl"
            data-testid="button-connect-create"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl pr-16">
      <div className="flex items-center gap-2 mb-8">
        <Sparkles className="w-6 h-6 text-primary" />
        <h1 className="text-3xl font-display font-bold">Create NFT</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass rounded-2xl border border-white/10 p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="imageUrl">Image URL *</Label>
              <div className="mt-2 relative">
                <ImagePlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="imageUrl"
                  placeholder="https://example.com/image.png"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="pl-10 bg-secondary/50 border-white/10 focus:border-primary/50 rounded-xl"
                  data-testid="input-image-url"
                />
              </div>
              {form.imageUrl && (
                <div className="mt-4 rounded-xl overflow-hidden border border-white/10">
                  <img src={form.imageUrl} alt="Preview" className="w-full aspect-square object-cover" />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="My Amazing NFT"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-2 bg-secondary/50 border-white/10 focus:border-primary/50 rounded-xl"
                data-testid="input-name"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Tell the story behind your NFT..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-2 bg-secondary/50 border-white/10 focus:border-primary/50 rounded-xl min-h-[100px]"
                data-testid="input-description"
              />
            </div>

            <div>
              <Label htmlFor="collection">Collection *</Label>
              <Select
                value={form.collectionId}
                onValueChange={(value) => setForm({ ...form, collectionId: value })}
              >
                <SelectTrigger className="mt-2 bg-secondary/50 border-white/10 focus:border-primary/50 rounded-xl" data-testid="select-collection">
                  <SelectValue placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections?.map((col) => (
                    <SelectItem key={col.id} value={col.id.toString()}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="price">Price (RON)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="mt-2 bg-secondary/50 border-white/10 focus:border-primary/50 rounded-xl"
                data-testid="input-price"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to create without listing for sale
              </p>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full bg-primary hover:bg-primary/90 text-black font-semibold rounded-xl h-12"
          disabled={createMutation.isPending}
          data-testid="button-create-nft"
        >
          {createMutation.isPending ? "Creating..." : "Create NFT"}
        </Button>
      </form>
    </div>
  );
}
