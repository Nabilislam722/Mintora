import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useBalance } from "wagmi";
import { Calendar, Check, Copy, ExternalLink, Settings } from "lucide-react";
import { hemi } from "@/lib/hemi";
import { isListed, shortAddress } from "@/lib/nft";

const chipBase = "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm text-white bg-white/10 border border-white/10 backdrop-blur-md";
const chipCls = `${chipBase} hover:bg-white/20 transition-colors`;

export default function ProfileHero({ address, user, nfts, isOwnProfile }) {
  const { data: balance } = useBalance({ address, chainId: hemi.id });
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    if (!nfts) return null;
    return {
      items: nfts.length,
      collections: new Set(nfts.map((n) => n.collectionId?._id ?? n.contractAddress)).size,
      listed: nfts.filter(isListed).length,
    };
  }, [nfts]);

  const name = user?.username || shortAddress(address);
  const joined = user?.createdAt && new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" });

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const statList = [
    ["Items", stats?.items.toLocaleString()],
    ["Collections", stats?.collections.toLocaleString()],
    ["Listed", stats?.listed.toLocaleString()],
    ["Balance", balance ? Number(balance.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 }) : null, "ETH"],
  ];

  return (
    <>
      <section className="relative isolate overflow-hidden">
        {user?.bannerImageUrl ? (
          <img src={user.bannerImageUrl} alt="" className="absolute inset-0 -z-10 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/40 via-secondary to-background" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

        <div className="container mx-auto px-4 sm:pr-12 min-h-[300px] md:min-h-[380px] pt-24 pb-6 flex flex-col justify-end gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-end gap-4 min-w-0">
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={name}
                className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover bg-card ring-4 ring-black/40 shadow-2xl shrink-0"
              />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-primary to-accent ring-4 ring-black/40 shadow-2xl shrink-0 flex items-center justify-center">
                <span className="text-2xl md:text-3xl font-display font-bold text-black">{address.slice(2, 4).toUpperCase()}</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl md:text-4xl font-display font-bold text-white leading-tight truncate">{name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button type="button" onClick={copy} className={`${chipCls} font-mono`} title="Copy address">
                  {shortAddress(address)}
                  {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5 text-white/60" />}
                </button>
                <a href={`https://explorer.hemi.xyz/address/${address}`} target="_blank" rel="noopener noreferrer" className={chipCls}>
                  View on Explorer <ExternalLink className="w-3.5 h-3.5 text-white/60" />
                </a>
                {joined && (
                  <span className={chipBase}>
                    <Calendar className="w-3.5 h-3.5 text-white/60" /> <span className="text-white/60">Joined</span> {joined}
                  </span>
                )}
                {isOwnProfile && (
                  <Link href="/settings" className={chipCls}>
                    <Settings className="w-3.5 h-3.5" /> Edit profile
                  </Link>
                )}
              </div>
            </div>
          </div>

          <dl className="flex gap-6 md:gap-8 overflow-x-auto rounded-2xl bg-black/50 border border-white/10 backdrop-blur-md px-5 py-3 shrink-0">
            {statList.map(([label, value, unit]) => (
              <div key={label} className="shrink-0 text-right">
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

      {user?.bio && (
        <div className="container mx-auto px-4 sm:pr-12">
          <p className="mt-5 max-w-3xl text-sm text-muted-foreground">{user.bio}</p>
        </div>
      )}
    </>
  );
}
