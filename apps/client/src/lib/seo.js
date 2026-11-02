// Titles, descriptions and preview images for search engines and link previews.
// Shared by the React app (hooks/use-seo.js), which updates <head> as you navigate, and the Cloudflare Worker
// (worker/index.js), which writes the same tags into the HTML before it's sent, for crawlers and link previews
// that don't run JavaScript. Keep this file free of browser-only imports.

export const SITE_URL = "https://mintora.app";
export const SITE_NAME = "Mintora";
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;
const DEFAULT_TITLE = "Mintora | Next-Gen NFT Marketplace on Hemi Network";
const DEFAULT_DESCRIPTION =
  "Mintora is a gas-optimized NFT marketplace built natively on Hemi Network. Discover, list and trade digital collectibles with low fees.";

// Static routes. noindex keeps a page out of search results: wallet-only pages and ones that aren't live yet.
const PAGES = {
  "/": { title: DEFAULT_TITLE, absoluteTitle: true },
  "/collections": {
    title: "Explore NFT Collections on Hemi",
    description: "Browse every NFT collection on Mintora with live floor prices, volume and verified badges, all on Hemi Network.",
  },
  "/activity": {
    title: "Live NFT Activity",
    description: "Recent NFT sales, listings and transfers across Mintora on Hemi Network.",
  },
  "/vehemi": {
    title: "veHEMI Marketplace: Buy Locked HEMI",
    description:
      "Buy and sell locked HEMI (veHEMI) positions, priced in HEMI. Compare lock time, voting weight and discount before you buy.",
  },
  "/genesis": {
    title: "Mintora Genesis Mint",
    description: "The founding collection of the Mintora ecosystem. One-time mint, permanently capped supply, on-chain forever.",
  },
  "/faq": {
    title: "FAQ",
    description: "Answers to common questions about Mintora: getting started, buying and listing NFTs, fees, royalties and wallets.",
  },
  "/rewards": { title: "Rewards", noindex: true },
  "/create": { title: "Create", noindex: true },
  "/settings": { title: "Settings", noindex: true },
  "/profile": { title: "Your Profile", noindex: true },
  "/welcome": { title: "Welcome", noindex: true },
};

export const NOT_FOUND_SEO = { title: "Page Not Found", noindex: true };

// Static pages that belong in the sitemap
export const SITEMAP_PATHS = Object.keys(PAGES).filter((path) => !PAGES[path].noindex);

export const pageSeo = (path) => (PAGES[path] ? { ...PAGES[path], path } : null);

const clean = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const shortAddress = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// Wei string -> "0.0011"
const formatEth = (wei) => {
  try {
    return (Number(BigInt(wei) / 10n ** 12n) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 4 });
  } catch {
    return null;
  }
};

// Link previews need a public https image; embedded data: images and unknown schemes don't work
const httpsImage = (url) => {
  if (typeof url !== "string") return null;
  if (url.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${url.slice(7).replace(/^ipfs\//, "")}`;
  return url.startsWith("https://") ? url : null;
};

export function collectionSeo(c) {
  const floor = Number(c.floorPrice) > 0 ? `Floor price ${c.floorPrice} ETH. ` : "";
  return {
    title: `${clean(c.name)} NFT Collection`,
    description: `${clean(c.description) || `${clean(c.name)} NFTs on Hemi Network.`} ${floor}Buy and sell on Mintora.`,
    path: `/collections/${c.slug}`,
    image: httpsImage(c.bannerUrl) || httpsImage(c.logoUrl),
  };
}

// `nft` as returned by /api/nfts/:collectionId/:tokenId, with its collection populated
export function nftSeo(nft, collectionId) {
  const col = nft.collectionId ?? {};
  const name = clean(nft.name) || `#${nft.tokenId}`;
  const colName = clean(col.name);
  const price = nft.isListed && Number(nft.price) > 0 ? formatEth(nft.price) : null;
  const intro = colName ? `${name} from the ${colName} collection on Hemi Network.` : `${name} on Hemi Network.`;
  const offer = price ? `Buy it now for ${price} ETH on Mintora.` : "See its traits, owner and activity on Mintora.";
  return {
    title: colName && !name.includes(colName) ? `${name} - ${colName}` : name,
    description: [intro, offer, clean(nft.description)].filter(Boolean).join(" "),
    path: `/nfts/${collectionId}/${nft.tokenId}`,
    image: httpsImage(nft.imageUrl) || httpsImage(col.logoUrl) || httpsImage(col.bannerUrl),
  };
}

// Wallets without a username have nothing to show in search, so they're kept out of the index
export function profileSeo(address, user) {
  const name = clean(user?.username) || shortAddress(address);
  const bio = clean(user?.bio);
  return {
    title: `${name} - NFT Profile`,
    description: `${bio ? `${bio} ` : ""}See the NFTs, collections and activity of ${name} on Mintora, the NFT marketplace on Hemi Network.`,
    path: `/profile/${address.toLowerCase()}`,
    image: httpsImage(user?.profileImageUrl),
    noindex: !clean(user?.username),
  };
}

export function veHemiSeo(id) {
  return {
    title: `veHEMI #${id} - Locked HEMI Position`,
    description: `Buy veHEMI #${id}, a locked HEMI position with voting weight, priced in HEMI on Mintora. Check its unlock date and discount before you buy.`,
    path: `/vehemi/${id}`,
  };
}

// Turns a page's SEO entry into the exact values for the <head> tags
export function buildMeta({ title, description, path = "/", image, noindex = false, absoluteTitle = false } = {}) {
  return {
    title: !title ? DEFAULT_TITLE : absoluteTitle ? title : `${clean(title)} | ${SITE_NAME}`,
    description: truncate(clean(description) || DEFAULT_DESCRIPTION, 160),
    url: `${SITE_URL}${path}`,
    image: httpsImage(image) || DEFAULT_IMAGE,
    robots: noindex ? "noindex, follow" : "index, follow, max-image-preview:large",
  };
}

// The <meta> tags to set, as [attribute, key, value]. index.html has one of each for these to update.
export const metaTags = (m) => [
  ["name", "description", m.description],
  ["name", "robots", m.robots],
  ["property", "og:title", m.title],
  ["property", "og:description", m.description],
  ["property", "og:url", m.url],
  ["property", "og:image", m.image],
  ["name", "twitter:title", m.title],
  ["name", "twitter:description", m.description],
  ["name", "twitter:image", m.image],
];

// Structured data for the home page: tells search engines the site's name and logo
export const homeJsonLd = () => ({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, url: `${SITE_URL}/` },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/logo.png`,
      sameAs: ["https://discord.gg/z5GKWefcuB"],
    },
  ],
});
