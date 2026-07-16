import { TxlineClient, type ScoreRecord } from './txline'
import { settleMarket } from './settlement'

const SUBSCRIPTION_INTERVAL_MS = 60_000
const MAX_RETRIES = 3

async function main() {
  console.log('┌────────────────────────────────────────┐')
  console.log('│ Fulltime Keeper Bot                     │')
  console.log('│ Auto-settling World Cup prediction      │')
  console.log('│ markets via TxLINE validation proofs.   │')
  console.log('└────────────────────────────────────────┘')
  console.log()

  const client = new TxlineClient()
  const settledFixtures = new Set<number>()

  await ensureAuthenticated(client)

  while (true) {
    try {
      console.log(`[${new Date().toISOString()}] Connecting to scores stream...`)
      const controller = new AbortController()

      const streamPromise = client.streamScores(
        async (score: ScoreRecord) => {
          if (isFinalised(score) && !settledFixtures.has(score.fixtureId)) {
            console.log(`\n🎯 Match finalised! Fixture ${score.fixtureId}`)
            console.log(`   Score: ${score.homeScore ?? '?'} - ${score.awayScore ?? '?'}`)
            console.log(`   Seq: ${score.seq}`)

            settledFixtures.add(score.fixtureId)
            await attemptSettlement(client, score, settledFixtures)
          }
        },
        undefined,
        controller.signal
      )

      await streamPromise
    } catch (err: any) {
      console.error(`Stream error: ${err?.message ?? err}. Reconnecting in 5s...`)
      await sleep(5000)
    }
  }
}

function isFinalised(score: ScoreRecord): boolean {
  return (
    score.action === 'game_finalised' &&
    score.statusId === 100 &&
    score.period === 100
  )
}

async function ensureAuthenticated(client: TxlineClient, retries = MAX_RETRIES): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const { jwt, apiToken } = await client.authenticate()
      console.log(`✓ Authenticated (jwt=${jwt.slice(0, 16)}..., token=${apiToken.slice(0, 16)}...)`)
      return
    } catch (err) {
      console.error(`Auth attempt ${i + 1}/${retries} failed:`, err)
      await sleep(2000 * (i + 1))
    }
  }
  throw new Error('Failed to authenticate after retries')
}

async function attemptSettlement(
  client: TxlineClient,
  score: ScoreRecord,
  settled: Set<number>
): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const proof = await client.getStatValidation(
        score.fixtureId,
        score.seq,
        '1,2'
      )

      console.log(`   Proof fetched (${proof.statsToProbe?.length ?? 0} stats)`)

      const result = await settleMarket(proof)
      if (result) {
        console.log(`   ✅ Market settled! Tx: ${result}`)
      }
      return
    } catch (err: any) {
      console.error(`   Settlement attempt ${attempt + 1}/${MAX_RETRIES} failed: ${err?.message ?? err}`)
      if (attempt < MAX_RETRIES - 1) {
        await sleep(2000 * (attempt + 1))
      }
    }
  }
  console.error(`   ❌ Failed to settle fixture ${score.fixtureId} after ${MAX_RETRIES} attempts`)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
