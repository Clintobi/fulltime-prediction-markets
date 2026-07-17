import fs from 'fs'
import axios from 'axios'
const API = 'https://txline-dev.txodds.com'
const creds = JSON.parse(fs.readFileSync(process.env.CREDS, 'utf8'))
const apiToken = typeof creds.apiToken === 'string' ? creds.apiToken : (creds.apiToken.token || creds.apiToken)
const jwt = (await axios.post(`${API}/auth/guest/start`)).data.token
const H = { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken, 'Content-Type': 'application/json' }
const http = axios.create({ baseURL: `${API}/api`, headers: H, timeout: 30000 })

for (const fid of [18257739, 18257865]) {
  console.log(`\n===== fixture ${fid} =====`)
  const recs = (await http.get(`/scores/snapshot/${fid}`)).data
  console.log('records:', JSON.stringify(recs, null, 1).slice(0, 1200))
  // try stat-validation with each record's seq
  for (const r of (Array.isArray(recs) ? recs : [])) {
    const seq = r.seq ?? r.Seq ?? r.sequence
    for (const statKeys of ['1,2', '10,11', '0,1']) {
      try {
        const sv = await http.get('/scores/stat-validation', { params: { fixtureId: fid, seq, statKeys } })
        console.log(`   ✅ stat-validation seq=${seq} keys=${statKeys}:`, JSON.stringify(sv.data).slice(0, 300))
        fs.writeFileSync(process.env.PROOF_OUT, JSON.stringify({ fixtureId: fid, seq, statKeys, proof: sv.data }, null, 2))
        console.log('   saved ->', process.env.PROOF_OUT)
      } catch (e) { console.log(`   seq=${seq} keys=${statKeys} -> ${e.response?.status} ${(JSON.stringify(e.response?.data)||'').slice(0,90)}`) }
    }
  }
}
