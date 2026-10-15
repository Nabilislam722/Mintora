import { useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Check, ChevronDown, Copy, LogOut, Settings, User } from "lucide-react";
import { FaEthereum } from "react-icons/fa";
import { useDismiss } from "@/hooks/use-dismiss";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { shortAddress } from "@/lib/nft";

const itemCls = "w-full flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium hover:bg-secondary transition-colors";

function Avatar({ user, address, className }) {
  return user?.profileImageUrl ? (
    <img src={user.profileImageUrl} alt="" className={`${className} rounded-full object-cover bg-secondary shrink-0`} />
  ) : (
    <span className={`${className} rounded-full bg-gradient-to-br from-primary to-accent shrink-0 flex items-center justify-center text-[10px] font-bold text-black`}>
      {address.slice(2, 4).toUpperCase()}
    </span>
  );
}

const fmtAmount = (n) =>
  n == null ? "—" : n === 0 ? "0" : n < 0.0001 ? "<0.0001" : n.toLocaleString(undefined, { maximumFractionDigits: n >= 1000 ? 2 : 4 });
const fmtUsd = (n) =>
  n == null ? "—" : n > 0 && n < 0.01 ? "<$0.01" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function TokenIcon({ symbol }) {
  if (symbol === "HEMI") return <img src="/hemi.svg" alt="" className="w-9 h-9 shrink-0" />;
  return (
    <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white ${symbol === "ETH" ? "bg-[#627EEA]" : "bg-[#2775CA]"}`}>
      {symbol === "ETH" ? <FaEthereum className="w-4 h-4" /> : <span className="text-sm font-bold">$</span>}
    </span>
  );
}

// Rendered only while the menu is open, so balances and prices are fetched on demand
function WalletBalances({ address }) {
  const { rows, total } = useWalletBalances(address);
  return (
    <div className="mx-1 my-1 rounded-xl border border-border/60 bg-secondary/30 p-3">
      <p className="text-xs text-muted-foreground">Total balance</p>
      <p className="text-2xl font-display font-bold tabular-nums mb-3">{fmtUsd(total)}</p>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.symbol} className="flex items-center gap-3">
            <TokenIcon symbol={r.symbol} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{r.symbol}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{r.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums leading-tight">{fmtAmount(r.amount)}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums leading-tight">{fmtUsd(r.usd)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Connected wallet shown as the user's profile (avatar + username) instead of RainbowKit's address pill
function ProfileMenu({ account }) {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));

  // Same key as the Profile and Settings pages, so profile edits show up here too
  const { data: user } = useQuery({
    queryKey: [`${BASE_URL}/api/users/${account.address}`],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/users/${account.address}`);
      if (!res.ok) return { username: "", bio: "", profileImageUrl: "", bannerImageUrl: "" };
      return res.json();
    },
  });

  const name = user?.username || account.displayName;

  const copy = () => {
    navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-10 pl-1.5 pr-2.5 rounded-xl border border-border/60 bg-secondary/50 hover:bg-secondary text-sm font-semibold transition-colors"
      >
        <Avatar user={user} address={account.address} className="w-7 h-7" />
        <span className="hidden sm:inline max-w-[9rem] truncate">{name}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-border bg-background p-2 text-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 origin-top-right"
        >
          <div className="flex items-center gap-4 px-3 py-3">
            <Avatar user={user} address={account.address} className="w-14 h-14" />
            <div className="min-w-0">
              <p className="text-lg font-display font-bold truncate">{name}</p>
              <p className="text-sm text-muted-foreground font-mono">{shortAddress(account.address)}</p>
            </div>
          </div>
          <WalletBalances address={account.address} />
          <div className="my-1.5 h-px bg-border/60" />
          <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className={itemCls}>
            <User className="w-5 h-5 text-muted-foreground" /> My profile
          </Link>
          <Link href="/settings" role="menuitem" onClick={() => setOpen(false)} className={itemCls}>
            <Settings className="w-5 h-5 text-muted-foreground" /> Edit profile
          </Link>
          <button type="button" role="menuitem" onClick={copy} className={itemCls}>
            {copied ? <Check className="w-5 h-5 text-primary" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
            {copied ? "Copied!" : "Copy address"}
            <span className="ml-auto font-mono text-sm text-muted-foreground">{shortAddress(account.address)}</span>
          </button>
          <div className="my-1.5 h-px bg-border/60" />
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); disconnect(); }}
            className={`${itemCls} text-destructive hover:bg-destructive/10`}
          >
            <LogOut className="w-5 h-5" /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export default function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <div className={mounted ? "flex items-center gap-3" : "opacity-0 pointer-events-none"} aria-hidden={!mounted}>
            {connected ? (
              <ProfileMenu account={account} />
            ) : (
              <button
                type="button"
                onClick={openConnectModal}
                className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
