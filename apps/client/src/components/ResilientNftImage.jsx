import { useEffect, useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import { imageCandidates, reportImageFailed, reportImageLoaded } from "@/lib/ipfs-image";

// An NFT image that falls back across IPFS gateways. Which URL it tries first, and which gateways it skips, is
// decided in lib/ipfs-image.js so already-loaded images come from the browser's cache.
export default function ResilientNftImage({ src, alt, className, loading = "lazy" }) {
  const candidates = useMemo(() => imageCandidates(src), [src]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [src]);

  const url = candidates[attempt];

  // No image stored yet (see apps/server/sync.js), or every gateway failed
  if (!url) {
    return (
      <div role="img" aria-label={alt} className={`${className ?? ""} flex items-center justify-center bg-secondary/40 text-muted-foreground`}>
        <ImageOff className="w-1/4 h-1/4 max-w-10 max-h-10 opacity-60" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onLoad={() => reportImageLoaded(src, url)}
      onError={() => {
        reportImageFailed(src, url);
        setAttempt((i) => i + 1);
      }}
    />
  );
}
