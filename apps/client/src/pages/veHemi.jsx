import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Clock, Search, X, CheckCircle2, Loader2, Wallet, Plus, TrendingDown } from "lucide-react";
import hemiLogo from "/hemi.svg";
import { CiFilter } from "react-icons/ci";

const HEMI_USD = 0.05;

const MOCK = [
  [1042, 250000, 1460, 612, 168000], [877, 40000, 730, 95, 36800], [2310, 1200000, 1460, 1390, 640000],
  [1503, 85000, 365, 40, 80100], [388, 500000, 1095, 880, 301000], [2951, 15000, 180, 150, 11200],
  [1199, 320000, 730, 330, 241000], [640, 72000, 1460, 1020, 40500], [3077, 910000, 1095, 120, 842000],
  [1764, 28000, 365, 290, 21900], [455, 160000, 1460, 1180, 92000], [2208, 60000, 730, 640, 41000],
].map(([id, hemi, total, left, price]) => ({ id, hemi, total, left, price }));

const LOCK_FILTERS = [
  { id: "short", label: "< 3 months", test: (d) => d < 90 },
  { id: "mid", label: "3–12 months", test: (d) => d >= 90 && d <= 365 },
  { id: "long", label: "> 1 year", test: (d) => d > 365 },
];

const SORTS = {
  priceAsc: { label: "Price: low to high", fn: (a, b) => a.price - b.price },
  discount: { label: "Biggest discount", fn: (a, b) => b.hemi / b.price - a.hemi / a.price },
  unlock: { label: "Unlocks soonest", fn: (a, b) => a.left - b.left },
  amount: { label: "Most HEMI locked", fn: (a, b) => b.hemi - a.hemi },
};

const inputCls = "h-9 rounded-3xl bg-secondary/50 border border-white/10 focus:border-primary/50 outline-none text-sm px-3";

