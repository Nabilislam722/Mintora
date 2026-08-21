import { useState, useEffect, useMemo } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wallet, Minus, Plus, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { formatEther } from "viem";

// Config
const GENESIS_CONTRACT = "0x0000000000000000000000000000000000000000";
const HEMI_EXPLORER = "https://explorer.hemi.xyz"; 
const COLLECTION_NAME = "Mintora Genesis";
const COLLECTION_BLURB =
  "The founding collection of the Mintora ecosystem. One-time mint, permanently capped supply, on-chain forever.";

const GENESIS_ABI = [
  {
    name: "mint",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "quantity", type: "uint256" }],
    outputs: [],
  },
  {
    name: "mintPrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "maxSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "maxPerWallet",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "mintEndTime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
];

// Countdown
function useCountdown(targetTimestampSec) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  if (!targetTimestampSec) return null;

  const diff = Math.max(0, Number(targetTimestampSec) - now);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  return { diff, days, hours, minutes, seconds, ended: diff <= 0 };
}

function CountdownUnit({ value, label }) {
  return (
    <div className="flex flex-col items-center min-w-[64px]">
      <div className="glass rounded-xl px-3 py-2 border border-border w-full text-center">
        <span className="text-2xl md:text-3xl font-bold font-mono tabular-nums text-foreground">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">{label}</span>
    </div>
  );
}

// Mint progress bar
function MintProgress({ minted, max }) {
  const pct = max > 0 ? Math.min(100, (minted / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm text-muted-foreground">Minted</span>
        <span className="text-sm font-semibold text-foreground font-mono">
          {minted.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// Quantity stepper 
function QuantityStepper({ value, onChange, min = 1, max = 10 }) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-10 h-10 rounded-xl bg-secondary hover:bg-secondary/70 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        aria-label="Decrease quantity"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="text-2xl font-bold font-mono w-10 text-center tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-10 h-10 rounded-xl bg-secondary hover:bg-secondary/70 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        aria-label="Increase quantity"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

// Main page
export default function Genesis() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [quantity, setQuantity] = useState(1);
  const [mintError, setMintError] = useState("");

  const contractCfg = { address: GENESIS_CONTRACT, abi: GENESIS_ABI };

  const { data: mintPrice } = useReadContract({ ...contractCfg, functionName: "mintPrice" });
  const { data: totalSupply, refetch: refetchSupply } = useReadContract({ ...contractCfg, functionName: "totalSupply" });
  const { data: maxSupply } = useReadContract({ ...contractCfg, functionName: "maxSupply" });
  const { data: maxPerWallet } = useReadContract({ ...contractCfg, functionName: "maxPerWallet" });
  const { data: mintEndTime } = useReadContract({ ...contractCfg, functionName: "mintEndTime" });
  const { data: walletBalance, refetch: refetchBalance } = useReadContract({
    ...contractCfg,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const countdown = useCountdown(mintEndTime);

  const minted = totalSupply ? Number(totalSupply) : 0;
  const max = maxSupply ? Number(maxSupply) : 0;
  const soldOut = max > 0 && minted >= max;
  const remainingSupply = Math.max(0, max - minted);
  const perWalletCap = maxPerWallet ? Number(maxPerWallet) : 10;
  const alreadyOwned = walletBalance ? Number(walletBalance) : 0;
  const walletCapReached = alreadyOwned >= perWalletCap;

  const unitPrice = mintPrice ?? 0n;
  const totalCost = unitPrice * BigInt(quantity);

  const {
    writeContract,
    data: txHash,
    isPending: isSigning,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isConfirmed) {
      refetchSupply();
      refetchBalance();
    }
  }, [isConfirmed]);

  const handleMint = async () => {
    setMintError("");
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    try {
      writeContract({
        ...contractCfg,
        functionName: "mint",
        args: [BigInt(quantity)],
        value: totalCost,
      });
    } catch (e) {
      setMintError(e?.shortMessage || e?.message || "Mint failed. Please try again.");
    }
  };

  const mintDisabled =
    soldOut ||
    (countdown && countdown.ended) ||
    walletCapReached ||
    isSigning ||
    isConfirming;

  const maxSelectable = Math.max(1, Math.min(perWalletCap - alreadyOwned, remainingSupply || perWalletCap));

  let buttonLabel = "Mint Now";
  if (!isConnected) buttonLabel = "Connect Wallet";
  else if (soldOut) buttonLabel = "Sold Out";
  else if (countdown && countdown.ended) buttonLabel = "Mint Ended";
  else if (walletCapReached) buttonLabel = "Wallet Limit Reached";
  else if (isSigning) buttonLabel = "Confirm in Wallet…";
  else if (isConfirming) buttonLabel = "Minting…";

  return (
    <div className="container mx-auto px-4 py-10 md:py-16 max-w-4xl">

      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
            Exclusive · Limited Time
          </span>
        </div>
        <h1 className="text-4xl md:text-6xl font-display font-bold text-foreground mb-4">
          {COLLECTION_NAME}
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
          {COLLECTION_BLURB}
        </p>
      </div>

      {/* Banner image */}
      <div className="relative rounded-3xl overflow-hidden border border-border mb-8 aspect-[21/9] bg-gradient-to-br from-primary/30 via-secondary to-accent/30">
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-14 h-14 text-foreground/20" />
        </div>
      </div>

      {/* Countdown */}
      {countdown && !countdown.ended && (
        <div className="flex justify-center gap-3 mb-8">
          <CountdownUnit value={countdown.days} label="Days" />
          <CountdownUnit value={countdown.hours} label="Hrs" />
          <CountdownUnit value={countdown.minutes} label="Min" />
          <CountdownUnit value={countdown.seconds} label="Sec" />
        </div>
      )}

      {/* Mint card */}
      <div className="glass rounded-2xl border border-border p-6 md:p-8">

        <MintProgress minted={minted} max={max} />

        <hr className="s-divider my-6 border-border" />

        <AnimatePresence mode="wait">
          {isConfirmed ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-6"
            >
              <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Mint Successful!</h3>
              <p className="text-sm text-muted-foreground mb-5">
                {quantity} {quantity === 1 ? "piece" : "pieces"} of {COLLECTION_NAME} {quantity === 1 ? "is" : "are"} now yours.
              </p>
              <div className="flex items-center justify-center gap-3">
                <a
                  href={`${HEMI_EXPLORER}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  View transaction <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <button
                type="button"
                onClick={() => { resetWrite(); setQuantity(1); }}
                className="mt-5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Mint again
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="mint-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Price per item</p>
                  <p className="text-2xl font-bold font-mono text-foreground">
                    {mintPrice !== undefined ? `${formatEther(unitPrice)} ETH` : "—"}
                  </p>
                </div>
                <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={maxSelectable} />
              </div>

              <div className="flex items-center justify-between text-sm px-1">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono font-semibold text-foreground">
                  {mintPrice !== undefined ? `${formatEther(totalCost)} ETH` : "—"}
                </span>
              </div>

              {isConnected && (
                <p className="text-xs text-muted-foreground text-center">
                  You own {alreadyOwned} · Limit {perWalletCap} per wallet
                </p>
              )}

              {mintError && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">{mintError}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleMint}
                disabled={mintDisabled}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSigning || isConfirming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !isConnected ? (
                  <Wallet className="w-4 h-4" />
                ) : null}
                {buttonLabel}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Minting on Hemi Network. Gas fees apply. Once the countdown ends or supply is exhausted, minting closes permanently.
      </p>
    </div>
  );
}