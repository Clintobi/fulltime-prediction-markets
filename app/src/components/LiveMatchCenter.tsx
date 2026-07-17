'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { txline, type Fixture, type ScoreRecord } from '@/lib/txline'

type Pick = 'home' | 'draw' | 'away'
const FLAG: Record<string, string> = {
  France: '🇫🇷', England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', Spain: '🇪🇸', Argentina: '🇦🇷', Brazil: '🇧🇷',
  Australia: '🇦🇺', Vietnam: '🇻🇳', Myanmar: '🇲🇲', 'New Zealand': '🇳🇿', India: '🇮🇳',
}
const flag = (t: string) => FLAG[t] || '⚽'

const SEED_BOARD = [
  { name: 'kai.sol', pts: 240 }, { name: 'mbappe_fan', pts: 180 },
  { name: 'degen_keeper', pts: 130 }, { name: 'oddsmith', pts: 95 },
]

export function LiveMatchCenter() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [sel, setSel] = useState<Fixture | null>(null)
  const [score, setScore] = useState<{ h: number; a: number; status: string; live: boolean }>({ h: 0, a: 0, status: 'Awaiting kickoff', live: false })
  const [feed, setFeed] = useState<string[]>([])
  const [picks, setPicks] = useState<Record<number, Pick>>({})
  const [points, setPoints] = useState(0)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    try {
      setPicks(JSON.parse(localStorage.getItem('ft_picks') || '{}'))
      setPoints(Number(localStorage.getItem('ft_points') || 0))
    } catch {}
    ;(async () => {
      try { await txline.authenticate(); setFixtures(await txline.getFixtures()) } catch {}
    })()
  }, [])

  function selectMatch(f: Fixture) {
    abort.current?.abort()
    setSel(f); setFeed([]); setScore({ h: 0, a: 0, status: 'Connecting to TxLINE…', live: false })
    const ac = new AbortController(); abort.current = ac
    txline.streamScores((s: ScoreRecord) => {
      const h = s.homeScore ?? 0, a = s.awayScore ?? 0
      const live = (s.statusId ?? 0) > 0 && (s.statusId ?? 0) < 100
      const finished = (s.statusId ?? 0) >= 100
      setScore({ h, a, status: finished ? 'Full time' : live ? `Live · ${s.period ?? ''}` : 'Awaiting kickoff', live })
      if (s.action) setFeed(prev => [`${new Date((s.ts ?? Date.now())).toLocaleTimeString()} · ${s.action}${s.homeScore != null ? ` (${h}–${a})` : ''}`, ...prev].slice(0, 8))
    }, f.FixtureId, ac.signal).catch(() => setScore(v => ({ ...v, status: 'Stream idle — live on kickoff' })))
    // graceful pre-match state
    setTimeout(() => setScore(v => v.live ? v : { ...v, status: 'Awaiting kickoff' }), 4000)
  }

  function makePick(f: Fixture, p: Pick) {
    const next = { ...picks, [f.FixtureId]: p }
    setPicks(next); localStorage.setItem('ft_picks', JSON.stringify(next))
    const pts = points + 10
    setPoints(pts); localStorage.setItem('ft_points', String(pts))
  }

  const board = useMemo(() =>
    [...SEED_BOARD, { name: 'you', pts: points }].sort((a, b) => b.pts - a.pts), [points])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-3 gap-6">
      {/* fixtures */}
      <div className="lg:col-span-1 space-y-2">
        <h3 className="text-sm font-semibold text-slate-400 mb-3">Matches</h3>
        {fixtures.length === 0 && <div className="text-xs text-slate-600">Loading TxLINE fixtures…</div>}
        {fixtures.map(f => (
          <button key={f.FixtureId} onClick={() => selectMatch(f)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition ${sel?.FixtureId === f.FixtureId ? 'border-pitch-500 bg-pitch-950/40' : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'}`}>
            <div className="flex items-center justify-between">
              <span>{flag(f.Participant1)} {f.Participant1}</span>
              <span className="text-slate-600 text-xs">vs</span>
              <span>{f.Participant2} {flag(f.Participant2)}</span>
            </div>
            <div className="text-[10px] text-slate-600 mt-1">{new Date(f.StartTime).toLocaleString()}</div>
          </button>
        ))}
      </div>

      {/* match center */}
      <div className="lg:col-span-2">
        {!sel ? (
          <div className="h-full min-h-[300px] flex items-center justify-center rounded-xl border border-slate-800 text-slate-600 text-sm">
            Pick a match to open the live center
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs px-2 py-0.5 rounded-full ${score.live ? 'bg-red-500/15 text-red-300' : 'bg-slate-800 text-slate-400'}`}>
                  {score.live && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 animate-pulse" />}{score.status}
                </span>
                <span className="text-xs text-pitch-400 font-mono">TxLINE SSE</span>
              </div>
              <div className="flex items-center justify-center gap-6 py-2">
                <div className="text-center flex-1">
                  <div className="text-4xl mb-1">{flag(sel.Participant1)}</div>
                  <div className="text-sm text-slate-300">{sel.Participant1}</div>
                </div>
                <div className="text-5xl font-bold tabular-nums">{score.h}<span className="text-slate-600 mx-2">–</span>{score.a}</div>
                <div className="text-center flex-1">
                  <div className="text-4xl mb-1">{flag(sel.Participant2)}</div>
                  <div className="text-sm text-slate-300">{sel.Participant2}</div>
                </div>
              </div>
            </div>

            {/* prediction */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">Predict the winner</h4>
                <span className="text-xs text-slate-500">+10 pts per pick</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['home', 'draw', 'away'] as Pick[]).map(p => {
                  const label = p === 'home' ? sel.Participant1 : p === 'away' ? sel.Participant2 : 'Draw'
                  const active = picks[sel.FixtureId] === p
                  return (
                    <button key={p} onClick={() => makePick(sel, p)}
                      className={`px-3 py-2.5 rounded-lg text-sm border transition ${active ? 'border-pitch-500 bg-pitch-600 text-white' : 'border-slate-800 hover:border-slate-600'}`}>
                      {label}
                    </button>
                  )
                })}
              </div>
              {picks[sel.FixtureId] && <p className="text-xs text-pitch-400 mt-3">Your pick is locked in. Come back at full time to see if you called it.</p>}
            </div>

            {/* live feed */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <h4 className="text-sm font-semibold mb-3">Live feed</h4>
              {feed.length === 0
                ? <p className="text-xs text-slate-600">Waiting for TxLINE match events… updates land here instantly during the game.</p>
                : <ul className="space-y-1.5 text-xs text-slate-400 font-mono">{feed.map((e, i) => <li key={i}>{e}</li>)}</ul>}
            </div>
          </div>
        )}
      </div>

      {/* leaderboard */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Leaderboard</h4>
            <span className="text-xs text-slate-500">your score: <span className="text-pitch-400 font-semibold">{points}</span></span>
          </div>
          <div className="space-y-1.5">
            {board.map((r, i) => (
              <div key={r.name} className={`flex items-center justify-between text-sm px-3 py-1.5 rounded ${r.name === 'you' ? 'bg-pitch-950/40 text-pitch-200' : 'text-slate-400'}`}>
                <span>{i + 1}. {r.name}</span>
                <span className="tabular-nums">{r.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
