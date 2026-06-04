import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../lib/auth-context';
import {
  QrCode, FileText, Globe, ArrowRight, Check,
  ChevronRight, Receipt, BadgeCheck, Banknote,
} from 'lucide-react';

// ─── Design tokens (light, warm, green-anchored — NOT cream) ─────────────────
const C = {
  bg:       'oklch(0.985 0.006 150)',  // clean near-white, faint green warmth
  surface:  'oklch(0.965 0.013 152)',  // subtly tinted panel
  raised:   'oklch(1 0 0)',            // pure white cards
  border:   'oklch(0.89 0.016 152)',
  accent:   'oklch(0.52 0.13 162)',    // green — dark enough for white text
  accentBg: 'oklch(0.93 0.05 162)',    // soft green chip
  heroAccent: 'oklch(0.52 0.16 248)',  // blue — hero headline highlight
  text:     'oklch(0.28 0.035 165)',   // deep green-ink
  muted:    'oklch(0.46 0.03 165)',    // AA-safe body on white
  faint:    'oklch(0.52 0.024 165)',   // AA-safe fine print
} as const;

// Comic illustration palette (warm, playful — used only in the hero art)
const ART = {
  ink:    'oklch(0.30 0.045 165)',
  paper:  'oklch(0.995 0.006 95)',
  green:  'oklch(0.55 0.145 162)',
  amber:  'oklch(0.82 0.15 82)',
  coral:  'oklch(0.70 0.17 28)',
  sky:    'oklch(0.72 0.12 235)',
  bar:    'oklch(0.90 0.02 160)',
} as const;

// ─── Scoped styles (hover, focus, motion, responsive) ───────────────────────
const STYLES = `
  .lp-nav-link   { transition: color 0.15s ease; }
  .lp-nav-link:hover { color: ${C.text} !important; }

  .lp-primary { transition: background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease; cursor: pointer; }
  .lp-primary:hover { background: oklch(0.47 0.13 162) !important; transform: translateY(-1px); box-shadow: 0 8px 20px oklch(0.52 0.13 162 / 0.28); }
  .lp-primary:active { transform: translateY(0); }

  .lp-ghost { transition: border-color 0.15s ease, background 0.15s ease; }
  .lp-ghost:hover { border-color: oklch(0.70 0.10 162) !important; background: ${C.surface} !important; }

  .lp-outline { transition: background 0.15s ease, border-color 0.15s ease; }
  .lp-outline:hover { background: ${C.surface} !important; border-color: oklch(0.70 0.10 162) !important; }

  .lp-primary:focus-visible,
  .lp-ghost:focus-visible,
  .lp-outline:focus-visible,
  .lp-nav-link:focus-visible {
    outline: 2px solid ${C.accent};
    outline-offset: 3px;
    border-radius: 8px;
  }

  .lp-feature-highlight { transition: border-color 0.2s ease, transform 0.2s ease; }
  .lp-feature-highlight:hover { border-color: oklch(0.72 0.10 162) !important; }
  .lp-card-tile { transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s ease; }
  .lp-card-tile:hover { transform: translateY(-4px) rotate(0deg) scale(1.03) !important; box-shadow: 0 18px 34px oklch(0.4 0.04 260 / 0.30) !important; }

  .lp-feature-card { transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease; }
  .lp-feature-card:hover {
    border-color: oklch(0.78 0.08 162) !important;
    transform: translateY(-3px);
    box-shadow: 0 16px 32px oklch(0.55 0.04 162 / 0.10);
  }

  /* ── Comic invoice illustration motion ── */
  @keyframes lp-bob   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
  @keyframes lp-coin  { 0%,100% { transform: translateY(0) rotate(-10deg); } 50% { transform: translateY(-18px) rotate(12deg); } }
  @keyframes lp-twink { 0%,100% { opacity: 0.25; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.05); } }
  @keyframes lp-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
  @keyframes lp-dash  { to { stroke-dashoffset: 0; } }

  .lp-illo-bob   { animation: lp-bob 6s ease-in-out infinite; }
  .lp-illo-coin  { animation: lp-coin 4.2s ease-in-out infinite; }
  .lp-illo-tag   { animation: lp-pulse 3s ease-in-out infinite; }
  .lp-illo-s1    { animation: lp-twink 2.8s ease-in-out infinite; }
  .lp-illo-s2    { animation: lp-twink 3.6s ease-in-out 0.6s infinite; }
  .lp-illo-s3    { animation: lp-twink 2.2s ease-in-out 1.1s infinite; }
  .lp-illo-check { stroke-dasharray: 40; stroke-dashoffset: 40; animation: lp-dash 0.9s ease-out 0.7s forwards; }

  @media (prefers-reduced-motion: reduce) {
    .lp-motion * { transition-duration: 0.01ms !important; }
    .lp-illo-bob, .lp-illo-coin, .lp-illo-tag,
    .lp-illo-s1, .lp-illo-s2, .lp-illo-s3 { animation: none !important; }
    .lp-illo-check { stroke-dashoffset: 0; animation: none !important; }
  }
`;

