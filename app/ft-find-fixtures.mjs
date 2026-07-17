// ft-find-fixtures.mjs — list finished fixtures that are ready to settle for a demo:
// a full-time (period 100) validate_stat proof exists, its daily-roots account is
// on-chain, and no market for it has been settled yet (so ft-real-settle will work).
//   CREDS=txline-creds.json node ft-find-fixtures.mjs
import fs from 'fs'
import { Connection, PublicKey } from '@solana/web3.js'
const API = 'https://txline-dev.txodds.com'
const TXLINE = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')
const PROGRAM = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const conn = new Connection('https://api.devnet.solana.com', 'confirmed')
const creds = JSON.parse(fs.readFileSync(process.env.CREDS, 'utf8'))
const apiToken = typeof creds.apiToken === 'string' ? creds.apiToken : creds.apiToken.token
const jwt = (await (await fetch(`${API}/auth/guest/start`, { method: 'POST' })).json()).token
const H = { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken }
const get = async p => { const r = await fetch(`${API}/api${p}`, { headers: H }); const t = await r.text(); try { return JSON.parse(t) } catch { return t } }
const TEAM = { 1144:'India',1215:'Myanmar',1225:'New Zealand',1378:'Vietnam',1489:'Argentina',1519:'Australia',1634:'Brazil',1888:'England',1999:'France',2431:'Liechtenstein',3021:'Spain',45856:'Gibraltar' }
const name = id => TEAM[id] || `#${id}`
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }

// Check known finished fixtures (or any passed as CLI args). Snapshots only show a
// rolling *upcoming* window, so finished fixtures are checked by id here.
const DAY = 86_400_000
const fids = process.argv.slice(2).map(Number).filter(Boolean)
if (!fids.length) fids.push(18202701, 18192996, 18175918, 18193785, 18185036, 18179549)
console.log(`checking ${fids.length} finished fixtures for demo-readiness...`)
for (const fid of fids) {
  const rows = await get(`/scores/snapshot/${fid}`)
  if (!Array.isArray(rows)) continue
  const seqs = [...new Set(rows.map(r => r.Seq).filter(x => x != null))].sort((a,b)=>b-a)
  let proof = null
  for (const seq of seqs.slice(0, 20)) { const p = await get(`/scores/stat-validation?fixtureId=${fid}&seq=${seq}&statKeys=1,2`); if (p && Array.isArray(p.statsToProve) && p.statsToProve.every(s => s.period === 100)) { proof = p; break } }
  if (!proof) continue
  const day = Math.floor(proof.summary.updateStats.minTimestamp / DAY)
  const b = Buffer.alloc(2); b.writeUInt16LE(day & 0xffff)
  const roots = PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), b], TXLINE)[0]
  const rootsOk = !!(await conn.getAccountInfo(roots))
  const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), u64(BigInt(fid))], PROGRAM)
  const mkt = await conn.getAccountInfo(marketPda)
  const settled = mkt ? mkt.data[85] === 1 : false // Settled state byte (MatchWinner layout)
  const g = proof.statsToProve
  const fin = rows.find(r => r.Participant1Id)
  const ready = rootsOk && !settled
  console.log(`${ready ? '✅ FRESH' : '  used '} ${fid}  ${name(fin?.Participant1Id)} ${g[0].value}-${g[1].value} ${name(fin?.Participant2Id)}  -> ${g[0].value>g[1].value?'YES':'NO'}  roots=${rootsOk?'ok':'GONE'} market=${mkt?(settled?'settled':'open'):'none'}`)
}
