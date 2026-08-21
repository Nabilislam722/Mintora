import { useState, useId } from "react";
import { motion } from "framer-motion";
import { IoSparkles } from "react-icons/io5";
import { Link, useLocation } from "wouter";
import { BiChevronLeft } from "react-icons/bi";
import { navItems } from "../lib/navItems";
import { useLayoutPreferences } from "../context/LayoutPreferencesContext";


function GradientSweepIcon({ Icon, size = 20, duration = 3 }) {
  const maskId = useId();
  const rectWidth = size * 3;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="flex-shrink-0"
      style={{ display: "block" }}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={size} height={size}>
        <Icon size={size} color="#ffffff" />
      </mask>

      <g mask={`url(#${maskId})`}>
        <motion.rect
          y="0"
          width={rectWidth}
          height={size}
          fill={`url(#${maskId}-gradient)`}
          animate={{ x: [-(rectWidth - size), 0] }}
          transition={{ duration, repeat: Infinity, ease: "linear" }}
        />
      </g>

      <defs>
        <linearGradient id={`${maskId}-gradient`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="50%" stopColor="hsl(var(--accent))" />
          <stop offset="100%" stopColor="hsl(var(--primary))" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function NavItem({ item, expanded, isActive, position }) {
  const [hovered, setHovered] = useState(false);
  const showFilled = (hovered || isActive) && item.iconFilled;
  const IconComponent = showFilled ? item.iconFilled : item.icon;
  const isHighlight = !!item.highlight;

  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-3 rounded-2xl transition-colors group overflow-hidden ${
        isHighlight
          ? "bg-secondary/40"
          : isActive
          ? "bg-secondary"
          : "hover:bg-secondary"
      } ${expanded ? "px-3 py-3" : "px-2 py-3 justify-center"}`}
      data-testid={`link-sidebar-${item.label.toLowerCase()}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Moving gradient glow layer */}
      {isHighlight && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-10 group-hover:opacity-35 transition-opacity"
          style={{ backgroundSize: "200% 100%" }}
          animate={{ backgroundPosition: ["0% 50%", "200% 50%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Pulsing ring for extra emphasis */}
      {isHighlight && (
        <motion.div
          className="absolute inset-0 rounded-2xl ring-1 ring-primary/40"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {isHighlight ? (
        <GradientSweepIcon Icon={IconComponent} size={20} duration={3} />
      ) : (
        <IconComponent
          className={`w-5 h-5 flex-shrink-0 transition-colors ${
            isActive || hovered ? "text-primary" : "text-muted-foreground"
          }`}
        />
      )}

      {expanded && isHighlight && (
        <motion.span
          className="relative font-semibold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent"
          style={{ backgroundSize: "200% 100%" }}
          animate={{ backgroundPosition: ["0% 50%", "200% 50%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          {item.label}
        </motion.span>
      )}

      {expanded && !isHighlight && (
        <span className={`font-medium ${isActive ? "text-primary" : ""}`}>
          {item.label}
        </span>
      )}

      {!expanded && isActive && !isHighlight && (
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