import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useCollections() {
  return useQuery({
    queryKey: [api.collections.list.path],
    queryFn: async () => {
      const res = await fetch(api.collections.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch collections");
      return api.collections.list.responses[200].parse(await res.json());
    },
  });
}

export function useCollection(slug: string) {
  return useQuery({
    queryKey: [api.collections.get.path, slug],
    queryFn: async () => {
      const url = buildUrl(api.collections.get.path, { slug });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Collection not found");
      return api.collections.get.responses[200].parse(await res.json());
    },
    enabled: !!slug,
  });
}
