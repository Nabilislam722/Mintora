import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertUser } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useUser(address: string | null) {
  return useQuery({
    queryKey: [api.users.get.path, address],
    queryFn: async () => {
      if (!address) return null;
      const url = buildUrl(api.users.get.path, { address });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return api.users.get.responses[200].parse(await res.json());
    },
    enabled: !!address,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await fetch(api.users.update.path, {
        method: api.users.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return api.users.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.users.get.path, data.walletAddress] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved.",
      });
    },
  });
}
