import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform, animate } from 'framer-motion';
import '../components/welcome.css';
import Demo from '../components/Demo';
import Advantages from '../components/Advantages';
import { Link } from 'wouter';

const PARTICLES = [
  { x: '12%', y: '18%', size: 3, color: 'rgba(111,207,151,0.35)', duration: 8, delay: 0 },
  { x: '88%', y: '22%', size: 4, color: 'rgba(255,255,255,0.15)', duration: 11, delay: 1.2 },
  { x: '72%', y: '68%', size: 2, color: 'rgba(111,207,151,0.2)', duration: 9, delay: 2 },
  { x: '22%', y: '75%', size: 5, color: 'rgba(255,255,255,0.08)', duration: 13, delay: 0.5 },
  { x: '55%', y: '12%', size: 2, color: 'rgba(111,207,151,0.25)', duration: 7, delay: 3 },
  { x: '35%', y: '88%', size: 3, color: 'rgba(255,255,255,0.1)', duration: 10, delay: 1.8 },
  { x: '92%', y: '55%', size: 2, color: 'rgba(111,207,151,0.2)', duration: 12, delay: 0.7 },
];

const FEATURES = [
  { icon: '◈', title: 'Adaptive Intelligence', desc: 'Mintora learns your patterns and evolves with your workflow in real time.' },
  { icon: '⬡', title: 'Seamless Integration', desc: 'Plug into your existing stack without friction — APIs, webhooks, and native SDKs.' },
  { icon: '◎', title: 'Privacy-First', desc: 'Your data never leaves your environment. Local-first with optional cloud sync.' },
  { icon: '⬢', title: 'Zero Latency', desc: 'Edge-optimized inference delivers sub-10ms responses at any scale.' },
];

const STATS = [
  { num: '600ms', label: 'Block Time' },
  { num: '100%', label: 'Bitcoin Anchored' },
  { num: 'Zero', label: 'Re-org Risk' },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.22, 1, 0.36, 1], delay } },
});

const EXP = [0.16, 1, 0.3, 1];

