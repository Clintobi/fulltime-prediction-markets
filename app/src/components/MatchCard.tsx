'use client'

import { useState, useEffect } from 'react'
import type { Fixture, ScoreRecord } from '@/lib/txline'
import { CheckIcon, ArrowRight } from './ui/Mascots'

type MatchCardProps = {
  fixture: Fixture
  scores: ScoreRecord[]
  index: number
}

const TEAM_FLAGS: Record<string, string> = {
  'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'France': '🇫🇷', 'Germany': '🇩🇪',
  'Spain': '🇪🇸', 'Portugal': '🇵🇹', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Netherlands': '🇳🇱',
  'Italy': '🇮🇹', 'Belgium': '🇧🇪', 'Croatia': '🇭🇷', 'Denmark': '🇩🇰',
  'Switzerland': '🇨🇭', 'Uruguay': '🇺🇾', 'Colombia': '🇨🇴', 'Japan': '🇯🇵',
  'South Korea': '🇰🇷', 'USA': '🇺🇸', 'Mexico': '🇲🇽', 'Canada': '🇨🇦',
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Nigeria': '🇳🇬', 'Ghana': '🇬🇭',
  'Cameroon': '🇨🇲', 'Tunisia': '🇹🇳', 'Egypt': '🇪🇬', 'Algeria': '🇩🇿',
  'Australia': '🇦🇺', 'Saudi Arabia': '🇸🇦', 'Iran': '🇮🇷', 'Ecuador': '🇪🇨',
  'Peru': '🇵🇪', 'Chile': '🇨🇱', 'Paraguay': '🇵🇾', 'Venezuela': '🇻🇪',
  'Poland': '🇵🇱', 'Sweden': '🇸🇪', 'Norway': '🇳🇴', 'Qatar': '🇶🇦',
  'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Serbia': '🇷🇸', 'Costa Rica': '🇨🇷',
}

function getFlag(team: string): string {
  return TEAM_FLAGS[team] || ''
}

// `now` is null until the component mounts, so the server render and the first
// client paint agree (no hydration mismatch); the countdown fills in after mount.
function getMatchStatus(
  fixture: Fixture,
  scores: ScoreRecord[],
  now: number | null,
): {
  label: string
  live: boolean
  finished: boolean
  homeScore?: number
  awayScore?: number
} {
  const gs = fixture.GameState
  if (gs === 6) return { label: 'Cancelled', live: false, finished: false }
  if (gs === 19) return { label: 'Postponed', live: false, finished: false }

  const latest = scores[scores.length - 1]
  if (latest) {
    const period = latest.period
    if (latest.statusId === 100 && latest.action === 'game_finalised') {
      return { label: 'Final', live: false, finished: true, homeScore: latest.homeScore, awayScore: latest.awayScore }
    }
    if (period === 5) {
      return { label: 'FT', live: false, finished: true, homeScore: latest.homeScore, awayScore: latest.awayScore }
    }
    if (period >= 2 && period <= 4) {
      return {
        label: period === 2 ? '1H' : period === 3 ? 'HT' : '2H',
        live: true,
        finished: false,
        homeScore: latest.homeScore,
        awayScore: latest.awayScore,
      }
    }
  }

  if (now !== null && new Date(fixture.StartTime).getTime() > now) {
    const diff = new Date(fixture.StartTime).getTime() - now
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    if (days > 0) return { label: `${days}d`, live: false, finished: false }
    if (hours > 0) return { label: `${hours}h`, live: false, finished: false }
    return { label: 'Soon', live: false, finished: false }
  }

  return { label: 'Upcoming', live: false, finished: false }
}

// The home board is a fixtures showcase, not a live betting surface — the real
// trading happens on /markets and /bet. So a card is a link into the real flow
// (finished → /verify to see the settlement, otherwise → /markets), with no
// placeholder pools or non-functional bet buttons.
export function MatchCard({ fixture, scores, index }: MatchCardProps) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => setNow(Date.now()), [])

  const status = getMatchStatus(fixture, scores, now)
  const homeTeam = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2
  const awayTeam = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1

  const matchDate = new Date(fixture.StartTime)
  const dateStr = matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const timeStr = matchDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

  const { finished: isFinished, live: isLive } = status
  const href = isFinished ? '/verify' : '/markets'

  return (
    <a
      href={href}
      className={`group block rounded-card border bg-surface p-4 transition-all duration-300 ${
        isLive
          ? 'border-accent/40 shadow-card-sm'
          : 'border-hairline hover:border-ink/15 hover:shadow-card-sm'
      }`}
    >
      {/* header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-ink-muted">
          Match {index + 1} · {dateStr} {timeStr}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${
            isLive || isFinished ? 'text-accent-dim' : 'text-ink-muted'
          }`}
        >
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />}
          {status.label}
        </span>
      </div>

      {/* scoreline */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-4">
        <div className="text-right text-[14px] font-semibold truncate">
          {getFlag(homeTeam)} {homeTeam}
        </div>
        <div className="flex items-center justify-center">
          {status.homeScore !== undefined ? (
            <span className="font-mono text-xl font-medium tabular-nums">
              {status.homeScore}
              <span className="text-ink-muted mx-1">–</span>
              {status.awayScore}
            </span>
          ) : (
            <span className="text-[11px] text-ink-muted font-semibold uppercase tracking-widest">vs</span>
          )}
        </div>
        <div className="text-left text-[14px] font-semibold truncate">
          {awayTeam} {getFlag(awayTeam)}
        </div>
      </div>

      {/* CTA into the real flow */}
      <div className="pt-3 border-t border-hairline flex items-center justify-between">
        {isFinished ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-dim">
              <CheckIcon className="w-3.5 h-3.5" />
              Settled &amp; paid
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] text-ink-muted group-hover:text-ink">
              See proof
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink group-hover:text-accent-dim">
            Back this on the markets
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        )}
      </div>
    </a>
  )
}
