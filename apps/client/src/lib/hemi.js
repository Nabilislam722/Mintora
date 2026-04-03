import { defineChain } from 'viem';

export const hemi = defineChain({
  id: 43111,
  name: "Hemi Network",
  network: "hemi",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.hemi.network/rpc"] },
  },
});