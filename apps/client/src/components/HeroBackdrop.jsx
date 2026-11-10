// The home page's background: a heavily blurred copy of the hero banner on show, behind the navbar and the
// top of the page, fading into the page's own background further down. Each new banner fades in over the last.
export default function HeroBackdrop({ image }) {
  if (!image) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-16 h-[115vh] -z-10 overflow-hidden">
      <div
        key={image}
        className="absolute -inset-[10%] bg-cover bg-center blur-[90px] saturate-150 opacity-60 dark:opacity-70 animate-in fade-in duration-1000 motion-reduce:animate-none"
        style={{ backgroundImage: `url("${image}")` }}
      />
      {/* Darkens it a touch so text stays readable, then fades it out into the page */}
      <div className="absolute inset-0 bg-background/30" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/70 via-60% to-background" />
    </div>
  );
}
