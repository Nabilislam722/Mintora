import { useMemo } from "react";
import { Link } from "wouter";
import { useReadContract } from "wagmi";
import { formatEther, zeroAddress } from "viem";
import { BadgeCheck, ExternalLink, Globe } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { useEthPrice } from "@/hooks/use-token-prices";
import { hemi } from "@/lib/hemi";
import { isListed, shortAddress } from "@/lib/nft";

const OWNER_ABI = [{ name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }];

const chipCls =
  "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm text-white bg-white/10 border border-white/10 backdrop-blur-md hover:bg-white/20 transition-colors";
const iconBtnCls =
  "w-9 h-9 rounded-lg flex items-center justify-center text-white bg-white/10 border border-white/10 backdrop-blur-md hover:bg-white/20 transition-colors";

const fmtEth = (v) => v.toLocaleString(undefined, { maximumFractionDigits: v >= 100 ? 0 : v >= 1 ? 2 : 4 });

export default function CollectionHero({ collection, nfts }) {
  const ethPrice = useEthPrice();
  const address = collection.contractAddress;

  // Contract owner stands in for the creator; collections that aren't Ownable just skip the chip
  const { data: owner } = useReadContract({
    address,
    abi: OWNER_ABI,
    functionName: "owner",
    chainId: hemi.id,
    query: { retry: false, staleTime: Infinity },
  });
  const creator = owner && owner !== zeroAddress ? owner : null;

  const stats = useMemo(() => {
    if (!nfts?.length) return null;
    const listed = nfts.filter(isListed);
    const floor = listed.reduce((min, n) => (min === null || BigInt(n.price) < min ? BigInt(n.price) : min), null);
    const owners = new Set(nfts.map((n) => n.ownerAddress)).size;
    return { items: nfts.length, listed: listed.length, owners, floor: floor === null ? null : Number(formatEther(floor)) };
  }, [nfts]);

  const volume = Number(collection.volume) || 0;
  const marketCap = stats?.floor != null ? stats.floor * stats.items : null;
  const usd = (eth) =>
    ethPrice && eth != null ? `≈ ${(eth * ethPrice).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}` : undefined;

  const statList = [
    ["Floor price", stats?.floor != null ? fmtEth(stats.floor) : null, "ETH", usd(stats?.floor)],
    ["Total volume", fmtEth(volume), "ETH", usd(volume)],
    ["Market cap", marketCap != null ? fmtEth(marketCap) : null, "ETH", usd(marketCap)],
    ["Listed", stats?.listed.toLocaleString()],
    ["Owners", stats?.owners.toLocaleString()],
  ];

  return (
    <>
      <section className="relative isolate overflow-hidden">
        {collection.bannerUrl ? (
          <img src={collection.bannerUrl} alt="" className="absolute inset-0 -z-10 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/40 via-secondary to-background" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

        <div className="container mx-auto px-4 sm:pr-12 min-h-[380px] md:min-h-[460px] lg:min-h-[520px] pt-24 pb-6 flex flex-col justify-end gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-end gap-4 min-w-0">
            <img
              src={collection.logoUrl}
              alt={collection.name}
              className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover bg-card ring-1 ring-white/20 shadow-2xl shrink-0"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-4xl font-display font-bold text-white leading-tight truncate">{collection.name}</h1>
                {collection.isVerified && <BadgeCheck aria-label="Verified" className="w-6 h-6 md:w-7 md:h-7 shrink-0 fill-blue-500 text-white" />}
                {(collection.twitter || collection.website) && (
                  <div className="flex items-center gap-2 ml-1">
                    {collection.twitter && (
                      <a href={collection.twitter} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className={iconBtnCls}>
                        <FaXTwitter className="w-4 h-4" />
                      </a>
                    )}
                    {collection.website && (
                      <a href={collection.website} target="_blank" rel="noopener noreferrer" aria-label="Website" className={iconBtnCls}>
                        <Globe className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                {stats && (
                  <span className={chipCls}>
                    {stats.items.toLocaleString()} <span className="text-white/60">items</span>
                  </span>
                )}
                {creator && (
                  <Link href={`/profile/${creator}`} className={`${chipCls} font-mono`}>
                    <span className="font-sans text-white/60">by</span> {shortAddress(creator)}
                  </Link>
                )}
                <a href={`https://explorer.hemi.xyz/token/${address}`} target="_blank" rel="noopener noreferrer" className={chipCls}>
                  View on Explorer <ExternalLink className="w-3.5 h-3.5 text-white/60" />
                </a>
              </div>
            </div>
          </div>

          <dl className="flex gap-6 md:gap-8 overflow-x-auto rounded-2xl bg-black/50 border border-white/10 backdrop-blur-md px-5 py-3 shrink-0">
            {statList.map(([label, value, unit, title]) => (
              <div key={label} title={title} className="shrink-0 text-right">
                <dt className="text-xs text-white/60 whitespace-nowrap">{label}</dt>
                <dd className="text-lg font-semibold text-white tabular-nums whitespace-nowrap">
                  {value ?? "—"}
                  {value != null && unit && <span className="ml-1 text-xs font-normal text-white/60">{unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {collection.description && (
        <div className="container mx-auto px-4 sm:pr-12">
          <p className="mt-5 max-w-3xl text-sm text-muted-foreground">{collection.description}</p>
        </div>
      )}
    </>
  );
}
