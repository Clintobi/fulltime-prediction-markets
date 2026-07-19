// The dark "proof-ticket" market card per DESIGN_BRIEF.md §7.3 — the product
// signature. Warm near-black panel, tabular-mono numerics, YES(accent)/NO(coral)
// pills, and a settled state that shows the on-chain tx hash.
'use client'

import { Chip, type ChipStatus } from './Chip'
import { CheckIcon, ArrowUpRight } from './Mascots'

export type TicketProps = {
  home: string
  away: string
  flagHome?: string
  flagAway?: string
  scoreHome?: number
  scoreAway?: number
  question: string
  status: ChipStatus
  yesLabel?: string
  noLabel?: string
  yesValue?: string
  noValue?: string
  selected?: 'yes' | 'no' | null
  onYes?: () => void
  onNo?: () => void
  txHash?: string
  className?: string
  floating?: boolean
}

function short(hash: string) {
  return hash.length > 14 ? `${hash.slice(0, 6)}…${hash.slice(-5)}` : hash
}

export function ProofTicket({
  home,
  away,
  flagHome = '',
  flagAway = '',
  scoreHome,
  scoreAway,
  question,
  status,
  yesLabel = 'YES',
  noLabel = 'NO',
  yesValue,
  noValue,
  selected = null,
  onYes,
  onNo,
  txHash,
  className = '',
  floating = false,
}: TicketProps) {
  const hasScore = scoreHome !== undefined && scoreAway !== undefined
  const settled = status === 'settled'
  const interactive = !!(onYes || onNo)

  return (
    <div
      className={`rounded-ticket bg-panel border border-panel-hairline p-5 text-panel-ink ${
        floating ? 'shadow-ticket' : 'shadow-card'
      } ${className}`}
    >
      {/* header: matchup + status */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-panel-muted">
          World Cup · Match
        </span>
        <Chip status={status} onDark />
      </div>

      {/* scoreline */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
        <div className="text-right font-display font-semibold text-[15px] truncate">
          {flagHome} {home}
        </div>
        <div className="font-mono text-2xl font-medium tabular-nums text-panel-ink">
          {hasScore ? (
            <span>
              {scoreHome}
              <span className="text-panel-muted mx-1">–</span>
              {scoreAway}
            </span>
          ) : (
            <span className="text-[11px] uppercase tracking-widest text-panel-muted">vs</span>
          )}
        </div>
        <div className="text-left font-display font-semibold text-[15px] truncate">
          {away} {flagAway}
        </div>
      </div>

      {/* the question this ticket proves */}
      <div className="text-[13px] text-panel-muted mb-3 leading-snug">{question}</div>

      {/* YES / NO */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onYes}
          disabled={!interactive || settled}
          className={`rounded-input px-3 py-2.5 text-left transition-all ${
            selected === 'yes'
              ? 'bg-accent text-accent-ink'
              : 'bg-panel-2 text-panel-ink hover:bg-panel-2/70 border border-transparent hover:border-accent/40'
          } ${!interactive ? 'cursor-default' : ''} disabled:opacity-60`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold">{yesLabel}</span>
            {yesValue && <span className="font-mono text-[13px] tabular-nums">{yesValue}</span>}
          </div>
        </button>
        <button
          type="button"
          onClick={onNo}
          disabled={!interactive || settled}
          className={`rounded-input px-3 py-2.5 text-left transition-all ${
            selected === 'no'
              ? 'bg-negative text-negative-ink'
              : 'bg-panel-2 text-panel-ink hover:bg-panel-2/70 border border-transparent hover:border-negative/40'
          } ${!interactive ? 'cursor-default' : ''} disabled:opacity-60`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold">{noLabel}</span>
            {noValue && <span className="font-mono text-[13px] tabular-nums">{noValue}</span>}
          </div>
        </button>
      </div>

      {/* settled: proof line */}
      {settled && txHash && (
        <a
          href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 pt-3 border-t border-panel-hairline flex items-center justify-between group"
        >
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent">
            <CheckIcon className="w-3.5 h-3.5" />
            settled from the final score
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[12px] text-panel-muted group-hover:text-panel-ink">
            {short(txHash)}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </a>
      )}
    </div>
  )
}
