import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyScoreFeed, replaySettlement } from './policy.mjs'

const fixture = 18179549
const scheduled = { FixtureId: fixture, Seq: 1, GameState: 'scheduled' }
const live = { FixtureId: fixture, Seq: 20, StatusId: 40, Stats: { 1: 1, 2: 0 } }
const final = { FixtureId: fixture, Seq: 100, StatusId: 100, Action: 'game_finalised', Period: 100, Stats: { 1: 2, 2: 1 } }

test('settlement replay remains pending until the same final event every time', () => {
  const first = replaySettlement([scheduled, live, final], fixture)
  const second = replaySettlement([scheduled, live, final], fixture)
  assert.deepEqual(first, second)
  assert.deepEqual(first.map((decision) => decision.state), ['pending', 'pending', 'final'])
  assert.deepEqual(first.at(-1).score, { home: 2, away: 1 })
})

test('a postponed fixture enters void review and is never auto-settled', () => {
  const result = classifyScoreFeed([
    scheduled,
    { FixtureId: fixture, Seq: 2, Action: 'match_postponed', GameState: 'postponed' },
  ], fixture)
  assert.deepEqual(result, { state: 'void-review', reason: 'fixture-postponed-or-cancelled' })
})

test('malformed final scores fail closed', () => {
  assert.deepEqual(
    classifyScoreFeed([{ ...final, Stats: { 1: 'not-a-score', 2: 1 } }], fixture),
    { state: 'malformed', reason: 'final-event-missing-score-or-seq' },
  )
  assert.equal(classifyScoreFeed({ data: [final] }, fixture).state, 'malformed')
})

test('a proof feed for another fixture cannot advance this market', () => {
  assert.deepEqual(
    classifyScoreFeed([{ ...final, FixtureId: fixture + 1 }], fixture),
    { state: 'malformed', reason: 'fixture-mismatch' },
  )
})
