import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wallet, Minus, Plus, ExternalLink, CheckCircle2, AlertCircle, Loader2, Lock } from "lucide-react";
import { formatEther, zeroAddress } from "viem";
import { BsStars } from "react-icons/bs";

// Config
const GENESIS_CONTRACT = "0x0000000000000000000000000000000000000000";
const HEMI_EXPLORER = "https://explorer.hemi.xyz";
const COLLECTION_NAME = "Mintora Genesis";
const COLLECTION_BLURB =
  "The founding collection of the Mintora ecosystem. One-time mint, permanently capped supply, on-chain forever.";

const MINT_LIVE = GENESIS_CONTRACT.toLowerCase() !== zeroAddress;

const GENESIS_ABI = [
  { name: "mint", type: "function", stateMutability: "payable", inputs: [{ name: "quantity", type: "uint256" }], outputs: [] },
  { name: "mintPrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "maxSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "maxPerWallet", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "mintEndTime", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
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
    <div className="flex flex-col items-center min-w-[52px]">
      <div className="glass rounded-lg px-2 py-1.5 border border-border w-full text-center">
        <span className="text-xl md:text-2xl font-bold font-mono tabular-nums text-foreground">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

// Loading placeholder
function Skeleton({ className = "" }) {
  return <span className={`block rounded-md bg-secondary animate-pulse ${className}`} />;
}

// Mint progress bar
function MintProgress({ minted, max, loading }) {
  const pct = max > 0 ? Math.min(100, (minted / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs text-muted-foreground">Minted</span>
        {loading ? (
          <Skeleton className="h-3.5 w-20" />
        ) : (
          <span className="text-xs font-semibold text-foreground font-mono">
            {max > 0 ? `${minted.toLocaleString()} / ${max.toLocaleString()}` : "— / —"}
          </span>
        )}
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
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
function QuantityStepper({ value, onChange, min = 1, max = 10, disabled = false }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/70 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        aria-label="Decrease quantity"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="text-xl font-bold font-mono w-8 text-center tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/70 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        aria-label="Increase quantity"
      >
        <Plus className="w-3.5 h-3.5" />
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

  const comingSoon = !MINT_LIVE;
  const contractCfg = { address: GENESIS_CONTRACT, abi: GENESIS_ABI };
  // Skip on-chain reads until there is a real contract to read from
  const readQuery = { query: { enabled: MINT_LIVE } };

  const { data: mintPrice, isLoading: priceLoading } = useReadContract({ ...contractCfg, functionName: "mintPrice", ...readQuery });
  const { data: totalSupply, isLoading: supplyLoading, refetch: refetchSupply } = useReadContract({ ...contractCfg, functionName: "totalSupply", ...readQuery });
  const { data: maxSupply, isLoading: maxLoading } = useReadContract({ ...contractCfg, functionName: "maxSupply", ...readQuery });
  const { data: maxPerWallet, isLoading: capLoading } = useReadContract({ ...contractCfg, functionName: "maxPerWallet", ...readQuery });
  const { data: mintEndTime, isLoading: endLoading } = useReadContract({ ...contractCfg, functionName: "mintEndTime", ...readQuery });
  const { data: walletBalance, refetch: refetchBalance } = useReadContract({
    ...contractCfg,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: MINT_LIVE && !!address },
  });

  const isDataLoading = MINT_LIVE && (priceLoading || supplyLoading || maxLoading || capLoading || endLoading);

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
    if (comingSoon || isDataLoading) return;
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
    comingSoon ||
    isDataLoading ||
    soldOut ||
    (countdown && countdown.ended) ||
    walletCapReached ||
    isSigning ||
    isConfirming;

  const maxSelectable = Math.max(1, Math.min(perWalletCap - alreadyOwned, remainingSupply || perWalletCap));

  let buttonLabel = "Mint Now";
  if (comingSoon) buttonLabel = "Coming Soon";
  else if (isDataLoading) buttonLabel = "Loading…";
  else if (!isConnected) buttonLabel = "Connect Wallet";
  else if (soldOut) buttonLabel = "Sold Out";
  else if (countdown && countdown.ended) buttonLabel = "Mint Ended";
  else if (walletCapReached) buttonLabel = "Wallet Limit Reached";
  else if (isSigning) buttonLabel = "Confirm in Wallet…";
  else if (isConfirming) buttonLabel = "Minting…";

  const showSpinner = !comingSoon && (isDataLoading || isSigning || isConfirming);

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 max-w-2xl">

      {/* Hero */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
            {comingSoon ? "Coming Soon" : "Exclusive · Limited Time"}
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
          {COLLECTION_NAME}
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
          {COLLECTION_BLURB}
        </p>
      </div>

      {/* NFT */}
      <div className="relative rounded-2xl overflow-hidden border border-border mb-6 aspect-[4/3] bg-gradient-to-br from-primary/30 via-secondary to-accent/30">
        <div className="absolute inset-0 flex items-center justify-center">
          <BsStars className="w-10 h-10 text-foreground/20" />
        </div>
      </div>

      {/* Countdown */}
      {countdown && !countdown.ended && (
        <div className="flex justify-center gap-2 mb-6">
          <CountdownUnit value={countdown.days} label="Days" />
          <CountdownUnit value={countdown.hours} label="Hrs" />
          <CountdownUnit value={countdown.minutes} label="Min" />
          <CountdownUnit value={countdown.seconds} label="Sec" />
        </div>
      )}

      {/* Mint card */}
      <div className="glass rounded-2xl border border-border p-4 md:p-5">

        <MintProgress minted={minted} max={max} loading={isDataLoading} />

        <hr className="s-divider my-4 border-border" />

        <AnimatePresence mode="wait">
          {isConfirmed ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-3"
            >
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-1.5">Mint Successful!</h3>
              <p className="text-xs text-muted-foreground mb-4">
                {quantity} {quantity === 1 ? "piece" : "pieces"} of {COLLECTION_NAME} {quantity === 1 ? "is" : "are"} now yours.
              </p>
              <div className="flex items-center justify-center gap-3">
                <a
                  href={`${HEMI_EXPLORER}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  View transaction <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <button
                type="button"
                onClick={() => { resetWrite(); setQuantity(1); }}
                className="mt-4 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
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
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Price per item</p>
                  {isDataLoading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <p className="text-xl font-bold font-mono text-foreground">
                      {mintPrice !== undefined ? `${formatEther(unitPrice)} ETH` : "—"}
                    </p>
                  )}
                </div>
                <QuantityStepper
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                  max={maxSelectable}
                  disabled={comingSoon || isDataLoading}
                />
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">Total</span>
                {isDataLoading ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <span className="font-mono font-semibold text-foreground">
                    {mintPrice !== undefined ? `${formatEther(totalCost)} ETH` : "—"}
                  </span>
                )}
              </div>

              {isConnected && !comingSoon && (
                <p className="text-[11px] text-muted-foreground text-center">
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
                aria-busy={showSpinner}
                className="w-full h-10 rounded-lg text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {comingSoon ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : showSpinner ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : !isConnected ? (
                  <Wallet className="w-3.5 h-3.5" />
                ) : null}
                {buttonLabel}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-center text-[11px] text-muted-foreground mt-4">
        {comingSoon
          ? "Minting on Hemi Network opens soon. Check back for the launch date."
          : "Minting on Hemi Network. Gas fees apply. Once the countdown ends or supply is exhausted, minting closes permanently."}
      </p>
    </div>
  );
}