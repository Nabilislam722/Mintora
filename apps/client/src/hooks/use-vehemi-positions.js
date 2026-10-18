import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { hemi } from "@/lib/hemi";
import { VE_HEMI_CONTRACT } from "@/lib/vehemi";

// Subset of hemilabs/veHEMI VeHemi.sol (ERC721Enumerable)
const VE_HEMI_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getLockedBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "tuple", components: [{ name: "amount", type: "int128" }, { name: "end", type: "uint64" }] }],
  },
  { name: "balanceOfNFT", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "isTransferable", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "bool" }] },
];

const MAX_POSITIONS = 48;
const base = { address: VE_HEMI_CONTRACT, abi: VE_HEMI_ABI, chainId: hemi.id };

// veHEMI positions held by `owner`, read from the veHEMI contract in three batched steps:
// count → token ids → { HEMI locked, unlock time, current voting weight, transferable } per id
export function useVeHemiPositions(owner) {
  const { data: balance, isLoading: loadingCount } = useReadContract({
    ...base,
    functionName: "balanceOf",
    args: [owner],
    query: { enabled: !!owner },
  });
  const count = Number(balance ?? 0n);
  const shown = Math.min(count, MAX_POSITIONS);

  const { data: idResults } = useReadContracts({
    contracts: Array.from({ length: shown }, (_, i) => ({ ...base, functionName: "tokenOfOwnerByIndex", args: [owner, BigInt(i)] })),
    query: { enabled: shown > 0 },
  });
  const tokenIds = (idResults ?? []).map((r) => r.result).filter((id) => id != null);

  const { data: details } = useReadContracts({
    contracts: tokenIds.flatMap((id) => [
      { ...base, functionName: "getLockedBalance", args: [id] },
      { ...base, functionName: "balanceOfNFT", args: [id] },
      { ...base, functionName: "isTransferable", args: [id] },
    ]),
    query: { enabled: tokenIds.length > 0 },
  });

  const positions = details
    ? tokenIds
        .map((id, i) => {
          const [locked, weight, transferable] = details.slice(i * 3, i * 3 + 3).map((r) => r.result);
          if (!locked) return null;
          return {
            id: Number(id),
            hemi: Number(formatUnits(locked.amount, 18)),
            end: Number(locked.end) * 1000,
            weight: Number(formatUnits(weight ?? 0n, 18)),
            transferable: transferable ?? false,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.hemi - a.hemi)
    : null;

  return { count, positions, loading: loadingCount || (count > 0 && !positions) };
}
