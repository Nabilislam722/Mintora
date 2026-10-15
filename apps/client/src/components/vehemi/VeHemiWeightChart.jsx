import { useState } from "react";
import { fmt, unlockDate } from "@/lib/vehemi";

const MILESTONES = [[90, "In 3 months"], [365, "In 1 year"], [730, "In 2 years"]];

// Linear decay from today's weight to 0 at unlock; x and y both run 0–100 in the plot
export default function VeHemiWeightChart({ weight, days }) {
  const [hover, setHover] = useState(null); // days from today
  const at = (d) => weight * (1 - d / days);
  const x = hover === null ? null : (hover / days) * 100;
  const step = Math.max(1, Math.round(days / 24));

  const onPointerMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * days));
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(days, (h ?? 0) + step));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? 0) - step));
    else return;
    e.preventDefault();
  };

  const milestones = [
    [0, "Today"],
    ...MILESTONES.filter(([d]) => d < days),
    [days, "Unlock"],
  ];

  return (
    <div>
      <div className="flex gap-3">
        <div className="relative w-14 shrink-0 h-44 text-[11px] text-muted-foreground tabular-nums text-right">
          {[[0, weight], [50, weight / 2], [100, 0]].map(([top, v]) => (
            <span key={top} className="absolute right-0 -translate-y-1/2" style={{ top: `${top}%` }}>{fmt(v)}</span>
          ))}
        </div>

        <div
          tabIndex={0}
          aria-label="Voting weight over time. Use the left and right arrow keys to move through dates."
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(0)}
          onBlur={() => setHover(null)}
          onKeyDown={onKeyDown}
          className="relative flex-1 h-44 cursor-crosshair outline-none rounded focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
            {[0, 50, 100].map((y) => (
              <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d="M0 0 L100 100 L0 100 Z" fill="hsl(var(--primary))" fillOpacity="0.1" />
            <path d="M0 0 L100 100" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="absolute left-0 top-0 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />

          {x !== null && (
            <>
              <div className="absolute inset-y-0 w-px bg-muted-foreground/40 pointer-events-none" style={{ left: `${x}%` }} />
              <span
                className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card pointer-events-none"
                style={{ left: `${x}%`, top: `${x}%` }}
              />
              <div
                className="absolute pointer-events-none whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-lg"
                style={{
                  left: `${x}%`,
                  top: `${x}%`,
                  transform: `translate(${x > 70 ? "calc(-100% - 10px)" : "10px"}, ${x < 30 ? "10px" : "calc(-100% - 10px)"})`,
                }}
              >
                <p className="text-sm font-semibold tabular-nums">{fmt(at(hover))}</p>
                <p className="text-[11px] text-muted-foreground">{hover === 0 ? "Today" : unlockDate(hover)}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-between pl-[4.25rem] mt-2 text-[11px] text-muted-foreground">
        <span>Today</span>
        <span>{unlockDate(days)}</span>
      </div>

      <dl className="flex flex-wrap gap-2 mt-5">
        {milestones.map(([d, label]) => (
          <div key={d} className="flex-1 min-w-[7rem] rounded-xl bg-secondary/40 border border-white/5 px-3 py-2">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{fmt(at(d))}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
