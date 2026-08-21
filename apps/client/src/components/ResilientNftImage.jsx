import { useEffect, useMemo, useState } from "react";

const FREE_IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://ipfs.io/ipfs/",
];

// failed to load for this visitor.
const DEDICATED_IPFS_GATEWAY = "https://maroon-impressed-toucan-831.mypinata.cloud/ipfs/";

const IMAGE_CACHE_PREFIX = "resolved_nft_img:";
const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000; 

function readCachedImageUrl(cidPath) {
  if (!cidPath) return null;
  try {
    const raw = localStorage.getItem(IMAGE_CACHE_PREFIX + cidPath);
    if (!raw) return null;
    const { url, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > IMAGE_CACHE_TTL) return null;
    return url;
  } catch {
    return null;
  }
}

function writeCachedImageUrl(cidPath, url) {
  if (!cidPath) return;
  try {
    localStorage.setItem(
      IMAGE_CACHE_PREFIX + cidPath,
      JSON.stringify({ url, timestamp: Date.now() })
    );
  } catch {
   
  }
}

function clearCachedImageUrl(cidPath) {
  if (!cidPath) return;
  try {
    localStorage.removeItem(IMAGE_CACHE_PREFIX + cidPath);
  } catch {
    // ignore
  }
}

function extractIpfsCidPath(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/\/ipfs\/(.+)$/);
  return match ? match[1] : null;
}

function buildImageFallbackChain(originalUrl, cidPath) {
  if (!cidPath) return [originalUrl];

  const cached = readCachedImageUrl(cidPath);
  const chain = cached ? [cached] : [];

  if (originalUrl && originalUrl !== cached) chain.push(originalUrl);

  for (const gw of FREE_IPFS_GATEWAYS) {
    const candidate = `${gw}${cidPath}`;
    if (!chain.includes(candidate)) chain.push(candidate);
  }

  const dedicated = `${DEDICATED_IPFS_GATEWAY}${cidPath}`;
  if (!chain.includes(dedicated)) chain.push(dedicated);

  return chain;
}

export default function ResilientNftImage({ src, alt, className, loading = "lazy" }) {
  const cidPath = useMemo(() => extractIpfsCidPath(src), [src]);
  const chain = useMemo(() => buildImageFallbackChain(src, cidPath), [src, cidPath]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [src]);

  const hasMoreFallbacks = attempt + 1 < chain.length;

  const handleError = () => {
    if (hasMoreFallbacks) {
      setAttempt((i) => i + 1);
    } 
    else if (cidPath) {

      clearCachedImageUrl(cidPath);
    }
  };

  const handleLoad = () => {
    if (cidPath) {
      writeCachedImageUrl(cidPath, chain[attempt]);
    }
  };

  return (
    <img
      src={chain[attempt]}
      alt={alt}
      className={className}
      loading={loading}
      onError={hasMoreFallbacks ? handleError : undefined}
      onLoad={handleLoad}
    />
  );
}