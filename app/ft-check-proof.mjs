// Checks whether the showcase fixtures have a fetchable settlement proof yet.
// When one is available it dumps the exact response shape so the proof->CPI
// mapping for the real `settle` can be finalized. Run periodically on match day.
//   CREDS=txline-creds.json node ft-check-proof.mjs
import fs from 'fs'
import axios from 'axios'
const API = 'https://txline-dev.txodds.com'
const creds = JSON.parse(fs.readFileSync(process.env.CREDS, 'utf8'))
const apiToken = typeof creds.apiToken === 'string' ? creds.apiToken : (creds.apiToken.token || creds.apiToken)
const jwt = (await axios.post(`${API}/auth/guest/start`)).data.token
const H = { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken, 'Content-Type': 'application/json' }
const http = axios.create({ baseURL: `${API}/api`, headers: H, timeout: 30000 })

const FIXTURES = { 18257865: 'France v England', 18257739: 'Spain v Argentina' }
let ready = false
for (const [fid, name] of Object.entries(FIXTURES)) {
  const recs = (await http.get(`/scores/snapshot/${fid}`)).data
  const arr = Array.isArray(recs) ? recs : []
  const withStats = arr.filter(r => r.Stats && Object.keys(r.Stats).length)
  const finalised = arr.find(r => /final|finish|ft/i.test(`${r.Action}${r.GameState}`))
  console.log(`${name} (${fid}): ${arr.length} records, ${withStats.length} with stats${finalised ? ', FINALISED' : ''}`)
  // try stat-validation across seqs
  for (const r of arr) {
    const seq = r.Seq ?? r.seq
    try {
      const sv = await http.get('/scores/stat-validation', { params: { fixtureId: fid, seq, statKeys: '1,2' } })
      console.log(`  ✅ PROOF AVAILABLE at seq=${seq}`)
      console.log(JSON.stringify(sv.data, null, 2).slice(0, 2000))
      fs.writeFileSync(process.env.OUT || `/tmp/proof-${fid}.json`, JSON.stringify({ fixtureId: fid, seq, proof: sv.data }, null, 2))
      ready = true
      break
    } catch (e) { /* 404 = not ready */ }
  }
}
console.log(ready ? '\n>>> PROOF READY — finalize the real settle.' : '\n>>> No proof yet — re-run after the match finalizes.')
process.exit(ready ? 0 : 3)
