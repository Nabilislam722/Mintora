import { Search, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import ThemeToggle from "./ThemeToggle";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther } from "viem";
import { useLayoutPreferences } from "../context/LayoutPreferencesContext";
import { navItems } from "../lib/navItems";

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0" data-testid="link-home">
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center">
        <img src="/logo.png" alt="logo" className="block dark:hidden" />
        <img src="/logo-white.png" alt="logo" className="hidden dark:block" />
      </div>
      <span className="font-sans font-bold text-xl hidden sm:block">MINTORA</span>
    </Link>
  );
}

function MobileNavIcons() {
  const [location] = useLocation();
  return (
    <div className="flex md:hidden flex-wrap items-center justify-center gap-1 px-3 py-2 border-t border-border/50">
      {navItems.map((item) => {
        const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
        const Icon = isActive && item.iconFilled ? item.iconFilled : item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 min-w-[64px] transition-colors ${isActive ? "bg-secondary text-primary" : "text-muted-foreground"
              }`}
            data-testid={`link-mobilenav-${item.label.toLowerCase()}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default function Navbar() {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const wrapRef = useRef(null);
  const mobileInputRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);
  const [, navigate] = useLocation();
  const { logoPosition } = useLayoutPreferences();
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults(null); return; }
    setLoading(true);
    fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then(data => { setResults(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [debouncedQuery]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (mobileSearchOpen) mobileInputRef.current?.focus();
  }, [mobileSearchOpen]);

  const clear = () => { setQuery(""); setResults(null); setOpen(false); };
  const closeMobileSearch = () => { clear(); setMobileSearchOpen(false); };
  const hasResults = results && (results.nfts.length > 0 || results.collections.length > 0);

  const resultsDropdown = (
    <div className="absolute top-full mt-2 left-0 right-0 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden z-10">
      {loading && <p className="text-xs text-muted-foreground px-4 py-3">Searching…</p>}
      {!loading && !hasResults && <p className="text-xs text-muted-foreground px-4 py-3">No results for "{query}"</p>}

      {results?.collections.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-4 pt-3 pb-1 font-semibold">Collections</p>
          {results.collections.map(col => (
            <Link key={col._id} href={`/collections/${col.slug}`} onClick={closeMobileSearch}>
              <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors cursor-pointer">
                <img src={col.logoUrl} alt={col.name} className="w-8 h-8 rounded-lg object-cover bg-secondary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{col.name}</p>
                  <p className="text-xs text-muted-foreground">Floor: {col.floorPrice ? `${col.floorPrice} ETH` : "—"}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {results?.users?.length > 0 && (
        <div className={results?.collections.length > 0 ? "border-t border-border" : ""}>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-4 pt-3 pb-1 font-semibold">Users</p>
          {results.users.map(user => (
            <Link key={user._id} href={`/profile/${user.walletAddress}`} onClick={closeMobileSearch}>
              <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors cursor-pointer">
                {user.profileImageUrl
                  ? <img src={user.profileImageUrl} className="w-8 h-8 rounded-full object-cover shrink-0" />
                  : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-black">{user.walletAddress.slice(2, 4).toUpperCase()}</span>
                  </div>
                }
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user.username || "Unnamed User"}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {user.walletAddress.slice(0, 6)}…{user.walletAddress.slice(-4)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {results?.nfts.length > 0 && (
        <div className={results?.collections.length > 0 ? "border-t border-border" : ""}>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-4 pt-3 pb-1 font-semibold">NFTs</p>
          {results.nfts.map(nft => (
            <Link key={nft._id} href={`/nfts/${nft.collectionId?._id}/${nft.tokenId}`} onClick={closeMobileSearch}>
              <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors cursor-pointer">
                <img src={nft.imageUrl} alt={nft.name} className="w-8 h-8 rounded-lg object-cover bg-secondary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{nft.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{nft.collectionId?.name}</p>
                </div>
                <p className="text-xs font-mono text-primary shrink-0">
                  {nft.price && nft.price !== "0" ? `${formatEther(BigInt(nft.price))} ETH` : "Unlisted"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 dark:bg-background/50 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {logoPosition === "left" && <Logo />}

        {/* Desktop search — hidden on mobile */}
        <div ref={wrapRef} className="hidden md:block flex-1 max-w-xl relative">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 bg-secondary/60
              ${focused
                ? "ring-1 ring-white/30 shadow-[0_0_0_5px_rgba(255,255,255,0.04)] bg-secondary/80"
                : "ring-1 ring-white/[0.06] hover:ring-white/10"
              }`}
          >
            <Search className={`w-4 h-4 shrink-0 transition-colors duration-200 ${focused ? "text-foreground/70" : "text-muted-foreground"}`} />
            <input
              type="search"
              placeholder="Search collections, NFTs, users…"
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => { setFocused(true); if (query.length >= 2) setOpen(true); }}
              onBlur={() => setFocused(false)}
              className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
              data-testid="input-search"
            />
          </div>
          {open && query.length >= 2 && resultsDropdown}
        </div>

        {/* Mobile spacer so right-side items sit at the edge when search is hidden */}
        <div className="flex-1 md:hidden" />

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-5">
          <button
            type="button"
            className="md:hidden p-2 -mr-1 rounded-full hover:bg-secondary/60 transition-colors"
            onClick={() => setMobileSearchOpen(v => !v)}
            aria-label="Toggle search"
          >
            <Search className="w-5 h-5 text-muted-foreground" />
          </button>

          <ThemeToggle />

          <ConnectButton
            chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
            accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            showBalance={{ smallScreen: false, largeScreen: true }}
          />

          {logoPosition !== "left" && <Logo />}
        </div>
      </div>

      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 px-4 pb-3 pt-2 bg-background/95 backdrop-blur-md border-b border-border/50">
          <div className="relative">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/60 ring-1 ring-white/10">
              <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
              <input
                ref={mobileInputRef}
                type="search"
                placeholder="Search collections, NFTs, users…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
                data-testid="input-search-mobile"
              />
              <button type="button" onClick={closeMobileSearch} aria-label="Close search">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {query.length >= 2 && resultsDropdown}
          </div>
        </div>
      )}

      {/* Mobile icon row — replaces the hover sidebar on small screens */}
      <MobileNavIcons />
    </nav>
  );
}