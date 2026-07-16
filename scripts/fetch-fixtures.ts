/**
 * Fetch World Cup fixtures and scores from TxLINE.
 * Requires activated API credentials.
 *
 * Usage:
 *   JWT=<jwt> API_TOKEN=<api-token> npx ts-node scripts/fetch-fixtures.ts
 */
import axios from 'axios'

const API_ORIGIN = 'https://txline-dev.txodds.com'
const API_BASE = `${API_ORIGIN}/api`

async function main() {
  const jwt = process.env.JWT
  const apiToken = process.env.API_TOKEN

  if (!jwt || !apiToken) {
    console.error('Set JWT and API_TOKEN env vars')
    process.exit(1)
  }

  const http = axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'X-Api-Token': apiToken,
    },
  })

  console.log('Fetching fixtures...')
  const fixtures = await http.get('/fixtures/snapshot')
  console.log(`Found ${fixtures.data.length} total fixtures`)

  const wcFixtures = fixtures.data.filter(
    (f: any) => f.CompetitionId === 500001
  )
  console.log(`World Cup fixtures: ${wcFixtures.length}`)

  wcFixtures.slice(0, 5).forEach((f: any, i: number) => {
    const home = f.Participant1IsHome ? f.Participant1 : f.Participant2
    const away = f.Participant1IsHome ? f.Participant2 : f.Participant1
    console.log(`  ${i + 1}. ${home} vs ${away} (fixture ${f.FixtureId})`)
  })

  if (wcFixtures.length > 0) {
    const fid = wcFixtures[0].FixtureId
    console.log(`\nFetching scores for fixture ${fid}...`)
    const scores = await http.get(`/scores/snapshot/${fid}`)
    console.log(`  Score records: ${scores.data.length}`)

    const odds = await http.get(`/odds/snapshot/${fid}`)
    console.log(`  Odds entries: ${odds.data.length}`)
  }

  console.log('\nDone!')
}

main().catch(console.error)
