// Cloudflare Worker in front of the built site (./dist/public). For page requests it writes that page's title,
// description, canonical URL, robots and link-preview tags into the HTML before sending it: Google reads them on
// its first pass, and X/Discord/Telegram previews never run JavaScript. It also returns a real 404 status for
// unknown pages and serves /sitemap.xml. Files (JS, CSS, images) go straight to the static assets.
import {
  NOT_FOUND_SEO,
  SITE_URL,
  SITEMAP_PATHS,
  buildMeta,
  collectionSeo,
  homeJsonLd,
  metaTags,
  nftSeo,
  pageSeo,
  profileSeo,
  veHemiSeo,
} from "../apps/client/src/lib/seo.js";

const API_URL = "https://api.mintora.app";
const API_TIMEOUT_MS = 2500;

// GET an API path. Returns the JSON, null when the API says it doesn't exist (4xx), or undefined when the API
// is down or slow, so the page gets generic tags instead of a false 404.
async function api(path) {
  try {
    const res = await fetch(API_URL + path, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (res.status >= 400 && res.status < 500) return null;
    if (!res.ok) return undefined;
    return await res.json();
  } catch {
    return undefined;
  }
}

const notFound = (path) => ({ seo: { ...NOT_FOUND_SEO, path }, status: 404 });

// SEO entry and HTTP status for a page. Keep in step with the routes in apps/client/src/App.jsx.
async function resolvePage(path) {
  const page = pageSeo(path);
  if (page) return { seo: page, status: 200 };

  let m;
  if ((m = path.match(/^\/collections\/([^/]+)$/))) {
    const collection = await api(`/api/collections/${encodeURIComponent(m[1])}`);
    if (collection === null) return notFound(path);
    return { seo: collection ? collectionSeo(collection) : { title: "NFT Collection", path }, status: 200 };
  }
  if ((m = path.match(/^\/nfts\/([^/]+)\/([^/]+)$/))) {
    const nft = await api(`/api/nfts/${encodeURIComponent(m[1])}/${encodeURIComponent(m[2])}`);
    if (nft === null) return notFound(path);
    return { seo: nft ? nftSeo(nft, m[1]) : { title: `NFT #${m[2]}`, path }, status: 200 };
  }
  if ((m = path.match(/^\/profile\/([^/]+)$/))) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(m[1])) return notFound(path);
    const user = await api(`/api/users/${m[1]}`);
    const seo = user === undefined ? { title: "NFT Profile", path: `/profile/${m[1].toLowerCase()}` } : profileSeo(m[1], user);
    return { seo, status: 200 };
  }
  if ((m = path.match(/^\/vehemi\/(\d+)$/))) return { seo: veHemiSeo(m[1]), status: 200 };
  return notFound(path);
}

function withSeoTags(shell, meta, { status, jsonLd }) {
  const rewriter = new HTMLRewriter()
    .on("title", { element: (e) => e.setInnerContent(meta.title) })
    .on('link[rel="canonical"]', { element: (e) => e.setAttribute("href", meta.url) });
  for (const [attr, key, value] of metaTags(meta)) {
    rewriter.on(`meta[${attr}="${key}"]`, { element: (e) => e.setAttribute("content", value) });
  }
  if (jsonLd) {
    const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
    rewriter.on("head", { element: (e) => e.append(`<script type="application/ld+json">${json}</script>`, { html: true }) });
  }

  const out = rewriter.transform(shell);
  const headers = new Headers(out.headers);
  // The shell's ETag belongs to index.html, not to this page's HTML
  headers.delete("etag");
  return new Response(out.body, { status, headers });
}

const escapeXml = (s) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

async function sitemap() {
  const collections = await api("/api/collections");
  const paths = [
    ...SITEMAP_PATHS,
    ...(Array.isArray(collections) ? collections : []).filter((c) => c.slug).map((c) => `/collections/${c.slug}`),
  ];
  const urls = paths.map((p) => `  <url><loc>${escapeXml(SITE_URL + p)}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/sitemap.xml") return sitemap();

    // Files (anything with an extension) and non-GET requests are served as-is
    if ((request.method !== "GET" && request.method !== "HEAD") || /\.[a-z0-9]+$/i.test(path)) {
      return env.ASSETS.fetch(request);
    }

    // One URL per page: /faq/ -> /faq
    if (path.length > 1 && path.endsWith("/")) {
      url.pathname = path.replace(/\/+$/, "") || "/";
      return Response.redirect(url.toString(), 301);
    }

    // Plain GET for the shell, without the browser's If-None-Match, so it never comes back as an empty 304
    const [shell, { seo, status }] = await Promise.all([env.ASSETS.fetch(new URL("/", url)), resolvePage(path)]);
    if (!shell.ok || !shell.headers.get("content-type")?.includes("text/html")) return shell;
    return withSeoTags(shell, buildMeta(seo), { status, jsonLd: path === "/" ? homeJsonLd() : null });
  },
};