// ─── Scroll-reveal wrapper ───────────────────────────────────────────────────
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-56px' }}
      transition={reduced ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── Hero: animated comic-style invoice illustration ─────────────────────────
function ComicInvoice() {
  const reduced = useReducedMotion();
  const items = [
    { c: ART.coral, w: 84,  amt: '12,000' },
    { c: ART.amber, w: 64,  amt: '38,500' },
    { c: ART.sky,   w: 74,  amt: '22,300' },
  ];
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.9, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'relative', width: 'min(340px, 80vw)', flexShrink: 0 }}
      aria-hidden="true"
    >
      {/* floating baht coin */}
      <div className="lp-illo-coin" style={{
        position: 'absolute', top: -18, left: -14, zIndex: 3,
        width: 52, height: 52, borderRadius: '50%',
        background: ART.amber, border: `3px solid ${ART.ink}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, fontWeight: 800, color: ART.ink,
        boxShadow: `0 8px 16px oklch(0.7 0.15 82 / 0.4)`,
      }}>฿</div>

      {/* sparkles */}
      <Spark className="lp-illo-s1" style={{ top: 24, right: -10 }} color={ART.green} />
      <Spark className="lp-illo-s2" style={{ bottom: 60, left: -18 }} color={ART.coral} />
      <Spark className="lp-illo-s3" style={{ bottom: 8, right: 28 }} color={ART.amber} />

      {/* "รอชำระ" comic tag */}
      <div className="lp-illo-tag" style={{
        position: 'absolute', top: 40, right: -6, zIndex: 3,
        background: ART.amber, color: ART.ink, border: `2.5px solid ${ART.ink}`,
        borderRadius: 100, padding: '5px 14px', fontSize: 13, fontWeight: 800,
        transform: 'rotate(6deg)', boxShadow: `0 4px 0 ${ART.ink}`,
      }}>รอชำระ</div>

      <div className="lp-illo-bob" style={{ transform: 'rotate(-4deg)' }}>
        <svg viewBox="0 0 300 384" width="100%" role="img"
             style={{ filter: `drop-shadow(0 26px 36px oklch(0.5 0.06 162 / 0.22))`, display: 'block' }}>
          {/* paper */}
          <rect x="6" y="6" width="288" height="372" rx="20" fill={ART.paper} stroke={ART.ink} strokeWidth="3.5" />
          {/* green header */}
          <path d="M6 26 A20 20 0 0 1 26 6 H274 A20 20 0 0 1 294 26 V64 H6 Z" fill={ART.green} />
          <line x1="6" y1="64" x2="294" y2="64" stroke={ART.ink} strokeWidth="3.5" />
          <circle cx="34" cy="35" r="13" fill={ART.paper} stroke={ART.ink} strokeWidth="2.5" />
          <path d="M28 35 h12 M28 30 h12 M28 40 h8" stroke={ART.green} strokeWidth="2.2" strokeLinecap="round" />
          <text x="56" y="41" fontSize="17" fontWeight="800" fill={ART.paper}
                fontFamily="Inter, sans-serif">ใบแจ้งหนี้</text>

          {/* amount */}
          <text x="26" y="104" fontSize="12" fill={ART.ink} opacity="0.6"
                fontFamily="Inter, sans-serif">INV-2026-0042</text>
          <text x="24" y="140" fontSize="38" fontWeight="800" fill={ART.ink}
                fontFamily="Inter, sans-serif">฿72,800</text>

          {/* line items */}
          {items.map((it, i) => {
            const y = 176 + i * 34;
            return (
              <g key={i}>
                <rect x="26" y={y} width="20" height="20" rx="5" fill={it.c} stroke={ART.ink} strokeWidth="2" />
                <rect x="56" y={y + 5} width={it.w} height="10" rx="5" fill={ART.bar} />
                <text x="274" y={y + 16} fontSize="13" fontWeight="700" fill={ART.ink}
                      textAnchor="end" fontFamily="Inter, sans-serif">{it.amt}</text>
              </g>
            );
          })}

          <line x1="26" y1="288" x2="274" y2="288" stroke={ART.bar} strokeWidth="2" strokeDasharray="5 5" />

          {/* PromptPay QR block */}
          <rect x="26" y="304" width="60" height="60" rx="8" fill={ART.green} opacity="0.12" />
          <g transform="translate(34 312)">
            {[0,1,2,3,4].map(r => [0,1,2,3,4].map(c => {
              const on = [[0,0],[0,1],[0,4],[1,0],[1,4],[2,2],[3,1],[3,3],[4,0],[4,3],[4,4]]
                .some(([a,b]) => a===r && b===c);
              return on ? <rect key={`${r}-${c}`} x={c*9} y={r*9} width="7" height="7" rx="1.5" fill={ART.green} /> : null;
            }))}
          </g>
          <text x="98" y="328" fontSize="13" fontWeight="800" fill={ART.green}
                fontFamily="Inter, sans-serif">PromptPay QR</text>
          <text x="98" y="346" fontSize="11" fill={ART.ink} opacity="0.55"
                fontFamily="Inter, sans-serif">สแกนเพื่อชำระเงิน</text>
          {/* drawn check */}
          <circle cx="256" cy="334" r="17" fill={ART.green} />
          <path className="lp-illo-check" d="M248 334 l6 6 l11 -12"
                stroke={ART.paper} strokeWidth="3.5" fill="none"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </motion.div>
  );
}

function Spark({ className, style, color }: { className: string; style: React.CSSProperties; color: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="22" height="22"
         style={{ position: 'absolute', zIndex: 3, ...style }}>
      <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill={color} />
    </svg>
  );
}

// ─── Realistic-but-cartoon PromptPay QR ──────────────────────────────────────
function qrModules(n: number): boolean[][] {
  const g = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const finder = (or: number, oc: number) => {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const edge = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      g[or + r][oc + c] = edge || core;
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const inFinder = (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8);
    if (inFinder) continue;
    g[r][c] = (r * 3 + c * 5 + ((r * c) % 7)) % 3 === 0;   // deterministic, QR-like
  }
  return g;
}

function PromptPayQR() {
  const n = 25, cell = 8, pad = 16;
  const grid = qrModules(n);
  const size = n * cell;
  return (
    <div className="lp-feature-card" style={{
      background: ART.paper, border: `3px solid ${ART.ink}`, borderRadius: 20,
      padding: pad, width: 'min(240px, 70vw)', transform: 'rotate(-2deg)',
      boxShadow: `0 16px 32px oklch(0.55 0.05 245 / 0.18)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6, background: 'oklch(0.45 0.16 255)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <QrCode size={13} color={ART.paper} strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>
          <span style={{ color: 'oklch(0.45 0.16 255)' }}>Prompt</span>
          <span style={{ color: 'oklch(0.62 0.16 200)' }}>Pay</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" role="img"
           aria-label="ตัวอย่าง PromptPay QR" style={{ display: 'block', borderRadius: 8 }}>
        <rect x="0" y="0" width={size} height={size} fill={ART.paper} />
        {grid.flatMap((row, r) => row.map((on, c) => on
          ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} rx={1.6} fill={ART.ink} />
          : null))}
      </svg>
      <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, fontWeight: 700, color: ART.ink }}>
        สแกนเพื่อจ่าย · ฿72,800
      </div>
    </div>
  );
}

