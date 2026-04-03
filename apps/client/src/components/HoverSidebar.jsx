import { useState } from "react";
import { BsCollection, BsFillCollectionFill } from "react-icons/bs";
import { IoSettingsOutline, IoSettingsSharp, IoSparkles } from "react-icons/io5";
import { Link, useLocation } from "wouter";
import { BiSolidHome, BiUser, BiChevronLeft } from "react-icons/bi";
import { PiRocketDuotone, PiRocketFill } from "react-icons/pi";

const navItems = [
  { href: "/", icon: BiSolidHome, iconFilled: null, label: "Home" },
  { href: "/collections", icon: BsCollection, iconFilled: BsFillCollectionFill, label: "Collections" },
  { href: "/create", icon: PiRocketDuotone, iconFilled: PiRocketFill, label: "Launchpool" },
  { href: "/profile", icon: BiUser, iconFilled: null, label: "Profile" },
  { href: "/settings", icon: IoSettingsOutline, iconFilled: IoSettingsSharp, label: "Settings" },
];

function NavItem({ item, expanded, isActive }) {
  const [hovered, setHovered] = useState(false);
  const showFilled = (hovered || isActive) && item.iconFilled;
  const IconComponent = showFilled ? item.iconFilled : item.icon;

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-2xl transition-colors group ${
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
      {/* Active indicator dot when collapsed */}
      {!expanded && isActive && (
        <span className="absolute right-1.5 w-1 h-1 rounded-full bg-primary" />
      )}
    </Link>
  );
}

export default function HoverSidebar() {
  const [expanded, setExpanded] = useState(false);
  const [location] = useLocation();

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
            <BiChevronLeft
              className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                expanded ? "rotate-180" : ""
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