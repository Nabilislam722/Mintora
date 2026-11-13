import { useEffect } from "react";
import { buildMeta, metaTags } from "@/lib/seo";

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Sets the page's title, description, canonical, robots and preview tags (null leaves them alone)
export function useSeo(seo) {
  const key = seo ? JSON.stringify(buildMeta({ path: window.location.pathname, ...seo })) : null;

  useEffect(() => {
    if (!key) return;
    const meta = JSON.parse(key);
    document.title = meta.title;
    for (const [attr, name, value] of metaTags(meta)) setMeta(attr, name, value);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = meta.url;
  }, [key]);
}
