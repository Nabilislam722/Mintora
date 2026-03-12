import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FeaturedCarousel() {
  const [slides, setSlides] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const response = await fetch("http://127.0.0.1:3000/api/featured");
        if (!response.ok) throw new Error("Could not fetch data");
        const data = await response.json();
        setSlides(data);
      }
      catch (error) {
        console.error("Error fetching featured slides:", error);
      }
      finally {
        setLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  useEffect(() => {
    if (slides.length === 0) return;

    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length]);

  if (loading) {
    return <div className="h-[320px] md:h-[380px] bg-muted animate-pulse rounded-2xl flex items-center justify-center">Loading Featured...</div>;
  }

  if (slides.length === 0) return null;

  const slide = slides[current];

  return (
    <div className="relative h-[320px] md:h-[380px] overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700"
        style={{ backgroundImage: `url(${slide.bgImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

      <div className="relative h-full container mx-auto px-4 flex items-center">
        <div className="bg-black/40 dark:bg-black/60 backdrop-blur-md rounded-2xl p-6 max-w-md border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            {slide.logoLeft && (
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/20">
                <img src={slide.logoLeft} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            {slide.logoRight && (
              <>
                <span className="text-xl text-white/60">×</span>
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/20">
                  <img src={slide.logoRight} alt="" className="w-full h-full object-cover" />
                </div>
              </>
            )}
          </div>

          <p className="text-sm text-white/70 mb-1">{slide.subtitle}</p>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-white">{slide.title}</h2>

          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl px-5" data-testid="button-carousel-cta">
            {slide.cta}
          </Button>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-2 h-2 rounded-full transition-colors ${idx === current ? "bg-primary" : "bg-white/40"
              }`}
            data-testid={`button-slide-${idx}`}
          />
        ))}
      </div>

      <button
        onClick={() => setCurrent((prev) => (prev - 1 + slides.length) % slides.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors text-white"
        data-testid="button-carousel-prev"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => setCurrent((prev) => (prev + 1) % slides.length)}
        className="absolute right-16 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors text-white"
        data-testid="button-carousel-next"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
