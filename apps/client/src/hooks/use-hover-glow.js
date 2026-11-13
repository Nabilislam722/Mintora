import { useRef, useState } from "react";

// Props for a card frame whose border glows toward the cursor while hovered; `idle` is its background otherwise
export function useHoverGlow(idle) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);

  const onMouseMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: ((e.clientX - rect.left) / rect.width) * 180, y: ((e.clientY - rect.top) / rect.height) * 180 });
  };

  return {
    ref,
    onMouseMove,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    style: {
      background: hovered
        ? `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(59,130,246,0.5), rgba(13,160,74,1), transparent 70%)`
        : idle,
    },
  };
}
