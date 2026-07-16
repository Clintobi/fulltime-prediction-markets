'use client'

import { useState } from 'react'
import type { Fixture, ScoreRecord } from '@/lib/txline'

type MatchCardProps = {
  fixture: Fixture
  scores: ScoreRecord[]
  index: number
}

const WORLD_CUP_COMPETITION_IDS = [
  500001, 500012, 500079, 500105, 500473, 501173, 501174, 501175, 501176, 501177,
]

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
  'Poland': '🇵🇱', 'Sweden': '🇸🇪', 'Norway': '🇳🇴', 'Czech Republic': '🇨🇿',
  'Austria': '🇦🇹', 'Hungary': '🇭🇺', 'Serbia': '🇷🇸', 'Ukraine': '🇺🇦',
  'Turkey': '🇹🇷', 'Russia': '🇷🇺', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Ireland': '🇮🇪', 'Romania': '🇷🇴', 'Greece': '🇬🇷', 'Slovakia': '🇸🇰',
  'Slovenia': '🇸🇮', 'Bulgaria': '🇧🇬', 'Finland': '🇫🇮', 'Iceland': '🇮🇸',
  'Albania': '🇦🇱', 'North Macedonia': '🇲🇰', 'Montenegro': '🇲🇪', 'Bosnia': '🇧🇦',
  'Israel': '🇮🇱', 'Georgia': '🇬🇪', 'Armenia': '🇦🇲', 'Cyprus': '🇨🇾',
  'Luxembourg': '🇱🇺', 'Faroe Islands': '🇫🇴', 'Malta': '🇲🇹', 'Moldova': '🇲🇩',
  'Kazakhstan': '🇰🇿', 'Azerbaijan': '🇦🇿', 'Gibraltar': '🇬🇮', 'Liechtenstein': '🇱🇮',
  'Andorra': '🇦🇩', 'San Marino': '🇸🇲', 'Kosovo': '🇽🇰', 'Belarus': '🇧🇾',
  'Estonia': '🇪🇪', 'Latvia': '🇱🇻', 'Lithuania': '🇱🇹',
  'Costa Rica': '🇨🇷', 'Honduras': '🇭🇳', 'Panama': '🇵🇦', 'Jamaica': '🇯🇲',
  'Trinidad': '🇹🇹', 'Haiti': '🇭🇹', 'Cuba': '🇨🇺', 'Dominican Republic': '🇩🇴',
  'Guatemala': '🇬🇹', 'El Salvador': '🇸🇻', 'Nicaragua': '🇳🇮', 'Barbados': '🇧🇧',
  'Bahamas': '🇧🇸', 'Bermuda': '🇧🇲', 'Cayman Islands': '🇰🇾',
  'South Africa': '🇿🇦', 'Ivory Coast': '🇨🇮', 'Mali': '🇲🇱', 'Burkina Faso': '🇧🇫',
  'Zambia': '🇿🇲', 'Congo': '🇨🇬', 'DR Congo': '🇨🇩', 'Angola': '🇦🇴',
  'Mozambique': '🇲🇿', 'Zimbabwe': '🇿🇼', 'Kenya': '🇰🇪', 'Uganda': '🇺🇬',
  'Rwanda': '🇷🇼', 'Tanzania': '🇹🇿', 'Ethiopia': '🇪🇹', 'Sudan': '🇸🇩',
  'Libya': '🇱🇾', 'Equatorial Guinea': '🇬🇶', 'Cape Verde': '🇨🇻', 'Mauritania': '🇲🇷',
  'Comoros': '🇰🇲', 'Sierra Leone': '🇸🇱', 'Guinea': '🇬🇳', 'Benin': '🇧🇯',
  'Togo': '🇹🇬', 'Gabon': '🇬🇦', 'Niger': '🇳🇪', 'Chad': '🇹🇩',
  'Central African Republic': '🇨🇫', 'South Sudan': '🇸🇸', 'Liberia': '🇱🇷',
  'Seychelles': '🇸🇨', 'Mauritius': '🇲🇺', 'Eswatini': '🇸🇿', 'Lesotho': '🇱🇸',
  'Botswana': '🇧🇼', 'Namibia': '🇳🇦', 'Malawi': '🇲🇼', 'Madagascar': '🇲🇬',
  'Somalia': '🇸🇴', 'Djibouti': '🇩🇯', 'Eritrea': '🇪🇷', 'Gambia': '🇬🇲',
  'Guinea-Bissau': '🇬🇼', 'Sao Tome': '🇸🇹',
  'UAE': '🇦🇪', 'Qatar': '🇶🇦', 'Oman': '🇴🇲', 'Bahrain': '🇧🇭',
  'Kuwait': '🇰🇼', 'Jordan': '🇯🇴', 'Lebanon': '🇱🇧', 'Syria': '🇸🇾',
  'Palestine': '🇵🇸', 'Yemen': '🇾🇪', 'Iraq': '🇮🇶',
  'Thailand': '🇹🇭', 'Vietnam': '🇻🇳', 'Indonesia': '🇮🇩', 'Philippines': '🇵🇭',
  'Malaysia': '🇲🇾', 'Singapore': '🇸🇬', 'Myanmar': '🇲🇲', 'Cambodia': '🇰🇭',
  'Laos': '🇱🇦', 'Brunei': '🇧🇳', 'East Timor': '🇹🇱', 'Maldives': '🇲🇻',
  'Nepal': '🇳🇵', 'Bhutan': '🇧🇹', 'Bangladesh': '🇧🇩', 'Sri Lanka': '🇱🇰',
  'Pakistan': '🇵🇰', 'Afghanistan': '🇦🇫', 'Uzbekistan': '🇺🇿', 'Turkmenistan': '🇹🇲',
  'Tajikistan': '🇹🇯', 'Kyrgyzstan': '🇰🇬', 'Mongolia': '🇲🇳', 'China': '🇨🇳',
  'Taiwan': '🇹🇼', 'Hong Kong': '🇭🇰', 'Macau': '🇲🇴', 'North Korea': '🇰🇵',
  'New Zealand': '🇳🇿', 'Fiji': '🇫🇯', 'Papua New Guinea': '🇵🇬', 'Solomon Islands': '🇸🇧',
  'Vanuatu': '🇻🇺', 'Samoa': '🇼🇸', 'Tonga': '🇹🇴', 'Cook Islands': '🇨🇰',
  'Tahiti': '🇵🇫', 'New Caledonia': '🇳🇨',
}

