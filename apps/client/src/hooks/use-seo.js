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

// Sets the page title, description, canonical URL, robots and link-preview tags (see lib/seo.js).
// Pass null to leave the tags alone, e.g. when a child component sets them instead. Entries without a path
// (like NOT_FOUND_SEO) use the current URL.
export function useSeo(seo) {
  // Compared as a string so a new object with the same values doesn't rerun the effect
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
