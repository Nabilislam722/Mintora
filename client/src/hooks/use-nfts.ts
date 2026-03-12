import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertNft } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

// Fetch all NFTs with optional filters
export function useNfts(filters?: { collectionId?: number; owner?: string; search?: string; limit?: number }) {
  const queryKey = [api.nfts.list.path, filters];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = buildUrl(api.nfts.list.path);
      // Construct query string manually since buildUrl only handles path params
      const params = new URLSearchParams();
      if (filters?.collectionId) params.append("collectionId", filters.collectionId.toString());
      if (filters?.owner) params.append("owner", filters.owner);
      if (filters?.search) params.append("search", filters.search);
      if (filters?.limit) params.append("limit", filters.limit.toString());
      
      const fullUrl = `${url}?${params.toString()}`;
      const res = await fetch(fullUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch NFTs");
      return api.nfts.list.responses[200].parse(await res.json());
    },
  });
}

// Fetch single NFT
export function useNft(id: number) {
  return useQuery({
    queryKey: [api.nfts.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.nfts.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("NFT not found");
      return api.nfts.get.responses[200].parse(await res.json());
    },
  });
}

// Create (Mint) NFT
export function useCreateNft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertNft) => {
      const res = await fetch(api.nfts.create.path, {
        method: api.nfts.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create NFT");
      }
      return api.nfts.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.nfts.list.path] });
      toast({
        title: "NFT Minted",
        description: "Your NFT has been successfully created!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Purchase NFT
export function usePurchaseNft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, buyerAddress }: { id: number; buyerAddress: string }) => {
      const url = buildUrl(api.nfts.purchase.path, { id });
      const res = await fetch(url, {
        method: api.nfts.purchase.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerAddress }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to purchase NFT");
      }
      return api.nfts.purchase.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.nfts.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.nfts.get.path] });
      toast({
        title: "Purchase Successful",
        description: "You now own this NFT!",
      });
    },
    onError: (error) => {
      toast({
        title: "Transaction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
