// Flat football-world mascots + line icons per DESIGN_BRIEF.md §8:
// flat, rounded, dot-eye faces, palette-only fills (green/coral/ink/cream),
// one soft shadow puddle. No gradients, no outlines-as-style, no emoji.

type SvgProps = { className?: string }

const ACCENT = '#12E27E'
const ACCENT_DIM = '#0EA968'
const CORAL = '#F0552E'
const INK = '#1A1A1A'
const CREAM = '#FBFAF7'
const WHITE = '#FFFFFF'

function Puddle() {
  return <ellipse cx="50" cy="92" rx="26" ry="4.5" fill={INK} opacity="0.08" />
}

/** Smiling soccer-ball buddy, mid-bounce. */
export function BallMascot({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <Puddle />
      <circle cx="50" cy="46" r="30" fill={WHITE} stroke={INK} strokeWidth="3" />
      {/* pentagon patches */}
      <path d="M50 34 l9 6.5 -3.4 10.5 h-11.2 L41 40.5 Z" fill={INK} />
      <path d="M28 44 l7 1.5 1 8 -6 3.5 -5-6 Z" fill={INK} opacity="0.85" />
      <path d="M72 44 l-7 1.5 -1 8 6 3.5 5-6 Z" fill={INK} opacity="0.85" />
      {/* stub legs */}
      <path d="M42 72 q-3 9 -8 12" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M58 72 q3 9 9 11" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <circle cx="33.5" cy="85" r="3.5" fill={ACCENT} />
      <circle cx="68" cy="84" r="3.5" fill={ACCENT} />
      {/* face */}
      <circle cx="44" cy="46" r="2.6" fill={INK} />
      <circle cx="56" cy="46" r="2.6" fill={INK} />
      <path d="M45 53 q5 4 10 0" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** Trophy with a face — winning = green. */
export function TrophyMascot({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <Puddle />
      <path d="M30 26 h40 v14 a20 20 0 0 1 -40 0 Z" fill={ACCENT} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {/* handles */}
      <path d="M30 30 h-8 a6 6 0 0 0 0 12 h4" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M70 30 h8 a6 6 0 0 1 0 12 h-4" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      {/* stem + base */}
      <rect x="46" y="60" width="8" height="10" fill={INK} />
      <rect x="36" y="70" width="28" height="7" rx="3.5" fill={INK} />
      {/* face */}
      <circle cx="43" cy="34" r="2.4" fill={INK} />
      <circle cx="57" cy="34" r="2.4" fill={INK} />
      <path d="M44 40 q6 4 12 0" stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** Referee whistle. */
export function WhistleMascot({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <Puddle />
      <path d="M26 44 h34 a14 14 0 1 1 -14 20 h-20 a6 6 0 0 1 -6 -6 v-8 a6 6 0 0 1 6 -6 Z" fill={CORAL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="52" cy="58" r="6" fill={CREAM} stroke={INK} strokeWidth="2.5" />
      {/* mouthpiece */}
      <path d="M60 44 h10 a4 4 0 0 1 0 8 h-6" fill={CORAL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {/* face */}
      <circle cx="34" cy="52" r="2.2" fill={INK} />
      <circle cx="42" cy="52" r="2.2" fill={INK} />
    </svg>
  )
}

/** Goal net corner. */
export function NetMascot({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <Puddle />
      <rect x="22" y="24" width="56" height="52" rx="6" fill="none" stroke={INK} strokeWidth="4" />
      <g stroke={INK} strokeWidth="1.6" opacity="0.5">
        <path d="M22 38 h56 M22 52 h56 M22 66 h56" />
        <path d="M36 24 v52 M50 24 v52 M64 24 v52" />
      </g>
      {/* ball tucked in corner */}
      <circle cx="64" cy="64" r="9" fill={ACCENT} stroke={INK} strokeWidth="2.5" />
      <circle cx="61" cy="63" r="1.8" fill={INK} />
      <circle cx="67" cy="63" r="1.8" fill={INK} />
    </svg>
  )
}

/** Corner flag. */
export function FlagMascot({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <Puddle />
      <line x1="40" y1="20" x2="40" y2="84" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M40 22 h30 l-8 9 8 9 h-30 Z" fill={ACCENT} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="49" cy="29" r="1.8" fill={INK} />
      <circle cx="55" cy="29" r="1.8" fill={INK} />
    </svg>
  )
}

/** Small solid orb — national-color confetti dots. */
export function Orb({ className, color = ACCENT }: SvgProps & { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={color} stroke={INK} strokeWidth="1.6" />
    </svg>
  )
}

/* ----------------------------- line icons ----------------------------- */

export function CheckIcon({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4.5 12.5l5 5 10-11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ArrowRight({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ArrowUpRight({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M7 17L17 7M8 7h9v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export { ACCENT, ACCENT_DIM, CORAL, INK, CREAM }
