import { Search, Wallet, User, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Link } from "wouter";
import ThemeToggle from "./ThemeToggle";
import { ConnectButton } from "@rainbow-me/rainbowkit";


export default function Navbar({ onHoverRight }) {

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 dark:bg-background/50 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search collections, NFTs..."
              className="pl-10 bg-secondary/50 border-border focus:border-primary/50 rounded-xl"
              data-testid="input-search"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
           
          {/* Wallet Connection */}
          <div className="hidden md:flex items-center gap-6">
            <ConnectButton chainStatus="Hemi"/>
          </div> 
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <div className="w-20 h-20 rounded-lg flex items-center justify-center">
              <img src="./web-app-manifest-512x512.png" alt="logo"/>
            </div>
            <span className="font-display font-bold text-xl hidden sm:block">MINTORA</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
