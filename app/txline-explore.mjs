// Explore TxLINE data with the API token: fixtures -> finished match -> scores -> stat-validation.
import fs from 'fs'
import axios from 'axios'
const API = 'https://txline-dev.txodds.com'
const creds = JSON.parse(fs.readFileSync(process.env.CREDS, 'utf8'))
const apiToken = typeof creds.apiToken === 'string' ? creds.apiToken : (creds.apiToken.token || creds.apiToken)

const jwt = (await axios.post(`${API}/auth/guest/start`)).data.token
const H = { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken, 'Content-Type': 'application/json' }
const http = axios.create({ baseURL: `${API}/api`, headers: H, timeout: 30000 })

console.log('[1] fixtures/snapshot...')
let fixtures = []
try {
  const r = await http.get('/fixtures/snapshot')
  fixtures = Array.isArray(r.data) ? r.data : (r.data.fixtures || [])
  console.log('   total fixtures:', fixtures.length)
  const sample = fixtures[0]
  console.log('   sample keys:', sample ? Object.keys(sample).join(', ') : '(none)')
  if (sample) console.log('   sample:', JSON.stringify(sample).slice(0, 300))
} catch (e) { console.error('   ❌', e.response?.status, JSON.stringify(e.response?.data)||e.message); process.exit(2) }

// Identify likely-finished fixtures (Status/GameState). Print distribution.
const byStatus = {}
for (const f of fixtures) { const k = f.Status || f.GameState || f.State || 'unknown'; byStatus[k] = (byStatus[k]||0)+1 }
console.log('   status distribution:', JSON.stringify(byStatus))

// Pick candidates that look finished
const finished = fixtures.filter(f => {
  const s = `${f.Status||''}`.toLowerCase(); const gs = f.GameState
  return s.includes('finish') || s.includes('ft') || s.includes('complete') || gs === 100 || gs === 3 || f.IsFinished
})
console.log('   finished-looking fixtures:', finished.length)
const cands = (finished.length ? finished : fixtures).slice(0, 5)
for (const f of cands) console.log('    -', f.FixtureId, '|', f.Participant1, 'vs', f.Participant2, '|', f.StartTime, '| status=', f.Status ?? f.GameState)

// For the first candidate, pull scores snapshot + historical
const fx = cands[0]
if (fx) {
  const fid = fx.FixtureId
  console.log(`\n[2] scores/snapshot/${fid}...`)
  try {
    const r = await http.get(`/scores/snapshot/${fid}`)
    const arr = Array.isArray(r.data) ? r.data : [r.data]
    console.log('   score records:', arr.length)
    const last = arr[arr.length-1]
    if (last) console.log('   latest:', JSON.stringify(last).slice(0,400))
  } catch (e) { console.error('   ❌ scores', e.response?.status, JSON.stringify(e.response?.data)||e.message) }

  console.log(`\n[3] scores/stat-validation for ${fid} (probe params)...`)
  for (const params of [
    { fixtureId: fid },
    { fixtureId: fid, statKeys: '1,2' },
    { fixtureId: fid, seq: 0, statKeys: '1,2' },
  ]) {
    try {
      const r = await http.get('/scores/stat-validation', { params })
      console.log('   ✅ params', JSON.stringify(params), '-> keys:', Object.keys(r.data).join(', '))
      console.log('   proof sample:', JSON.stringify(r.data).slice(0, 500))
      fs.writeFileSync(process.env.PROOF_OUT || '/tmp/txline-proof.json', JSON.stringify({ fixture: fx, params, proof: r.data }, null, 2))
      console.log('   saved proof ->', process.env.PROOF_OUT || '/tmp/txline-proof.json')
      break
    } catch (e) { console.log('   params', JSON.stringify(params), '->', e.response?.status, (JSON.stringify(e.response?.data)||e.message).slice(0,150)) }
  }
}