// ─── PayPal wordmark (real construction, inline) ─────────────────────────────
function PayPalMark() {
  return (
    <div className="lp-feature-card" style={{
      background: ART.paper, border: `3px solid ${ART.ink}`, borderRadius: 18,
      padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: 'rotate(2deg)', boxShadow: `0 14px 28px oklch(0.5 0.04 255 / 0.16)`,
    }}>
      <span style={{
        fontFamily: 'Inter, sans-serif', fontWeight: 800, fontStyle: 'italic',
        fontSize: 30, letterSpacing: '-0.02em',
      }}>
        <span style={{ color: '#003087' }}>Pay</span>
        <span style={{ color: '#009cde' }}>Pal</span>
      </span>
    </div>
  );
}

// ─── Cartoon checkout cart ───────────────────────────────────────────────────
function CheckoutCart() {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24, scale: 0.92 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={reduced ? { duration: 0 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'relative', width: 'min(300px, 78vw)', flexShrink: 0 }}
      aria-hidden="true"
    >
      <Spark className="lp-illo-s1" style={{ top: 0, right: 20 }} color={ART.amber} />
      <Spark className="lp-illo-s2" style={{ bottom: 30, left: 0 }} color={ART.coral} />
      <div className="lp-illo-bob">
        <svg viewBox="0 0 280 240" width="100%" role="img"
             style={{ filter: `drop-shadow(0 22px 30px oklch(0.5 0.06 245 / 0.20))`, display: 'block' }}>
          {/* items flying into the cart */}
          <rect x="96" y="34" width="44" height="34" rx="8" fill={ART.coral} stroke={ART.ink} strokeWidth="3" />
          <rect x="150" y="20" width="40" height="48" rx="8" fill={ART.sky} stroke={ART.ink} strokeWidth="3" />
          <rect x="196" y="40" width="40" height="28" rx="8" fill={ART.amber} stroke={ART.ink} strokeWidth="3" />
          {/* cart basket */}
          <path d="M58 92 H236 L222 168 H82 Z" fill={ART.paper} stroke={ART.ink} strokeWidth="3.5" strokeLinejoin="round" />
          <line x1="100" y1="108" x2="108" y2="152" stroke={ART.ink} strokeWidth="2.4" />
          <line x1="138" y1="108" x2="140" y2="152" stroke={ART.ink} strokeWidth="2.4" />
          <line x1="176" y1="108" x2="172" y2="152" stroke={ART.ink} strokeWidth="2.4" />
          <line x1="70" y1="118" x2="224" y2="118" stroke={ART.ink} strokeWidth="2.4" opacity="0.5" />
          {/* handle */}
          <path d="M30 70 H50 L58 92" fill="none" stroke={ART.ink} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* wheels */}
          <circle cx="104" cy="196" r="15" fill={ART.green} stroke={ART.ink} strokeWidth="3.5" />
          <circle cx="200" cy="196" r="15" fill={ART.green} stroke={ART.ink} strokeWidth="3.5" />
          <circle cx="104" cy="196" r="4" fill={ART.paper} />
          <circle cx="200" cy="196" r="4" fill={ART.paper} />
          {/* paid check badge */}
          <circle cx="226" cy="150" r="20" fill={ART.green} stroke={ART.ink} strokeWidth="3" />
          <path className="lp-illo-check" d="M217 150 l6 7 l12 -14" fill="none" stroke={ART.paper}
                strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </motion.div>
  );
}

