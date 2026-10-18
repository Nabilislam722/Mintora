import { defineChain } from 'viem';

export const hemi = defineChain({
  id: 43111,
  name: "Hemi Network",
  network: "hemi",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.hemi.network/rpc"] },
  },
  // Canonical Multicall3 (deployed on Hemi), so wagmi batches multi-contract reads into one call
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
});