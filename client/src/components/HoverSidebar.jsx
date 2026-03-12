import { useState } from "react";
import { Home, LayoutGrid, PlusCircle, User, Sparkles, ChevronLeft } from "lucide-react";
import { Link } from "wouter";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/collections", icon: LayoutGrid, label: "Collections" },
  { href: "/create", icon: PlusCircle, label: "Create" },
  { href: "/profile", icon: User, label: "Profile" },
];

export default function HoverSidebar() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="fixed right-0 top-16 bottom-0 z-40 flex"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        className={`h-full bg-card border-l border-border transition-all duration-300 ease-in-out ${
          expanded ? "w-80 bg-card/70 backdrop-blur-lg" : "w-16"
        }`}
      >
        <div className="p-2 pt-4">
          <div className={`flex items-center gap-2 px-2 mb-4 ${expanded ? "justify-start" : "justify-center"}`}>
            <ChevronLeft className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
            {expanded && <span className="text-sm text-muted-foreground">Menu</span>}
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl hover:bg-secondary transition-colors group ${
                  expanded ? "px-3 py-3" : "px-2 py-3 justify-center"
                }`}
                data-testid={`link-sidebar-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                {expanded && <span className="font-medium">{item.label}</span>}
              </Link>
            ))}
          </nav>
        </div>

        {expanded && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-secondary rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium">Explore NFTs</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Discover unique digital collectibles .
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
