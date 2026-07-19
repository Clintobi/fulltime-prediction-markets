// Wordmark per DESIGN_BRIEF.md §7.1 — a rounded "pitch" glyph (accent square with a
// thin halfway line) + "Fulltime" in the display face. Replaces the old "FT" chip.

export function PitchGlyph({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="25" height="25" rx="7" fill="#12E27E" />
      <line x1="14" y1="4" x2="14" y2="24" stroke="#08170E" strokeWidth="1.6" opacity="0.9" />
      <circle cx="14" cy="14" r="3.4" fill="none" stroke="#08170E" strokeWidth="1.6" opacity="0.9" />
    </svg>
  )
}

export function Wordmark({
  onDark = false,
  className = '',
}: {
  onDark?: boolean
  className?: string
}) {
  return (
    <a href="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <PitchGlyph className="w-7 h-7" />
      <span
        className={`font-display font-bold text-[19px] tracking-[-0.02em] ${
          onDark ? 'text-panel-ink' : 'text-ink'
        }`}
      >
        Fulltime
      </span>
    </a>
  )
}
