'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { MatchCard } from './MatchCard'
import { txline, type Fixture, type ScoreRecord } from '@/lib/txline'

// Demo World Cup fixtures for the hackathon
const DEMO_FIXTURES: Fixture[] = Array.from({ length: 48 }, (_, i) => {
  const teams = [
    ['Brazil', 'Serbia'], ['Switzerland', 'Cameroon'], ['Portugal', 'Ghana'],
    ['Brazil', 'Switzerland'], ['Cameroon', 'Serbia'], ['Serbia', 'Switzerland'],
    ['Cameroon', 'Brazil'], ['Ghana', 'Portugal'], ['South Korea', 'Uruguay'],
    ['Portugal', 'Uruguay'], ['South Korea', 'Ghana'], ['Ghana', 'South Korea'],
    ['Uruguay', 'Portugal'], ['Netherlands', 'Senegal'], ['Ecuador', 'Qatar'],
    ['Netherlands', 'Ecuador'], ['Qatar', 'Senegal'], ['Ecuador', 'Senegal'],
    ['Netherlands', 'Qatar'], ['England', 'Iran'], ['USA', 'Wales'],
    ['England', 'USA'], ['Iran', 'Wales'], ['Wales', 'Iran'],
    ['England', 'Wales'], ['USA', 'Iran'], ['Argentina', 'Saudi Arabia'],
    ['Mexico', 'Poland'], ['Argentina', 'Mexico'], ['Poland', 'Saudi Arabia'],
    ['Saudi Arabia', 'Mexico'], ['Poland', 'Argentina'], ['France', 'Australia'],
    ['Denmark', 'Tunisia'], ['France', 'Denmark'], ['Tunisia', 'Australia'],
    ['Australia', 'Denmark'], ['France', 'Tunisia'], ['Spain', 'Costa Rica'],
    ['Germany', 'Japan'], ['Spain', 'Germany'], ['Japan', 'Costa Rica'],
    ['Costa Rica', 'Germany'], ['Japan', 'Spain'], ['Belgium', 'Canada'],
    ['Morocco', 'Croatia'], ['Belgium', 'Morocco'], ['Croatia', 'Canada'],
  ]

  const startTime = new Date('2026-06-11T13:00:00Z')
  startTime.setHours(startTime.getHours() + i * 6)

  return {
    FixtureId: 500000 + i,
    CompetitionId: 500001,
    StartTime: startTime.toISOString(),
    Participant1: teams[i][0],
    Participant2: teams[i][1],
    Participant1IsHome: i % 2 === 0,
    GameState: i < 30 ? undefined : (i % 3 === 0 ? 6 : undefined),
    Status: 'scheduled',
  }
})

const GROUP_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']

export function TournamentGrid() {
  const { publicKey, connected } = useWallet()
  const [fixtures, setFixtures] = useState<Fixture[]>(DEMO_FIXTURES)
  const [scoresMap, setScoresMap] = useState<Record<number, ScoreRecord[]>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'live' | 'finished'>('all')
  const [authStatus, setAuthStatus] = useState<'idle' | 'authenticating' | 'ready' | 'error'>('idle')

  useEffect(() => {
    ;(async () => {
      setAuthStatus('authenticating')
      try {
        await txline.authenticate()
        setAuthStatus('ready')
      } catch (e) {
        console.warn('Auth failed, using demo data:', e)
        setAuthStatus('ready')
      }
    })()
  }, [])

  useEffect(() => {
    if (authStatus !== 'ready') return

    const controller = new AbortController()
    ;(async () => {
      try {
        const liveFixtures = await txline.getFixtures()
        if (liveFixtures.length > 0) {
          setFixtures(liveFixtures.slice(0, 48))
        }
      } catch { /* use demo data */ }

      for await (const score of streamScores(controller.signal)) {
        setScoresMap(prev => ({
          ...prev,
          [score.fixtureId]: [...(prev[score.fixtureId] || []), score],
        }))
      }
    })()

    return () => controller.abort()
  }, [authStatus])

  const filtered = fixtures.filter(f => {
    const home = f.Participant1IsHome ? f.Participant1 : f.Participant2
    const away = f.Participant1IsHome ? f.Participant2 : f.Participant1
    const q = search.toLowerCase()

    if (q && !home.toLowerCase().includes(q) && !away.toLowerCase().includes(q)) return false

    const scores = scoresMap[f.FixtureId] || []
    const latest = scores[scores.length - 1]
    const isFinished = latest?.statusId === 100
    const isLive = latest && latest.period >= 2 && latest.period <= 4 && !isFinished
    const isUpcoming = !isLive && !isFinished

    switch (statusFilter) {
      case 'live': return isLive
      case 'finished': return isFinished
      case 'upcoming': return isUpcoming
      default: return true
    }
  })

  return (
    <section className="max-w-wide mx-auto px-5 py-16 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-dim mb-2">
            The board
          </div>
          <h2 className="font-display font-bold text-[28px] sm:text-[36px] tracking-[-0.015em]">
            Tournament matches
            <span className="text-ink-muted text-[18px] font-sans font-medium ml-3 align-middle">
              {filtered.length}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search teams…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-surface border border-hairline rounded-full px-4 py-2 text-sm text-ink placeholder-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent w-36 sm:w-48"
          />

          <div className="flex gap-1 bg-surface rounded-full p-1 border border-hairline">
            {(['all', 'upcoming', 'live', 'finished'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all ${
                  statusFilter === s
                    ? 'bg-ink text-white'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!connected && (
        <div className="mb-8 p-4 rounded-card border border-hairline bg-surface text-ink-muted text-sm flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-accent flex-none" />
          A live view of the fixtures — open Markets or Place a bet to trade them.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((f, i) => (
          <MatchCard
            key={f.FixtureId}
            fixture={f}
            scores={scoresMap[f.FixtureId] || []}
            index={i}
          />
        ))}
      </div>
    </section>
  )
}

async function* streamScores(
  signal: AbortSignal
): AsyncGenerator<ScoreRecord> {
  try {
    const stream = await fetch('https://txline-dev.txodds.com/api/scores/stream', {
      signal,
    })
    if (!stream.ok || !stream.body) return

    const reader = stream.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      for (const block of parts) {
        const msg = parseBlock(block)
        if (msg?.data) {
          try { yield JSON.parse(msg.data) }
          catch { /* skip */ }
        }
      }
    }
  } catch { /* stream ended */ }
}

function parseBlock(block: string): { data?: string } | null {
  let data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('data: ')) data += line.slice(6)
  }
  return data ? { data } : null
}
