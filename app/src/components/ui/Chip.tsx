// Status chips per DESIGN_BRIEF.md §7.4 — one consistent chip everywhere.
import { CheckIcon } from './Mascots'

export type ChipStatus = 'live' | 'settled' | 'open' | 'void'

const styles: Record<
  ChipStatus,
  { label: string; cls: string; dot?: boolean; check?: boolean }
> = {
  live: { label: 'LIVE', cls: 'bg-accent/12 text-accent-dim', dot: true },
  settled: { label: 'SETTLED', cls: 'bg-accent/12 text-accent-dim', check: true },
  open: { label: 'OPEN', cls: 'bg-ink/5 text-ink-muted' },
  void: { label: 'VOID', cls: 'bg-negative/10 text-negative' },
}

export function Chip({
  status,
  onDark = false,
  children,
}: {
  status: ChipStatus
  onDark?: boolean
  children?: React.ReactNode
}) {
  const s = styles[status]
  const darkOverride =
    onDark && (status === 'live' || status === 'settled')
      ? 'bg-accent/15 text-accent'
      : onDark && status === 'open'
        ? 'bg-white/8 text-panel-muted'
        : s.cls
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] font-sans ${darkOverride}`}
    >
      {s.dot && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />}
      {s.check && <CheckIcon className="w-3 h-3" />}
      {children ?? s.label}
    </span>
  )
}