function getFlag(team: string): string {
  return TEAM_FLAGS[team] || ''
}

function getMatchStatus(fixture: Fixture, scores: ScoreRecord[]): {
  label: string
  color: string
  homeScore?: number
  awayScore?: number
} {
  const gs = fixture.GameState
  if (gs === 6) return { label: 'Cancelled', color: 'text-red-400' }
  if (gs === 19) return { label: 'Postponed', color: 'text-yellow-400' }

  const latest = scores[scores.length - 1]
  if (latest) {
    const period = latest.period
    if (latest.statusId === 100 && latest.action === 'game_finalised') {
      return {
        label: 'Final',
        color: 'text-pitch-400',
        homeScore: latest.homeScore,
        awayScore: latest.awayScore,
      }
    }
    if (period === 5) {
      return {
        label: 'FT',
        color: 'text-pitch-400',
        homeScore: latest.homeScore,
        awayScore: latest.awayScore,
      }
    }
    if (period >= 2 && period <= 4) {
      return {
        label: period === 2 ? '1H' : period === 3 ? 'HT' : '2H',
        color: 'text-yellow-400',
        homeScore: latest.homeScore,
        awayScore: latest.awayScore,
      }
    }
  }

  if (new Date(fixture.StartTime) > new Date()) {
    const diff = new Date(fixture.StartTime).getTime() - Date.now()
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    if (days > 0) return { label: `D${days}`, color: 'text-slate-500' }
    if (hours > 0) return { label: `${hours}h`, color: 'text-slate-400' }
    return { label: 'Soon', color: 'text-yellow-400' }
  }

  return { label: 'Upcoming', color: 'text-slate-500' }
}

export function MatchCard({ fixture, scores, index }: MatchCardProps) {
  const [betSide, setBetSide] = useState<'yes' | 'no' | null>(null)
  const status = getMatchStatus(fixture, scores)
  const homeTeam = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2
  const awayTeam = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1

  const matchDate = new Date(fixture.StartTime)
  const dateStr = matchDate.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  const timeStr = matchDate.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  })

  const isFinished = status.label === 'Final' || status.label === 'FT'
  const poolYes = Math.floor(Math.random() * 500) + 100
  const poolNo = Math.floor(Math.random() * 500) + 100
  const isLive = status.label === '1H' || status.label === '2H' || status.label === 'HT'

  return (
    <div className={`rounded-xl border transition-all duration-300 ${
      isLive
        ? 'border-pitch-500/50 bg-pitch-950/40 shadow-[0_0_30px_-10px_rgba(34,197,94,0.3)]'
        : isFinished
        ? 'border-slate-700 bg-slate-900/60'
        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
    }`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-500">
            Match {index + 1} • {dateStr} {timeStr}
          </span>
          <span className={`text-xs font-mono font-medium ${status.color} ${
            isLive ? 'animate-pulse' : ''
          }`}>
            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-pitch-400 inline-block mr-1.5" />}
            {status.label}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-4">
          <div className="text-right">
            <div className="text-sm font-semibold truncate">
              {getFlag(homeTeam)} {homeTeam}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {status.homeScore !== undefined ? (
              <div className="flex items-center gap-1">
                <span className="text-xl font-bold font-mono tabular-nums">{status.homeScore}</span>
                <span className="text-slate-600">-</span>
                <span className="text-xl font-bold font-mono tabular-nums">{status.awayScore}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-600 font-medium uppercase tracking-wider">vs</span>
            )}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold truncate">
              {awayTeam} {getFlag(awayTeam)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setBetSide('yes')}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
              betSide === 'yes'
                ? 'border-pitch-500 bg-pitch-600/20 text-pitch-300'
                : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
            } ${isFinished ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span>{homeTeam} Wins</span>
              <span className="font-mono">{poolYes} USDC</span>
            </div>
          </button>
          <button
            onClick={() => setBetSide('no')}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
              betSide === 'no'
                ? 'border-pitch-500 bg-pitch-600/20 text-pitch-300'
                : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
            } ${isFinished ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span>{awayTeam} Wins</span>
              <span className="font-mono">{poolNo} USDC</span>
            </div>
          </button>
        </div>

        {isFinished && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-pitch-400">Settled ✓</span>
              <button className="text-slate-500 hover:text-slate-300">View Proof →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
