export default function VeHemiBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed -left-[30%] -right-[10%] -bottom-[35%] h-[85%] z-0 opacity-[0.35] dark:opacity-20"
      style={{
        background:
          "radial-gradient(closest-side, hsl(var(--primary)), hsl(var(--primary) / 0.7) 2%, hsl(var(--primary) / 0.3) 30%, hsl(var(--primary) / 0.08) 45%, transparent)",
      }}
    />
  );
}