/* ─────────────────────────────────────────────────────────────────
   HERO SECTION (Optimized)
───────────────────────────────────────────────────────────────── */
function Hero({ onWatchDemo }) {
  const heroRef = useRef(null);
  const titleRef = useRef(null); // Ref added for CSS-variable injection
  const sweepProgress = useMotionValue(0);
  const introBlur = useMotionValue(40);
  const floatY = useMotionValue(0);
  const floatScale = useMotionValue(1);
  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0);
  const mouseX = useSpring(rawMouseX, { stiffness: 45, damping: 25 });
  const mouseY = useSpring(rawMouseY, { stiffness: 45, damping: 25 });
  const mouseOffset = useTransform(
    [mouseX, mouseY],
    ([x, y]) => (x + y) * 25
  );

  const dynamicGradient = useTransform(sweepProgress, [0, 1], [
    `conic-gradient(from 90deg at 50% 50%, #F8F8F8 0deg, #0000009a 0deg, #aaaaaaec 0deg, #f8f8f8 0deg),
     conic-gradient(from 180deg at 50% 50%, #F8F8F8 0deg, rgb(0, 0, 0) 0deg, #AAAAAA 0deg, #F8F8F8 0deg)`,
    `conic-gradient(from 90deg at 50% 50%, #F8F8F8 0deg, #0000009a 0deg, #aaaaaaec 180deg, #f8f8f8EE 410deg),
     conic-gradient(from 180deg at 50% 50%, #F8F8F8 0deg, rgb(0, 0, 0) 0.04deg, #AAAAAA 356.4deg, #F8F8F8 360deg)`
  ]);

  const hueShift = useTransform(mouseX, [-1, 1], [-45, 45]);
  const combinedFilter = useTransform(
    [hueShift, introBlur],
    ([h, b]) => `blur(${b}px) hue-rotate(${h}deg) brightness(1.1)`
  );

  useEffect(() => {
    animate(sweepProgress, 1, { duration: 3.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 });
    animate(introBlur, 0, { duration: 3, ease: "easeOut", delay: 0.5 });
    const yLoop = animate(floatY, [0, -45, 0], { duration: 15, repeat: Infinity, ease: 'easeInOut' });
    const sLoop = animate(floatScale, [1, 1.08, 1], { duration: 15, repeat: Infinity, ease: 'easeInOut' });

    return () => { yLoop.stop(); sLoop.stop(); };
  }, [sweepProgress, introBlur, floatY, floatScale]);

  // CSS-Variable optimization trick
  useEffect(() => {
    return mouseOffset.on('change', (v) => {
      const el = titleRef.current;
      if (!el) return;
      el.style.setProperty('--g0', `${0 + v}%`);
      el.style.setProperty('--g1', `${45 + v}%`);
      el.style.setProperty('--g2', `${70 + v}%`);
      el.style.setProperty('--g3', `${100 + v}%`);
    });
  }, [mouseOffset]);

  const onMouseMove = (e) => {
    const r = heroRef.current.getBoundingClientRect();
    rawMouseX.set(((e.clientX - r.left) / r.width) * 2 - 1);
    rawMouseY.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  return (
    <div
      className="hero"
      ref={heroRef}
      onMouseMove={onMouseMove}
      onMouseLeave={() => rawMouseX.set(0)}
    >
      {/* Left Light with Sweep + Focus */}
      <motion.div
        className="light left"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        style={{
          background: dynamicGradient,
          y: floatY,
          scaleY: floatScale,
          filter: combinedFilter,
        }}
      />

      {/* Right Light mirrored */}
      <motion.div
        className="light right"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.2 }}
        style={{
          background: dynamicGradient,
          y: floatY,
          scaleY: floatScale,
          scaleX: -1,
          filter: combinedFilter,
        }}
      />

      {/* Particles */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5, duration: 2 }}>
        {PARTICLES.map((p, i) => (
          <motion.div
            key={i}
            className="particle"
            style={{ left: p.x, top: p.y, width: p.size, height: p.size, background: p.color }}
            animate={{ y: [0, -18, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: p.duration, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
          />
        ))}
      </motion.div>

      {/* Content Section */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <motion.div className="eyebrow" {...fadeUp(1.5)}>
          <span className="eyebrow-dot" />
          Now live on — Hemi
        </motion.div>

        <motion.div style={{ filter: combinedFilter }}>
          <motion.h1
            ref={titleRef}
            className="title"
            {...fadeUp(1.7)}
            style={{
              // Reads the variables directly from the DOM, bypassing React renders
              backgroundImage: 'linear-gradient(160deg, #205F3B var(--g0, 0%), #FFFFFF var(--g1, 45%), #7FDDAA var(--g2, 70%), #13643d var(--g3, 100%))',
            }}
          >
            <span className="gradient-text">Introducing to</span>
            <span className="gradient-text big">Mintora</span>
          </motion.h1>
        </motion.div>

        <motion.p className="subtitle" {...fadeUp(1.9)}>
          Experience the speed of a Layer 2 with the immutability of Bitcoin.
        </motion.p>

        <motion.div className="cta-row" {...fadeUp(2.1)}>
          <Link href="/" className="btn">
            Launch →
          </Link>
          {/* Hooked up to scroll layout */}
          <button className="btn-ghost" onClick={onWatchDemo}>Watch demo</button>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="scroll-indicator"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 1, delay: 3.5 }}
      >
        <div className="mouse">
          <motion.div
            className="wheel"
            animate={{ y: [0, 10, 0], opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <span className="scroll-label">Scroll</span>
      </motion.div>
    </div>
  );
}

export default function Welcome() {
  const [page, setPage] = useState(0);
  const [locked, setLocked] = useState(false);
  const rootRef = useRef(null);
  const TOTAL = 3;

  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= TOTAL || locked) return;
    setLocked(true);
    setPage(idx);
    setTimeout(() => setLocked(false), 950);
  }, [locked]);

  // Wheel
  useEffect(() => {
    const el = rootRef.current;
    const onW = e => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 25) return;
      goTo(page + (e.deltaY > 0 ? 1 : -1));
    };
    el?.addEventListener('wheel', onW, { passive: false });
    return () => el?.removeEventListener('wheel', onW);
  }, [page, goTo]);

  // Touch
  useEffect(() => {
    let sy = 0;
    const ts = e => { sy = e.touches[0].clientY; };
    const te = e => {
      const dy = sy - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 50) goTo(page + (dy > 0 ? 1 : -1));
    };
    window.addEventListener('touchstart', ts, { passive: true });
    window.addEventListener('touchend', te, { passive: true });
    return () => {
      window.removeEventListener('touchstart', ts);
      window.removeEventListener('touchend', te);
    };
  }, [page, goTo]);

  // Keyboard
  useEffect(() => {
    const ok = e => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') goTo(page + 1);
      if (e.key === 'ArrowUp' || e.key === 'PageUp') goTo(page - 1);
    };
    window.addEventListener('keydown', ok);
    return () => window.removeEventListener('keydown', ok);
  }, [page, goTo]);

  return (
    <>
      {/* Nav dots */}
      <nav className="nav-dots" aria-label="Page navigation">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <button
            key={i}
            className={`nd${i === page ? ' nd-on' : ''}`}
            onClick={() => goTo(i)}
            aria-label={`Go to page ${i + 1}`}
          />
        ))}
      </nav>

      {/* Fullscreen scroll root */}
      <div className="scroll-root" ref={rootRef}>
        <motion.div
          className="scroll-track"
          animate={{ y: `-${page * 100}vh` }}
          transition={{ duration: 0.88, ease: EXP }}
        >
          {/* Your exact first section, now optimized */}
          <Hero onWatchDemo={() => goTo(1)} />
          <Demo active={page === 1} />
          <Advantages active={page === 2} />
        </motion.div>
      </div>

      {/* FOOTER */}
      <footer className="footer-stripe">
        <span className="footer-brand">Mintora</span>
        <span className="footer-copy">© 2026 Mintora. All rights reserved.</span>
      </footer>
    </>
  );
}