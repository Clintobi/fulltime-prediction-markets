import fs from 'fs'
import axios from 'axios'
const API = 'https://txline-dev.txodds.com'
const creds = JSON.parse(fs.readFileSync(process.env.CREDS, 'utf8'))
const apiToken = typeof creds.apiToken === 'string' ? creds.apiToken : (creds.apiToken.token || creds.apiToken)
const jwt = (await axios.post(`${API}/auth/guest/start`)).data.token
const H = { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken, 'Content-Type': 'application/json' }
const http = axios.create({ baseURL: `${API}/api`, headers: H, timeout: 30000 })

const fixtures = (await http.get('/fixtures/snapshot')).data
console.log('fixtures:', fixtures.length)
for (const f of fixtures) {
  const fid = f.FixtureId
  let scores = 0, hist = 0, sv = 'no'
  try { const r = await http.get(`/scores/snapshot/${fid}`); scores = (Array.isArray(r.data)?r.data:[]).length } catch {}
  try { const r = await http.get(`/scores/historical/${fid}`); hist = (Array.isArray(r.data)?r.data:[]).length } catch {}
  try { const r = await http.get('/scores/stat-validation', { params: { fixtureId: fid, seq: 1, statKeys: '1,2' } }); sv = 'YES:'+Object.keys(r.data).join(',') } catch(e){ sv = 'no('+(e.response?.status)+')' }
  console.log(`  ${fid} ${f.Participant1} v ${f.Participant2} state=${f.GameState} start=${new Date(f.StartTime).toISOString().slice(0,10)} scores=${scores} hist=${hist} statVal=${sv}`)
}
// try other competitions / a wider fixtures pull
console.log('\n-- probe competitions --')
for (const cid of [430, 1, 240, 4, 77, 100]) {
  try { const r = await http.get('/fixtures/snapshot', { params: { competitionId: cid } }); console.log(`  competitionId=${cid}: ${Array.isArray(r.data)?r.data.length:'?'} fixtures`) } catch(e){ console.log(`  competitionId=${cid}: ${e.response?.status}`) }
}
// endpoints listing?
console.log('\n-- misc endpoints --')
for (const ep of ['/scores/updates/0/0/24', '/fixtures', '/competitions', '/leagues']) {
  try { const r = await http.get(ep); const n = Array.isArray(r.data)?r.data.length:JSON.stringify(r.data).slice(0,80); console.log(`  GET ${ep} -> ${n}`) } catch(e){ console.log(`  GET ${ep} -> ${e.response?.status}`) }
}
