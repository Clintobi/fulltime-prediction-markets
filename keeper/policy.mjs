// Pure, credential-free feed policy shared by the keeper and judge replay.
// It separates transport success from settlement eligibility and fails closed on
// malformed or postponed fixtures.

const get = (row, names) => {
  for (const name of names) if (row?.[name] !== undefined) return row[name]
}

const textState = (row) => [
  get(row, ['Action', 'action']),
  get(row, ['GameState', 'gameState']),
  get(row, ['Status', 'status']),
  get(row, ['State', 'state']),
].filter(Boolean).join(' ').toLowerCase()

export function classifyScoreFeed(rows, expectedFixtureId) {
  if (!Array.isArray(rows)) return { state: 'malformed', reason: 'feed-not-array' }
  if (!rows.length) return { state: 'pending', reason: 'no-score-events' }

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return { state: 'malformed', reason: 'event-not-object' }
    }
    const fixture = Number(get(row, ['FixtureId', 'fixtureId']))
    if (Number.isFinite(fixture) && fixture !== Number(expectedFixtureId)) {
      return { state: 'malformed', reason: 'fixture-mismatch' }
    }
  }

  const terminal = rows.map(textState).find((state) => /postpon|abandon|cancel|void/.test(state))
  if (terminal) return { state: 'void-review', reason: 'fixture-postponed-or-cancelled' }

  const candidates = rows.filter((row) => {
    const period = Number(get(row, ['Period', 'period']) ?? row?.Stats?.period)
    const statusId = Number(get(row, ['StatusId', 'statusId']))
    const state = textState(row)
    return period === 100 || statusId === 100 || /final|full.?time|finished/.test(state)
  })
  if (!candidates.length) return { state: 'pending', reason: 'no-final-event' }

  const latest = candidates.slice().sort((a, b) => Number(get(b, ['Seq', 'seq']) || 0) - Number(get(a, ['Seq', 'seq']) || 0))[0]
  const home = Number(latest?.Stats?.['1'] ?? get(latest, ['HomeScore', 'homeScore']))
  const away = Number(latest?.Stats?.['2'] ?? get(latest, ['AwayScore', 'awayScore']))
  const seq = Number(get(latest, ['Seq', 'seq']))
  if (!Number.isFinite(home) || !Number.isFinite(away) || !Number.isFinite(seq)) {
    return { state: 'malformed', reason: 'final-event-missing-score-or-seq' }
  }
  return { state: 'final', seq, score: { home, away } }
}

export function replaySettlement(events, expectedFixtureId) {
  const decisions = []
  for (let i = 1; i <= events.length; i++) {
    const decision = classifyScoreFeed(events.slice(0, i), expectedFixtureId)
    decisions.push(decision)
    if (['final', 'malformed', 'void-review'].includes(decision.state)) break
  }
  return decisions
}
