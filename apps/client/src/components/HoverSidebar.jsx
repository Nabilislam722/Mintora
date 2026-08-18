import { useState } from "react";
import { IoSparkles } from "react-icons/io5";
import { Link, useLocation } from "wouter";
import { BiChevronLeft } from "react-icons/bi";
import { navItems } from "../lib/navItems";
import { useLayoutPreferences } from "../context/LayoutPreferencesContext";

function NavItem({ item, expanded, isActive, position }) {
  const [hovered, setHovered] = useState(false);
  const showFilled = (hovered || isActive) && item.iconFilled;
  const IconComponent = showFilled ? item.iconFilled : item.icon;

  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-3 rounded-2xl transition-colors group ${
        isActive ? "bg-secondary" : "hover:bg-secondary"
      } ${expanded ? "px-3 py-3" : "px-2 py-3 justify-center"}`}
      data-testid={`link-sidebar-${item.label.toLowerCase()}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <IconComponent
        className={`w-5 h-5 flex-shrink-0 transition-colors ${
          isActive || hovered ? "text-primary" : "text-muted-foreground"
        }`}
      />
      {expanded && (
        <span className={`font-medium ${isActive ? "text-primary" : ""}`}>
          {item.label}
        </span>
      )}
      {!expanded && isActive && (
        <span
          className={`absolute w-1 h-1 rounded-full bg-primary ${
            position === "left" ? "left-1.5" : "right-1.5"
          }`}
        />
      )}
    </Link>
  );
}

export default function HoverSidebar() {
  const [expanded, setExpanded] = useState(false);
  const [location] = useLocation();
  const { sidebarPosition } = useLayoutPreferences();
  const isLeft = sidebarPosition === "left";

  return (
    <div
      className={`fixed top-16 bottom-0 z-40 hidden md:flex ${isLeft ? "left-0" : "right-0"}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        className={`h-full bg-card transition-all duration-300 ease-in-out ${
          isLeft ? "border-r border-border" : "border-l border-border"
        } ${expanded ? "w-80 bg-card/70 backdrop-blur-lg" : "w-16"}`}
      >
        <div className="p-2 pt-4">
          <div className={`flex items-center gap-2 px-2 mb-4 ${expanded ? "justify-start" : "justify-center"}`}>
            <BiChevronLeft
              className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                isLeft ? (expanded ? "" : "rotate-180") : (expanded ? "rotate-180" : "")
              }`}
            />
            {expanded && <span className="text-sm text-muted-foreground">Menu</span>}
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                expanded={expanded}
                position={sidebarPosition}
                isActive={
                  item.href === "/"
                    ? location === "/"
                    : location.startsWith(item.href)
                }
              />
            ))}
          </nav>
        </div>

        {expanded && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-secondary rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <IoSparkles className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium">Explore NFTs</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Discover unique digital collectibles.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}