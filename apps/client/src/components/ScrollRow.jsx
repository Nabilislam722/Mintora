import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const arrowCls =
  "absolute top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-border border border-white/10 flex items-center justify-center shadow-lg hover:bg-border/40 transition-colors";

// A single row that scrolls sideways, with arrows and faded edges while there's more to see
export default function ScrollRow({ children, className = "" }) {
  const ref = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const check = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  // After every render, since the cards inside may have changed
  useEffect(check);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  // A screenful at a time
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="relative min-w-0">
      {canLeft && (
        <button type="button" aria-label="Scroll left" onClick={() => scroll(-1)} className={`${arrowCls} left-0 -translate-x-3`}>
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {canRight && (
        <button type="button" aria-label="Scroll right" onClick={() => scroll(1)} className={`${arrowCls} right-0 translate-x-3`}>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
      {canLeft && <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-[5] pointer-events-none" />}
      {canRight && <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-[5] pointer-events-none" />}

      <div
        ref={ref}
        className={`flex gap-4 overflow-x-auto scroll-smooth pb-1 ${className}`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
    </div>
  );
}
