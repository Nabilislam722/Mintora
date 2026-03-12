import { useQuery } from "@tanstack/react-query";
import CollectionCard from "../components/CollectionCard";
import { Input } from "@/components/ui/input";
import { Search, LayoutGrid } from "lucide-react";
import { useState } from "react";

export default function Collections() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: collections, isLoading } = useQuery({
    queryKey: ["/api/collections"],
  });

  const filteredCollections = collections?.filter((col) =>
    col.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pr-16">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-display font-bold">Collections</h1>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search collections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-secondary/50 border-white/10 focus:border-primary/50 rounded-xl"
            data-testid="input-search-collections"
          />
        </div>
      </div>

      {filteredCollections.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No collections found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCollections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      )}
    </div>
  );
}
