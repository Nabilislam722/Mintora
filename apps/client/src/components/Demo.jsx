import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './demo.css';
import introVideo from './intro.mp4';

const EXP = [0.16, 1, 0.3, 1];

export default function Demo({ active }) {
    const [playing, setPlaying] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
        if (!videoRef.current) return;
        if (active) {
            videoRef.current.play().catch(() => { });
            setPlaying(true);
        } else {
            videoRef.current.pause();
            setPlaying(false);
        }
    }, [active]);

    const toggle = () => {
        if (!videoRef.current) return;
        if (playing) { videoRef.current.pause(); setPlaying(false); }
        else { videoRef.current.play(); setPlaying(true); }
    };

    return (
        <div className="pg demo-pg" style={{ fontFamily: '"Instrument Sans", sans-serif' }}>
            <div className="demo-grid-bg" />
            <div className="demo-glow" />

            {/* Header - Tightened spacing */}
            <motion.div className="demo-hd"
                initial={{ opacity: 0, y: 20 }}
                animate={active ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8, ease: EXP, delay: 0.1 }}>
                <span className="demo-eyebrow" style={{ fontWeight: 600, letterSpacing: '0.05em' }}>LIVE DEMO</span>
                <h2 className="demo-title" style={{ fontWeight: 700, fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
                    See Mintora in action
                </h2>
                <p className="demo-sub" style={{ fontWeight: 400, opacity: 0.8, maxWidth: '600px' }}>
                    Watch how listing, bidding, and settling an NFT takes under 3 seconds on Hemi.
                </p>
            </motion.div>

            {/* Player Wrapper - Added subtle shadow & depth */}
            <motion.div className="demo-wrap"
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={active ? { opacity: 1, scale: 1, y: 0 } : {}}
                transition={{ duration: 0.9, ease: EXP, delay: 0.2 }}>

                <div className="demo-player" style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                    {/* Browser chrome */}
                    <div className="demo-chrome">
                        <div className="demo-dots">
                            <span style={{ background: '#FF5F57' }} />
                            <span style={{ background: '#FEBC2E' }} />
                            <span style={{ background: '#28C840' }} />
                        </div>
                        <div className="demo-url" style={{ fontWeight: 500 }}>mintora.app/live</div>
                        <div style={{ width: 48 }} />
                    </div>

                    {/* Video area */}
                    <div className="demo-vid-area" onClick={toggle} style={{ cursor: 'pointer', position: 'relative' }}>
                        <video
                            ref={videoRef}
                            className="demo-video"
                            loop muted playsInline
                            src={introVideo}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block'
                            }}
                        />

                        {/* Animated UI placeholder - Now fades out when playing */}
                        <motion.div
                            className="demo-placeholder"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: playing ? 0 : 1 }}
                            transition={{ duration: 0.4 }}
                            style={{
                                pointerEvents: playing ? 'none' : 'auto',
                                position: 'absolute',
                                inset: 0,
                                zIndex: 1
                            }}
                        >
                            <div className="mock-nav" style={{ fontWeight: 500 }}>
                                {['Explore', 'Listings', 'Auctions', 'My NFTs'].map(t => (
                                    <span key={t} className={t === 'Listings' ? 'mock-active' : ''}>{t}</span>
                                ))}
                            </div>
                            <div className="mock-grid">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <motion.div key={i} className="mock-card"
                                        animate={{ opacity: [0.4, 0.75, 0.4] }}
                                        transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}>
                                        <div className="mock-img" style={{
                                            background: `linear-gradient(135deg,hsl(${140 + i * 25},40%,15%),hsl(${160 + i * 20},30%,22%))`
                                        }} />
                                        <div className="mock-info">
                                            <div className="mock-name" />
                                            <div className="mock-price" />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        <AnimatePresence>
                            {!playing && (
                                <motion.div className="demo-play-overlay"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.2 }}>
                                    <div className="demo-play-btn">
                                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                            <polygon points="5,2 20,11 5,20" fill="white" />
                                        </svg>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Progress bar */}
                    <div className="demo-prog-track" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <motion.div className="demo-prog-fill"
                            style={{ originX: 0, height: '100%', background: '#6FCF97' }}
                            animate={playing ? { scaleX: [0, 1] } : { scaleX: 0 }}
                            transition={{ duration: 30, ease: 'linear', repeat: playing ? Infinity : 0 }} />
                    </div>
                </div>

                {/* Floating stat bubbles - Styled for Instrument Sans */}
                {[
                    { label: '', val: 'High speed', style: { left: '-15%', top: '15%' }, accent: '#6FCF97', dx: -20 },
                    { label: 'Platform Fee', val: '~5%', style: { right: '-15%', top: '15%' }, accent: '#A78BFA', dx: 20 },
                    { label: 'Finality', val: 'Bitcoin', style: { left: '-15%', bottom: '20%' }, accent: '#F7931A', dx: -20 },
                ].map((b, i) => (
                    <motion.div key={i} className="bubble flex items-center" style={{ ...b.style, padding: '12px 20px', borderRadius: '100px' }}
                        initial={{ opacity: 0, x: b.dx }}
                        animate={active ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.8, ease: EXP, delay: 0.5 + i * 0.1 }}>
                        <span className="bubble-val" style={{ color: b.accent, fontWeight: 700, display: 'block' }}>{b.val}</span>
                        <span className="bubble-lbl" style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.6 }}>{b.label}</span>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}