const fmt = (n, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const discountOf = (l) => Math.round((1 - l.price / l.hemi) * 100);
const unlockDate = (days) =>
  new Date(Date.now() + days * 864e5).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const timeLeft = (d) => (d >= 365 ? `${(d / 365).toFixed(1)} yrs` : d >= 60 ? `${Math.round(d / 30)} mo` : `${d} days`);

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex p-0.5 rounded-full bg-secondary/50 border border-white/10">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${
            value === o ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function ListingFilters({ lock, onLockChange, minHemi, onMinHemiChange }) {
  const [open, setOpen] = useState(false);
  const active = lock !== null || minHemi !== "";

  return (
    <div className="flex flex-wrap items-center gap-10 lg:flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle filters"
        aria-expanded={open}
        className={`relative h-9 w-9 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
          open || active
            ? "bg-primary/10 text-primary border-primary/40"
            : "bg-secondary/50 text-muted-foreground border-white/10 hover:text-foreground"
        }`}
      >
        <CiFilter className="w-5 h-5" />
        {active && !open && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="filter-options"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8, transition: { duration: 0.1 } }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              value={minHemi}
              onChange={(e) => onMinHemiChange(e.target.value)}
              type="number"
              min="0"
              placeholder="Min HEMI locked"
              className={`${inputCls} w-44 placeholder:text-muted-foreground/50 border-muted-foreground/10`}
            />
            {LOCK_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onLockChange(lock === f.id ? null : f.id)}
                aria-pressed={lock === f.id}
                className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                  lock === f.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-white/10 hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Price({ listing, currency, className = "" }) {
  const usdc = currency === "USDC";
  const value = usdc ? listing.price * HEMI_USD : listing.price;
  return (
    <span className={`font-semibold tabular-nums ${className}`}>
      {fmt(value)} <span className="text-xs font-normal text-muted-foreground">{currency}</span>
    </span>
  );
}

function ListingCard({ listing, currency, onBuy }) {
  const pct = discountOf(listing);
  const progress = Math.max(0, Math.min(100, (listing.left / listing.total) * 100));
  return (
    <div className="group rounded-2xl border border-border/50 bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl">
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <img src={hemiLogo} alt="hemi"/>
          </div>
          <span className="font-display font-bold text-sm">veHEMI #{listing.id}</span>
        </div>
        {pct > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingDown className="w-3 h-3" /> {pct}% off
          </span>
        )}
      </div>


      <p className="text-2xl font-display font-bold tabular-nums mb-3">
        {fmt(listing.hemi)} <span className="text-sm font-normal text-muted-foreground">HEMI</span>
      </p>

      <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-2">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {timeLeft(listing.left)} left</span>
        <span>Unlocks {unlockDate(listing.left)}</span>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-secondary/40 border border-white/5 px-3 py-2.5">
        <div>
          <p className="text-[11px] text-muted-foreground">Price</p>
          <Price listing={listing} currency={currency} className="text-sm" />
        </div>
        <button
          type="button"
          onClick={() => onBuy(listing)}
          className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
        >
          Buy
        </button>
      </div>
    </div>
  );
}

function BuyDialog({ listing, initialCurrency, onClose }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [currency, setCurrency] = useState(initialCurrency);
  const [step, setStep] = useState("approve"); // approve -> buy -> done
  const [busy, setBusy] = useState(false);

  // TODO: wire to wagmi — approve(USDC | HEMI) on the marketplace, then buy(tokenId)
  const run = (next) => {
    setBusy(true);
    setTimeout(() => { setBusy(false); setStep(next); }, 1400);
  };
  const onAction = () => {
    if (!isConnected) return openConnectModal?.();
    step === "approve" ? run("buy") : run("done");
  };

  const rows = [
    ["Locked", `${fmt(listing.hemi)} HEMI`],
    ["Unlocks", unlockDate(listing.left)],
    ["Discount to locked value", `${discountOf(listing)}%`],
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold">Buy veHEMI #{listing.id}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "done" ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="font-bold mb-1">Purchase complete</p>
            <p className="text-xs text-muted-foreground mb-5">veHEMI #{listing.id} is now in your wallet.</p>
            <button type="button" onClick={onClose} className="h-10 px-6 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/70">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Pay with</span>
              <Segmented value={currency} onChange={setCurrency} options={["USDC", "HEMI"]} />
            </div>
            <div className="rounded-xl bg-secondary/40 border border-white/5 divide-y divide-white/5 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
                </div>
              ))}
              <div className="flex justify-between items-baseline px-3 py-3">
                <span className="text-muted-foreground">Total</span>
                <Price listing={listing} currency={currency} className="text-lg" />
              </div>
            </div>
            <button
              type="button"
              onClick={onAction}
              disabled={busy}
              className="w-full h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : !isConnected ? <Wallet className="w-3.5 h-3.5" /> : null}
              {!isConnected ? "Connect Wallet" : busy ? "Confirm in wallet…" : step === "approve" ? `Approve ${currency}` : "Buy now"}
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              {isConnected ? `Step ${step === "approve" ? 1 : 2} of 2` : "Connect a wallet to continue"}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function VeHemi() {
  const [currency, setCurrency] = useState("USDC");
  const [search, setSearch] = useState("");
  const [minHemi, setMinHemi] = useState("");
  const [lock, setLock] = useState(null);
  const [sort, setSort] = useState("priceAsc");
  const [buying, setBuying] = useState(null);

  const listings = useMemo(() => {
    const q = search.trim().replace("#", "");
    const min = Number(minHemi) || 0;
    const test = LOCK_FILTERS.find((f) => f.id === lock)?.test ?? (() => true);
    return MOCK.filter((l) => (!q || String(l.id).includes(q)) && l.hemi >= min && test(l.left)).sort(SORTS[sort].fn);
  }, [search, minHemi, lock, sort]);

  const floor = Math.min(...MOCK.map((l) => l.price));
  const avgDiscount = Math.round(MOCK.reduce((s, l) => s + discountOf(l), 0) / MOCK.length);
  const floorListing = MOCK.find((l) => l.price === floor);
  const stats = [
    ["Floor price", <Price key="f" listing={floorListing} currency={currency} className="text-lg" />],
    ["Listed", <span key="l" className="text-lg font-semibold tabular-nums">{MOCK.length}</span>],
    ["HEMI locked", <span key="h" className="text-lg font-semibold tabular-nums">{fmt(MOCK.reduce((s, l) => s + l.hemi, 0) / 1e6, 2)}M</span>],
    ["Avg. discount", <span key="d" className="text-lg font-semibold tabular-nums text-emerald-400">{avgDiscount}%</span>],
  ];

  const reset = () => { setSearch(""); setMinHemi(""); setLock(null); };

  return (
    <div className="sm:pr-12">
      <div
        aria-hidden
        className="pointer-events-none fixed -left-[30%] -right-[10%] -bottom-[35%] h-[85%] z-0 opacity-[0.35] dark:opacity-20"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--primary)), hsl(var(--primary) / 0.7) 2%, hsl(var(--primary) / 0.3) 30%, hsl(var(--primary) / 0.08) 45%, transparent)",
        }}
      />
      <div className="container relative z-10 mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <img src={hemiLogo} alt="hemi"/>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-tight">veHEMI</h1>
              <p className="text-sm text-muted-foreground">Trade locked HEMI positions before they unlock</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Segmented value={currency} onChange={setCurrency} options={["USDC", "HEMI"]} />
            <button type="button" className="h-9 p-6 rounded-full border border-white/10 bg-primary/90 font-semibold font-display hover:bg-secondary text-lg inline-flex items-center gap-2 transition-colors">
              <Plus className="w-3.5 h-3.5" /> List veHEMI
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-border/50 bg-card px-6 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
              {value}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-12">
          <div className="relative w-full lg:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Token ID" className={`${inputCls} border-muted-foreground/20 w-full pl-9 placeholder:text-muted-foreground/50`} />
          </div>
          <ListingFilters lock={lock} onLockChange={setLock} minHemi={minHemi} onMinHemiChange={setMinHemi} />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputCls} w-full lg:w-48`}>
            {Object.entries(SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </select>
        </div>

        {/* Listings */}
        {listings.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-5 py-16 rounded-2xl border border-dashed border-border">
            <p className="font-medium">No listings match your filters</p>
            <button type="button" onClick={reset} className="h-8 px-4 rounded-xl border border-white/10 text-sm hover:bg-secondary">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {listings.map((l) => <ListingCard key={l.id} listing={l} currency={currency} onBuy={setBuying} />)}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center">
          veHEMI positions are locked until their unlock date. Always verify the position before buying.
        </p>
      </div>

      <AnimatePresence>
        {buying && <BuyDialog listing={buying} initialCurrency={currency} onClose={() => setBuying(null)} />}
      </AnimatePresence>
    </div>
  );
}
