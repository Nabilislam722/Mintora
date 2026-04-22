import React, { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, animate, } from 'framer-motion';
import '../components/welcome.css';

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

export default function Welcome() {
  const heroRef = useRef(null);
  const sweepProgress = useMotionValue(0);
  const introBlur = useMotionValue(40);
  const floatY = useMotionValue(0);
  const floatScale = useMotionValue(1);
  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0); // Added this
  const mouseX = useSpring(rawMouseX, { stiffness: 45, damping: 25 });
  const mouseY = useSpring(rawMouseY, { stiffness: 45, damping: 25 });
  const mouseOffset = useTransform(
    [mouseX, mouseY],
    ([x, y]) => (x + y) * 25
  );


  const dynamicGradient = useTransform(sweepProgress, [0, 1], [
    // Initial State
    `conic-gradient(from 90deg at 50% 50%, #F8F8F8 0deg, #0000009a 0deg, #aaaaaaec 0deg, #f8f8f8 0deg),
     conic-gradient(from 180deg at 50% 50%, #F8F8F8 0deg, rgb(0, 0, 0) 0deg, #AAAAAA 0deg, #F8F8F8 0deg)`,
    // Final State
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

  const onMouseMove = (e) => {
    const r = heroRef.current.getBoundingClientRect();
    rawMouseX.set(((e.clientX - r.left) / r.width) * 2 - 1);
    rawMouseY.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const titleGradient = useTransform(mouseOffset, (v) => {
    return `linear-gradient(160deg, 
    #205F3B ${0 + v}%, 
    #FFFFFF ${45 + v}%, 
    #7FDDAA ${70 + v}%, 
    #13643d ${100 + v}%)`;
  });


  return (
    <>
      {/* HERO  */}
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
              className="title"
              {...fadeUp(1.7)}
              style={{
                backgroundImage: titleGradient,
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
            <button className="btn">Launch →</button>
            <button className="btn-ghost">Watch demo</button>
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

     {/* Featured section */}

      {/* FOOTER  */}
      <footer className="footer-stripe">
        <span className="footer-brand">Mintora</span>
        <span className="footer-copy">© 2026 Mintora. All rights reserved.</span>
      </footer>
    </>
  );
}