import { useState, useMemo } from "react";
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  Wallet, 
  Coins, 
  ShieldCheck, 
  Palette, 
  Layers, 
  MessageSquare,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import "../components/settings.css";

// FAQ Categories with Lucide icons
const CATEGORIES = [
  { id: "all", label: "All Questions", Icon: HelpCircle },
  { id: "getting-started", label: "Getting Started", Icon: Sparkles },
  { id: "trading", label: "Buying & Selling", Icon: Coins },
  { id: "creators", label: "Minting & Royalties", Icon: Palette },
  { id: "wallets", label: "Wallets & Fees", Icon: Wallet },
  { id: "security", label: "Security & Safety", Icon: ShieldCheck },
];

// FAQ Data structured for Mintora Marketplace
const FAQ_DATA = [
  {
    id: "what-is-mintora",
    category: "getting-started",
    question: "What is Mintora?",
    answer: "Mintora is a next-generation decentralized NFT marketplace that allows creators and collectors to mint, discover, buy, and sell digital collectibles across multiple EVM-compatible networks with ultra-low friction."
  },
  {
    id: "how-to-get-started",
    category: "getting-started",
    question: "How do I get started on Mintora?",
    answer: "Getting started is easy! Click the 'Connect Wallet' button in the top right corner using RainbowKit or any supported Web3 wallet (MetaMask, WalletConnect, Coinbase Wallet, etc.). Once connected, you can set up your profile in Settings and immediately start exploring or minting NFTs."
  },
  {
    id: "supported-networks",
    category: "getting-started",
    question: "Which blockchain networks does Mintora support?",
    answer: "Mintora currently supports Hemi Mainnet. More network will be added SOON!"
  },
  {
    id: "buy-nft",
    category: "trading",
    question: "How do I purchase an NFT?",
    answer: "Navigate to any listed NFT detail page. If it is listed at a fixed price, click 'Buy Now' to complete the transaction immediately. If it is set as an auction, you can enter a bid that meets or exceeds the minimum increment."
  },
  {
    id: "marketplace-fees",
    category: "trading",
    question: "What are Mintora's platform fees?",
    answer: "Mintora charges a competitive 5% fee on successful secondary sales. Creators can also configure creator royalties up to 25%, which are automatically enforced and paid out at the time of sale."
  },
  {
    id: "offers-bids",
    category: "trading",
    question: "How do offers and bids work?",
    answer: "You can make an offer on any NFT—even if it is not currently listed for sale—using wrapped tokens (like WETH). Offers remain active until canceled by you or accepted by the item's current owner."
  },
  {
    id: "how-to-mint",
    category: "creators",
    question: "How do I mint my artwork on Mintora?",
    answer: "Navigate to the 'Create' page, upload your asset (JPG, PNG, WEBP, GIF, MP4, or GLTF up to 100MB), add a title, description, and custom attributes, then hit 'Mint'. Mintora handles metadata pinning to IPFS automatically."
  },
  {
    id: "creator-royalties",
    category: "creators",
    question: "How do creator royalties work on Mintora?",
    answer: "When minting a collection or single item, you can specify a royalty percentage (0% to 10%). Every time your NFT resells on Mintora, the royalty fee is instantly disbursed directly to your creator wallet address."
  },
  {
    id: "supported-wallets",
    category: "wallets",
    question: "Which wallets are compatible with Mintora?",
    answer: "Mintora supports all major Web3 wallets via RainbowKit, including MetaMask, Rainbow, Coinbase Wallet, Trust Wallet, Ledger hardware wallets, and any WalletConnect-compatible application."
  },
  {
    id: "gas-fees",
    category: "wallets",
    question: "Why do I need to pay gas fees?",
    answer: "Gas fees are network transaction fees required by the blockchain to process operations like minting, transferring, or approving token spending. Mintora does not receive or control gas fees."
  },
  {
    id: "account-verification",
    category: "security",
    question: "How do I get my profile or collection verified?",
    answer: "You can apply for verification under 'Settings > Verification'. Requirements include a completed profile (avatar, banner, bio), linked social media accounts, and proof of original work or active creator presence."
  },
  {
    id: "phishing-safety",
    category: "security",
    question: "How can I protect myself from scams?",
    answer: "Always verify that you are on the official Mintora URL. Mintora team members will NEVER ask for your wallet's seed phrase or private keys. Never sign unverified permit requests or click suspicious third-party links."
  }
];

function FaqItem({ faq, isOpen, onToggle }) {
  return (
    <div 
      className={`rounded-2xl border transition-all duration-200 overflow-hidden mb-3 ${
        isOpen 
          ? "bg-secondary/40 border-primary/30 shadow-sm" 
          : "bg-card/50 border-border hover:border-border/80"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left transition-colors focus:outline-none"
      >
        <span className="text-base font-semibold text-foreground pr-4">
          {faq.question}
        </span>
        <div className={`p-1.5 rounded-lg bg-secondary/80 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180 text-primary" : ""}`}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-1 text-sm text-muted-foreground leading-relaxed border-t border-border/40">
          <p className="mt-2">{faq.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function Faq() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openId, setOpenId] = useState("what-is-mintora");
  const filteredFaqs = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      const matchesSearch = 
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleToggle = (id) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="s-layout w-full">
      {/* Sidebar Navigation */}
      <nav className="s-sidebar ml-40">
        <p className="s-sidebar-heading">Help Center</p>
        {CATEGORIES.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`s-nav-btn ${activeCategory === id ? "active" : ""}`}
            onClick={() => setActiveCategory(id)}
          >
            <Icon 
              className="w-4 h-4 shrink-0" 
              style={{ opacity: activeCategory === id ? 1 : 0.6 }} 
            />
            {label}
          </button>
        ))}

        {/* Sidebar Support Box */}
        <div className="mt-8 p-4 rounded-2xl bg-primary/5 border border-primary/10">
          <MessageSquare className="w-5 h-5 text-primary mb-2" />
          <p className="text-xs font-semibold text-foreground mb-1">Need more help?</p>
          <p className="text-[11px] text-muted-foreground mb-3 leading-tight">
            Reach out to our 24/7 support team on Discord.
          </p>
          <a
            href="https://discord.gg/z5GKWefcuB"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Join Mintora Discord <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="s-main ml-60 max-w-3xl">
        {/* Header Title */}
        <div className="mb-6">
          <p className="s-page-title mb-1">Frequently Asked Questions</p>
          <p className="text-sm text-muted-foreground">
            Everything you need to know about trading, minting, and navigating Mintora.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="s-input pl-10 pr-4 h-11 text-sm bg-background/50 focus:bg-background"
            placeholder="Search questions, topics, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {/* FAQ Accordion List */}
        {filteredFaqs.length > 0 ? (
          <div>
            {filteredFaqs.map((faq) => (
              <FaqItem
                key={faq.id}
                faq={faq}
                isOpen={openId === faq.id}
                onToggle={() => handleToggle(faq.id)}
              />
            ))}
          </div>
        ) : (
          <div className="s-soon py-12 border border-dashed border-border rounded-2xl">
            <HelpCircle size={36} className="text-muted-foreground opacity-50 mb-2" />
            <p className="text-sm font-medium text-foreground">No questions found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try searching with a different term or clear your filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-xl text-xs"
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}