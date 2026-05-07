import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Advantages.css';

const EXP = [0.16, 1, 0.3, 1];

/* ── Figma design canvas ─────────────────────────────────── */
const DW = 1280;
const DH = 720;

const DIAMOND = { x: 550, y: 222, w: 159.88, h: 158.32 };
const DC      = { x: DIAMOND.x + DIAMOND.w / 2, y: DIAMOND.y + DIAMOND.h / 2 };

const CARD_W           = 211;
const CARD_H_COLLAPSED = 72;

/* ── Hardcoded card data ─────────────────────────────────── */
const CARD_CHEAP = {
  id: 'cheap', side: 'left',
  rect: { x: 200, y: 150, w: CARD_W, h: CARD_H_COLLAPSED },
  accent: '#6FCF97', icon: '◈',
  label: 'LOW COST',
  title: 'Trade for fractions of a cent',
  stat: '~$0.001', statLabel: 'avg. tx cost',
  body: "Hemi's optimised execution layer compresses gas to near-zero. List, bid, and settle without fees eating your margins.",
  bullets: ['~$0.001 avg. transaction cost', 'No hidden protocol fees', 'Gas abstraction built-in'],
};

const CARD_SECURE = {
  id: 'secure', side: 'left',
  rect: { x: 200, y: 440, w: CARD_W, h: CARD_H_COLLAPSED },
  accent: '#A78BFA', icon: '◎',
  label: 'BATTLE-TESTED',
  title: 'Bitcoin-grade security',
  stat: '15yr+', statLabel: 'Bitcoin uptime',
  body: 'Every Mintora transaction is finalized against the longest proof-of-work chain in history. No single validator can rewrite your trade.',
  bullets: ['Finality backed by Bitcoin PoW', 'No re-org risk', '15+ years of unbroken uptime'],
};

const CARD_HEMI = {
  id: 'hemi', side: 'right',
  rect: { x: 850, y: 150, w: CARD_W, h: CARD_H_COLLAPSED },
  accent: '#FF4600', icon: '⬡',
  label: 'HEMI NETWORK',
  title: 'Bitcoin-Secure Modular L2',
  stat: '600ms', statLabel: 'Target Finality',
  body: 'Utilizes Proof-of-Proof (PoP) consensus to inherit Bitcoin’s full hash power. Hemi functions as a high-performance EVM layer that checkpoints state directly to the BTC ledger.',
  bullets: [
    'PoP (Proof-of-Proof) Consensus',
    'Inherited PoW Security',
    'Optimistic-Settlement Lifecycle'
  ],
};

const CARD_OPEN = {
  id: 'open', side: 'right',
  rect: { x: 850, y: 440, w: CARD_W, h: CARD_H_COLLAPSED },
  accent: '#0BA14B', icon: '⬢',
  label: 'HYBRID PAYMENT',
  title: 'Fast & Secure way to get payment',
  stat: '100%', statLabel: 'on-chain',
  body: "Our architecture utilizes a Segmented Triple-Column Ledger to isolate protocol fees, user escrow, and pending withdrawals. We employ an Asynchronous Pull-Payment pattern for auctions to mitigate reentrancy risks, while maintaining Synchronous Push-Payments for instant secondary market liquidity.",
  bullets: ['Non-custodial Pull-Payment Escrow', 'Atomic On-chain Settlement'],
};

const ALL_CARDS = [CARD_CHEAP, CARD_SECURE, CARD_HEMI, CARD_OPEN];

/* ── Connector path — EXACTLY from your original code ───── */
function bentPath(x1, y1, x2, y2, side) {
  const breakoutDistance = 90;
  const elbowX = side === 'left' ? x1 + breakoutDistance : x1 - breakoutDistance;
  const elbowY = y1;
  return `M ${x1} ${y1} L ${elbowX} ${elbowY} L ${x2} ${y2}`;
}