// ─── Cartoon credit-card brand tiles (Visa · Mastercard · Amex) ──────────────
function BrandCard({ bg, rotate, children }: { bg: string; rotate: number; children: React.ReactNode }) {
  return (
    <div className="lp-card-tile" style={{
      width: 150, height: 96, background: bg, border: `3px solid ${ART.ink}`,
      borderRadius: 14, transform: `rotate(${rotate}deg)`, flexShrink: 0,
      padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      boxShadow: `0 12px 24px oklch(0.4 0.04 260 / 0.22)`,
    }}>{children}</div>
  );
}

function Chip() {
  return (
    <div style={{
      width: 28, height: 21, borderRadius: 5,
      background: 'linear-gradient(135deg, #ffe49b 0%, #d4ad52 100%)',
      border: `2px solid ${ART.ink}`, position: 'relative',
    }}>
      <div style={{ position: 'absolute', inset: '6px 4px', borderLeft: `2px solid ${ART.ink}`, borderRight: `2px solid ${ART.ink}`, opacity: 0.6 }} />
    </div>
  );
}

function CardBrands() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      {/* Visa */}
      <BrandCard bg="#1a1f71" rotate={-3}>
        <Chip />
        <span style={{
          alignSelf: 'flex-end', color: '#ffffff', fontStyle: 'italic',
          fontWeight: 800, fontSize: 26, letterSpacing: '0.04em',
        }}>
          VISA<span style={{ color: '#f7b600' }}>.</span>
        </span>
      </BrandCard>

      {/* Mastercard */}
      <BrandCard bg="oklch(0.26 0.012 60)" rotate={2}>
        <Chip />
        <div style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#eb001b', border: `2px solid ${ART.ink}` }} />
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f79e1b', border: `2px solid ${ART.ink}`, marginLeft: -12, opacity: 0.92 }} />
          </div>
        </div>
      </BrandCard>

      {/* American Express */}
      <BrandCard bg="#2e77bb" rotate={-2}>
        <Chip />
        <div style={{ alignSelf: 'flex-end', textAlign: 'right', lineHeight: 1 }}>
          <div style={{ color: '#ffffff', fontWeight: 900, fontSize: 22, letterSpacing: '0.02em' }}>AMEX</div>
          <div style={{ color: 'oklch(0.88 0.04 235)', fontWeight: 700, fontSize: 8, letterSpacing: '0.08em', marginTop: 2 }}>
            AMERICAN EXPRESS
          </div>
        </div>
      </BrandCard>
    </div>
  );
}

