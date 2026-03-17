import { Search } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import ThemeToggle from "./ThemeToggle";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Navbar() {
  const [focused, setFocused] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 dark:bg-background/50 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">

        <div className="flex-1 max-w-xl">
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
              placeholder="Search Collection, Nfts, Users..."
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
              data-testid="input-search"
            />
          </div>
        </div>

        <div className="flex items-center gap-5">
          <ThemeToggle />

          <div className="hidden md:flex items-center gap-6">
            <ConnectButton chainStatus="Hemi" />
          </div>

          <Link href="/" className="flex items-center gap-2 ml-3" data-testid="link-home">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center">
              <img src="./web-app-manifest-512x512.png" alt="logo" />
            </div>
            <span className="font-sans font-bold text-xl hidden sm:block">MINTORA</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}