/* ── Connectors ─────────────────────────────────────────── */
function Connectors({ active, hoveredId }) {
  const lines = ALL_CARDS.map((c) => {
    const x1   = c.side === 'left' ? c.rect.x + c.rect.w : c.rect.x;
    const y1   = c.rect.y + c.rect.h / 2;
    const path = bentPath(x1, y1, DC.x, DC.y, c.side);
    return { id: c.id, accent: c.accent, side: c.side, x1, y1, path };
  });

  return (
    <svg
      className="adv-connectors"
      viewBox={`0 0 ${DW} ${DH}`}
      preserveAspectRatio="none"
    >
      <defs>
        {lines.map((l) => (
          <filter key={`f-${l.id}`} id={`glow-${l.id}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>

      {/* base dim paths */}
      {lines.map((l, i) => (
        <motion.path
          key={`base-${l.id}`}
          d={l.path}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
          fill="none"
          strokeLinejoin="round"
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.3 + i * 0.07 }}
        />
      ))}

      {/* accent glow on hover */}
      {lines.map((l) => (
        <motion.path
          key={`glow-${l.id}`}
          d={l.path}
          stroke={l.accent}
          strokeWidth="3"
          fill="none"
          filter={`url(#glow-${l.id})`}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ opacity: 0, pathLength: 0 }}
          animate={hoveredId === l.id ? { opacity: 1, pathLength: 1 } : { opacity: 0, pathLength: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      ))}

      {/* travelling dot */}
      {lines.map((l) => {
        const on = hoveredId === l.id;
        return (
          <motion.circle
            key={`dot-${l.id}`}
            r="5"
            fill={l.accent}
            filter={`url(#glow-${l.id})`}
            initial={{ opacity: 0 }}
            animate={on ? { opacity: [0, 1, 1, 0] } : { opacity: 0 }}
            transition={on ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : {}}
          >
            {on && (
              <animateMotion dur="0.9s" repeatCount="indefinite" path={l.path} />
            )}
          </motion.circle>
        );
      })}
    </svg>
  );
}

/* ── Single expandable card — hover to expand ────────────── */
function AdvCard({ card, active, onHover }) {
  const [hovered, setHovered] = useState(false);
  const { rect, accent, icon, label, title, stat, statLabel, body, bullets } = card;

  const posStyle = {
    left:      `${(rect.x / DW) * 100}%`,
    top:       `${(rect.y / DH) * 100}%`,
    width:     `${(rect.w / DW) * 100}%`,
    '--accent': accent,
  };

  return (
    <motion.div
      className="adv-card"
      style={posStyle}
      initial={{ opacity: 0, y: 14 }}
      animate={active ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: EXP, delay: 0.2 }}
      onHoverStart={() => { setHovered(true);  onHover(card.id); }}
      onHoverEnd  ={() => { setHovered(false); onHover(null);    }}
    >
      {/* ── Always-visible header ── */}
      <div className="adv-card-top">
        <span className="adv-card-label">{label}</span>
        <span className="adv-card-icon">{icon}</span>
      </div>

      <div className="adv-card-title">{title}</div>

      <div className="adv-card-stat">
        {stat      && <span className="adv-card-stat-num">{stat}</span>}
        {statLabel && <span className="adv-card-stat-label">{statLabel}</span>}
      </div>

      {/* ── Detail — slides in on hover ── */}
      <AnimatePresence initial={false}>
        {hovered && (
          <motion.div
            key="expand"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EXP }}
            style={{ overflow: 'hidden' }}
          >
            <div className="adv-card-divider" />
            <p className="adv-card-body">{body}</p>
            <ul className="adv-card-bullets">
              {bullets.map((b, i) => (
                <li key={i} className="adv-card-bullet">{b}</li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom accent bar ── */}
      <motion.div
        className="adv-card-bar"
        initial={{ scaleX: 0 }}
        animate={active ? { scaleX: 1 } : {}}
        transition={{ duration: 0.9, ease: EXP, delay: 0.5 }}
      />
    </motion.div>
  );
}

/* ── Main export ─────────────────────────────────────────── */
export default function Advantages({ active }) {
  const wrapRef             = useRef(null);
  const [scale, setScale]   = useState(1);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    function measure() {
      if (!wrapRef.current) return;
      const { width, height } = wrapRef.current.getBoundingClientRect();
      setScale(Math.min(width / DW, height / DH));
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const dSize = DIAMOND.w * scale;

  return (
    <div
      ref={wrapRef}
      className="adv-root"
      style={{ '--scale': scale }}
    >
      {/* ── Eyebrow — centred via .adv-header wrapper ── */}
      <motion.div
        className="adv-header"
        initial={{ opacity: 0, y: 10 }}
        animate={active ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: EXP, delay: 0.1 }}
      >
        <span className="adv-eyebrow">Why Mintora?</span>
      </motion.div>

      {/* ── Connectors (unchanged from your original) ── */}
      <Connectors active={active} hoveredId={hoveredId} />

      {/* ── Diamond ── */}
      <div
        className="adv-diamond-wrap"
        style={{
          left:   `${(DC.x / DW) * 100}%`,
          top:    `${(DC.y / DH) * 100}%`,
          width:  dSize,
          height: dSize,
        }}
      >
        <motion.div
          className="adv-diamond"
          style={{ width: dSize, height: dSize }}
          initial={{ opacity: 0, scale: 0.4, rotate: 45 }}
          animate={active ? { opacity: 1, scale: 1, rotate: 45 } : { opacity: 0, scale: 0.4, rotate: 45 }}
          transition={{ duration: 0.75, ease: EXP, delay: 0.05 }}
        >
          <span className="adv-diamond-label" style={{ rotate: '-45deg' }}>Core</span>
        </motion.div>
      </div>

      {/* ── Cards (hardcoded, no map) ── */}
      <AdvCard card={CARD_CHEAP}  active={active} onHover={setHoveredId} />
      <AdvCard card={CARD_SECURE} active={active} onHover={setHoveredId} />
      <AdvCard card={CARD_HEMI}   active={active} onHover={setHoveredId} />
      <AdvCard card={CARD_OPEN}   active={active} onHover={setHoveredId} />

      {/* ── Powered-by ── */}
      <motion.div
        className="adv-powered"
        style={{ bottom: `${(54 / DH) * 100}%` }}
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.85 }}
      >
        <span>Powered by</span>
        <span>
          <img src="./hemi_reverse.png" alt="Hemi" style={{ width: `${64 * scale}px` }} />
        </span>
      </motion.div>

      {/* ── Footer ── */}
      <footer className="footer-stripe" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <span className="footer-brand">Mintora</span>
        <div>
          
        </div>
        <span className="footer-copy">© 2026 Mintora. All rights reserved.</span>
      </footer>
    </div>
  );
}