// ─── Payments section ────────────────────────────────────────────────────────
function PaymentsSection() {
  return (
    <section style={{
      background: C.surface,
      borderTop: `1px solid ${C.border}`,
      borderBottom: `1px solid ${C.border}`,
      padding: 'clamp(72px,12vw,120px) clamp(20px,5vw,80px)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'clamp(40px,6vw,80px)', flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 380px', maxWidth: 540 }}>
          <Reveal>
            <h2 style={{
              fontSize: 'clamp(1.75rem,4vw,2.6rem)', fontWeight: 800,
              letterSpacing: '-0.03em', color: C.text, marginBottom: 12, textWrap: 'balance',
            } as React.CSSProperties}>
              รับเงินได้ทุกช่องทาง
            </h2>
            <p style={{ color: C.muted, fontSize: 16, lineHeight: 1.65, maxWidth: '48ch', marginBottom: 32 }}>
              ลูกค้าเลือกจ่ายแบบที่สะดวก: สแกน PromptPay QR, จ่ายผ่าน PayPal,
              บัตรเครดิต หรือ USDT. ทุกบิลปิดได้ในไม่กี่คลิก.
            </p>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <PromptPayQR />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <CardBrands />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <PayPalMark />
                  <span style={{
                    background: C.raised, border: `2px solid ${ART.ink}`, color: C.text,
                    borderRadius: 100, padding: '8px 16px', fontSize: 13, fontWeight: 700,
                  }}>USDT TRC-20</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', flex: '0 1 320px' }}>
          <CheckoutCart />
        </div>
      </div>
    </section>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'oklch(0.985 0.006 150 / 0.85)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${C.border}`,
      padding: '0 clamp(20px,5vw,80px)',
      height: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <Link
        to="/"
        aria-label="InvoicePro home"
        className="lp-nav-link"
        style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
      >
        <div style={{
          width: 28, height: 28, background: C.accent, borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Receipt size={14} color={C.bg} strokeWidth={2.5} />
        </div>
        <span style={{ color: C.text, fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>
          InvoicePro
        </span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isLoggedIn ? (
          <Link
            to="/dashboard"
            className="lp-primary"
            style={{
              background: C.accent, color: C.bg, borderRadius: 8,
              padding: '7px 16px', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            Dashboard <ArrowRight size={13} strokeWidth={2.5} />
          </Link>
        ) : (
          <>
            <Link
              to="/login"
              className="lp-nav-link"
              style={{ color: C.muted, fontSize: 13, fontWeight: 500, textDecoration: 'none', padding: '7px 12px' }}
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              to="/register"
              className="lp-primary"
              style={{
                background: C.accent, color: C.bg, borderRadius: 8,
                padding: '7px 16px', fontSize: 13, fontWeight: 600,
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              เริ่มใช้ฟรี
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user } = useAuth();
  const signupHref = user ? '/dashboard' : '/register';

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: 'Inter, ui-sans-serif, sans-serif', overflowX: 'hidden' }}>
      <style>{STYLES}</style>
      <Nav isLoggedIn={!!user} />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(56px,11vw,110px) clamp(20px,5vw,80px) clamp(72px,13vw,130px)',
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'clamp(48px,7vw,90px)',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 400px', maxWidth: 560 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: C.accentBg, border: `1px solid oklch(0.80 0.07 162)`,
              borderRadius: 100, padding: '5px 12px', marginBottom: 28,
            }}>
              <div style={{ width: 6, height: 6, background: C.accent, borderRadius: '50%' }} />
              <span style={{ color: 'oklch(0.42 0.10 162)', fontSize: 12, fontWeight: 700 }}>
                สร้างมาสำหรับธุรกิจไทย
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: 'clamp(2.4rem,5.5vw,3.8rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: C.text,
              marginBottom: 20,
              textWrap: 'balance',
              wordBreak: 'keep-all',
            } as React.CSSProperties}
          >
            <span style={{ whiteSpace: 'nowrap' }}>ส่งใบแจ้งหนี้.</span>{' '}
            <span style={{ color: C.heroAccent, whiteSpace: 'nowrap' }}>รับเงิน.</span>
            <br />
            Send invoices.
            <br />
            <span style={{ color: C.heroAccent }}>Get paid.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{
              color: C.muted, fontSize: 'clamp(15px,2vw,17px)',
              lineHeight: 1.7, maxWidth: '52ch', marginBottom: 36,
            }}
          >
            InvoicePro คือระบบใบแจ้งหนี้สำหรับ SME ไทย: PromptPay QR พร้อมใช้งาน,
            PDF ภาษาไทยมาตรฐาน, VAT 7% และ WHT ในตัว. ไม่ได้แปลมาจาก Western SaaS.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
          >
            <Link
              to={signupHref}
              className="lp-primary"
              style={{
                background: C.accent, color: C.bg,
                borderRadius: 10, padding: '12px 24px',
                fontSize: 15, fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              เริ่มใช้งานฟรี
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
            <a
              href="#features"
              className="lp-ghost"
              style={{
                background: C.raised,
                border: `1px solid ${C.border}`,
                color: C.text,
                borderRadius: 10, padding: '12px 24px',
                fontSize: 15, fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              ดูฟีเจอร์
              <ChevronRight size={16} />
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            style={{ display: 'flex', gap: 20, marginTop: 32, flexWrap: 'wrap' }}
          >
            {['ไม่ต้องใช้บัตรเครดิต', 'Free tier ตลอดไป', 'ตั้งค่าใน 5 นาที'].map((item) => (
              <span key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 13 }}>
                <Check size={13} color={C.accent} strokeWidth={3} />
                {item}
              </span>
            ))}
          </motion.div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', flex: '0 1 320px' }}>
          <ComicInvoice />
        </div>
      </section>

      {/* ── Capability strip ──────────────────────────────────────────── */}
      <div style={{
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
      }}>
        <Reveal>
          <div style={{
            maxWidth: 1200, margin: '0 auto',
            padding: '28px clamp(20px,5vw,80px)',
            display: 'flex',
            gap: 'clamp(16px,4vw,48px)',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            {[
              { icon: <QrCode size={16} />, label: 'PromptPay QR ในตัว', sub: 'สร้าง QR ทันทีพร้อมใบแจ้งหนี้' },
              { icon: <FileText size={16} />, label: 'PDF ภาษาไทย', sub: 'ฟอนต์ Sarabun, VAT/WHT ครบ' },
              { icon: <Globe size={16} />, label: 'หลายสกุลเงิน', sub: 'THB · USD · USDT TRC-20' },
              { icon: <BadgeCheck size={16} />, label: 'ถูกต้องตามกฎหมาย', sub: 'e-Tax Invoice มาตรฐาน สรรพากร' },
            ].map(({ icon, label, sub }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '4px 0', flex: '1 1 160px', minWidth: 0,
              }}>
                <div style={{
                  width: 36, height: 36, background: C.accentBg,
                  borderRadius: 9, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: C.accent, flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{label}</div>
                  <div style={{ color: C.muted, fontSize: 12 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* ── Payments (PromptPay QR · PayPal · checkout cart) ───────────── */}
      <PaymentsSection />

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: 'clamp(72px,12vw,120px) clamp(20px,5vw,80px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <h2 style={{
            fontSize: 'clamp(1.75rem,4vw,2.6rem)',
            fontWeight: 800, letterSpacing: '-0.03em',
            color: C.text, marginBottom: 12,
            textWrap: 'balance',
          } as React.CSSProperties}>
            ทุกอย่างที่ธุรกิจไทยต้องการ
          </h2>
          <p style={{ color: C.muted, fontSize: 16, maxWidth: '52ch', lineHeight: 1.65, marginBottom: 56 }}>
            ไม่ใช่แค่ออกบิล. InvoicePro ตามรอยการชำระเงินตลอด lifecycle,
            ตั้งแต่ DRAFT จนถึง PAID.
          </p>
        </Reveal>

        {/* PromptPay — full-width flagship card */}
        <Reveal delay={0.05}>
          <div
            className="lp-feature-highlight"
            style={{
              background: C.accentBg,
              border: `1px solid oklch(0.82 0.06 162)`,
              borderRadius: 16, padding: 32, marginBottom: 20,
              display: 'flex', flexDirection: 'row',
              alignItems: 'center', flexWrap: 'wrap', gap: 32,
            }}
          >
            <div style={{ flex: '1 1 280px' }}>
              <div style={{
                width: 44, height: 44, background: C.accent,
                borderRadius: 11, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: C.bg, marginBottom: 16,
              }}>
                <QrCode size={22} />
              </div>
              <h3 style={{ color: C.text, fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
                PromptPay QR: first class
              </h3>
              <p style={{ color: 'oklch(0.40 0.06 162)', fontSize: 14, lineHeight: 1.65, margin: 0, maxWidth: '52ch' }}>
                สร้าง PromptPay QR อัตโนมัติพร้อมกับทุกใบแจ้งหนี้. ลูกค้าสแกนจ่ายได้ทันที,
                ไม่ต้องพิมพ์หมายเลขบัญชีทุกครั้ง.
              </p>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4,
              padding: 16, background: C.raised, borderRadius: 12,
              border: `1px solid ${C.border}`, flexShrink: 0,
            }}>
              {Array.from({ length: 49 }, (_, i) => {
                const on = [0,1,2,3,4,5,6, 7,13, 14,20, 21,22,23,24,25,26, 27,33, 28,34, 42,43,44,45,46,47,48].includes(i);
                return <div key={i} style={{ width: 8, height: 8, background: on ? C.accent : 'transparent', borderRadius: 2 }} />;
              })}
            </div>
          </div>
        </Reveal>

        {/* Supporting features — 3-column grid, no orphans */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
          {[
            { icon: <FileText size={22} />, color: ART.coral, title: 'PDF ภาษาไทยมาตรฐาน',
              body: 'PDF จริงที่ embed ฟอนต์ Sarabun, แสดง VAT 7% และ WHT ครบถ้วน. ดาวน์โหลด, อีเมล, หรือเก็บไว้ใน cloud.' },
            { icon: <Banknote size={22} />, color: ART.sky, title: 'THB · USD · USDT',
              body: 'รับชำระผ่าน PromptPay QR, บัตรเครดิต, หรือ USDT TRC-20. เหมาะสำหรับ freelancer และ agency ที่มีลูกค้าต่างประเทศ.' },
            { icon: <Receipt size={22} />, color: ART.amber, title: 'ติดตามทุก invoice',
              body: 'DRAFT → UNPAID → PAID → OVERDUE. รู้ทันทีว่าใครค้างชำระ, ส่ง reminder ได้จากระบบโดยตรง.' },
          ].map(({ icon, color, title, body }, i) => (
            <Reveal key={title} delay={0.1 + i * 0.05}>
              <div className="lp-feature-card" style={{
                background: C.raised, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 16, height: '100%',
              }}>
                <div style={{
                  width: 44, height: 44, background: color,
                  borderRadius: 11, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: ART.ink,
                }}>
                  {icon}
                </div>
                <h3 style={{ color: C.text, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{title}</h3>
                <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section style={{
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: 'clamp(72px,12vw,120px) clamp(20px,5vw,80px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{
              fontSize: 'clamp(1.75rem,4vw,2.6rem)',
              fontWeight: 800, letterSpacing: '-0.03em',
              color: C.text, marginBottom: 12,
              textWrap: 'balance',
            } as React.CSSProperties}>
              ใช้งานง่าย 3 ขั้นตอน
            </h2>
            <p style={{ color: C.muted, fontSize: 16, marginBottom: 56, maxWidth: '44ch', lineHeight: 1.65 }}>
              ออกแบบมาสำหรับคนที่ยุ่ง; ไม่ต้องอ่านคู่มือ.
            </p>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 40 }}>
            {[
              { n: '1', color: ART.coral, title: 'สร้างใบแจ้งหนี้', body: 'กรอกชื่อลูกค้า, รายการสินค้า, จำนวนเงิน; ระบบคำนวณ VAT และ WHT ให้อัตโนมัติ.' },
              { n: '2', color: ART.amber, title: 'ส่งให้ลูกค้า', body: 'แชร์ลิงก์หรือ PDF พร้อม PromptPay QR ในคลิกเดียว. ลูกค้าเปิดได้บนมือถือ, ไม่ต้อง login.' },
              { n: '3', color: ART.green, title: 'รับเงิน. เสร็จ.', body: 'ระบบอัปเดต status อัตโนมัติเมื่อได้รับชำระ. เก็บ PDF และ audit trail ไว้ในระบบ.' },
            ].map(({ n, color, title, body }, i) => (
              <Reveal key={n} delay={i * 0.1}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{
                    width: 44, height: 44,
                    background: color,
                    border: `2.5px solid ${ART.ink}`,
                    borderRadius: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: ART.ink, fontWeight: 800, fontSize: 18,
                    boxShadow: `0 4px 0 ${ART.ink}`,
                    flexShrink: 0,
                  }}>
                    {n}
                  </div>
                  <h3 style={{ color: C.text, fontSize: 17, fontWeight: 700, margin: 0 }}>{title}</h3>
                  <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: 'clamp(72px,12vw,120px) clamp(20px,5vw,80px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <h2 style={{
            fontSize: 'clamp(1.75rem,4vw,2.6rem)',
            fontWeight: 800, letterSpacing: '-0.03em',
            color: C.text, marginBottom: 12,
            textWrap: 'balance',
          } as React.CSSProperties}>
            ราคาตรงไปตรงมา
          </h2>
          <p style={{ color: C.muted, fontSize: 16, marginBottom: 56, maxWidth: '44ch', lineHeight: 1.65 }}>
            เริ่มต้นฟรี, อัปเกรดเมื่อธุรกิจโต, ไม่มีค่าธรรมเนียมแอบซ่อน.
          </p>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20, maxWidth: 640 }}>
          {/* Free */}
          <Reveal delay={0.05}>
            <div style={{
              background: C.raised, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 24, height: '100%',
            }}>
              <div>
                <div style={{ color: C.text, fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Free</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ color: C.text, fontSize: 36, fontWeight: 800 }}>฿0</span>
                  <span style={{ color: C.muted, fontSize: 14 }}>/เดือน</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['ใบแจ้งหนี้ไม่จำกัด', 'PromptPay QR', 'PDF export', 'ติดตาม 5 clients'].map((item) => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Check size={14} color={C.accent} strokeWidth={3} />
                    <span style={{ color: C.muted, fontSize: 14 }}>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="lp-outline"
                style={{
                  border: `1px solid ${C.border}`, color: C.text,
                  borderRadius: 9, padding: '11px 20px',
                  fontSize: 14, fontWeight: 600,
                  textDecoration: 'none', textAlign: 'center',
                  display: 'block', marginTop: 'auto',
                }}
              >
                เริ่มใช้ฟรี
              </Link>
            </div>
          </Reveal>

          {/* Pro */}
          <Reveal delay={0.1}>
            <div style={{
              background: C.raised,
              border: `2px solid ${C.accent}`,
              borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 24,
              position: 'relative', height: '100%',
              boxShadow: `0 16px 40px oklch(0.52 0.13 162 / 0.12)`,
            }}>
              <div style={{
                position: 'absolute', top: -12, left: 24,
                background: C.accent, color: C.bg,
                borderRadius: 100, padding: '3px 12px',
                fontSize: 11, fontWeight: 700,
              }}>
                แนะนำ
              </div>
              <div>
                <div style={{ color: C.text, fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Pro</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ color: C.text, fontSize: 36, fontWeight: 800 }}>฿599</span>
                  <span style={{ color: C.muted, fontSize: 14 }}>/เดือน</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'ทุกอย่างใน Free',
                  'ใบแจ้งหนี้อัตโนมัติ',
                  'แจ้งเตือนลูกค้าค้างชำระ',
                  'e-Tax Invoice / WHT',
                  'ลบ branding InvoicePro',
                  'Team members + RBAC',
                ].map((item) => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Check size={14} color={C.accent} strokeWidth={3} />
                    <span style={{ color: C.muted, fontSize: 14 }}>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="lp-primary"
                style={{
                  background: C.accent, color: C.bg,
                  borderRadius: 9, padding: '11px 20px',
                  fontSize: 14, fontWeight: 700,
                  textDecoration: 'none', textAlign: 'center',
                  display: 'block', marginTop: 'auto',
                }}
              >
                เริ่มทดลองใช้ 14 วัน
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Final CTA (green drench for voice) ─────────────────────────── */}
      <section style={{
        background: C.accent,
        padding: 'clamp(64px,10vw,100px) clamp(20px,5vw,80px)',
        textAlign: 'center',
      }}>
        <Reveal>
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <h2 style={{
              fontSize: 'clamp(1.6rem,4vw,2.4rem)',
              fontWeight: 800, letterSpacing: '-0.03em',
              color: C.bg, marginBottom: 16,
              textWrap: 'balance',
            } as React.CSSProperties}>
              พร้อมใช้งานภายใน 5 นาที
            </h2>
            <p style={{ color: 'oklch(0.97 0.025 162)', fontSize: 16, lineHeight: 1.65, maxWidth: '40ch', margin: '0 auto 32px' }}>
              ไม่ต้องใช้บัตรเครดิต. ไม่ต้องติดตั้งอะไร. เริ่มส่งใบแจ้งหนี้แรกได้เลย.
            </p>
            <Link
              to={signupHref}
              className="lp-primary"
              style={{
                background: C.bg, color: C.accent,
                borderRadius: 11, padding: '14px 32px',
                fontSize: 16, fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 10,
              }}
            >
              เริ่มใช้งานฟรี
              <ArrowRight size={18} strokeWidth={2.5} />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer style={{
        background: C.bg,
        borderTop: `1px solid ${C.border}`,
        padding: 'clamp(32px,5vw,48px) clamp(20px,5vw,80px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, background: C.accent,
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Receipt size={12} color={C.bg} strokeWidth={2.5} />
          </div>
          <span style={{ color: C.muted, fontSize: 13, fontWeight: 500 }}>InvoicePro by FinTrust</span>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'เข้าสู่ระบบ', href: '/login' },
            { label: 'สมัครใช้งาน', href: '/register' },
            { label: 'ฟีเจอร์', href: '#features' },
            { label: 'ราคา', href: '#pricing' },
          ].map(({ label, href }) => (
            href.startsWith('#')
              ? <a key={label} href={href} className="lp-nav-link" style={{ color: C.faint, fontSize: 13, textDecoration: 'none' }}>{label}</a>
              : <Link key={label} to={href} className="lp-nav-link" style={{ color: C.faint, fontSize: 13, textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
        <span style={{ color: C.faint, fontSize: 12 }}>© 2026 FinTrust</span>
      </footer>
    </div>
  );
}
