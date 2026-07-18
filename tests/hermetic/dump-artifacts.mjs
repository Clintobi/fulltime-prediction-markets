// dump-artifacts.mjs — STEP 1 of the hermetic test suite.
//
// Dumps the REAL on-chain bytes the LiteSVM tests need, using ONLY devnet
// JSON-RPC (no `solana` CLI, no local validator):
//   - txline.so    : the real TxLINE oracle ELF (extracted from its ProgramData)
//   - fulltime.so  : the real Fulltime program ELF
//   - roots.json   : the real daily_scores_merkle_roots PDA (pubkey + full data)
//   - proof.json   : a real finalised (period==100) validate_stat proof + metadata
//
//   CREDS=~/fulltime-keys/txline-creds.json node dump-artifacts.mjs [fixtureId]
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { Connection, PublicKey } from '@solana/web3.js'

const RPC = 'https://api.devnet.solana.com'
const API = 'https://txline-dev.txodds.com'
const TXLINE = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')
const FULLTIME = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const FIXTURE = Number(process.argv[2] || process.env.FIXTURE || 18179549)

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'artifacts')
fs.mkdirSync(OUT, { recursive: true })

const conn = new Connection(RPC, 'confirmed')
const credsPath = (process.env.CREDS || '~/fulltime-keys/txline-creds.json').replace('~', os.homedir())
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
const apiToken = typeof creds.apiToken === 'string' ? creds.apiToken : creds.apiToken.token

// --- extract the raw ELF from an upgradeable Program account -----------------
async function dumpProgramSo(programId, outName) {
  const prog = await conn.getAccountInfo(programId)
  if (!prog) throw new Error(`program ${programId} not found`)
  // UpgradeableLoaderState::Program { programdata_address }: tag u32 (=2), then 32-byte pubkey.
  const programDataAddr = new PublicKey(prog.data.subarray(4, 36))
  const pd = await conn.getAccountInfo(programDataAddr)
  if (!pd) throw new Error(`programdata ${programDataAddr} not found`)
  // UpgradeableLoaderState::ProgramData { slot u64, Option<Pubkey> }: tag u32(=3)+slot(8)+opt(1+32)=45.
  const elf = pd.data.subarray(45)
  const file = path.join(OUT, outName)
  fs.writeFileSync(file, elf)
  console.log(`  ${outName}: ${elf.length} bytes  (programdata ${programDataAddr.toBase58()})`)
  return elf.length
}

// --- TxLINE API --------------------------------------------------------------
let JWT = null
async function tx(p) {
  if (!JWT) JWT = (await (await fetch(`${API}/auth/guest/start`, { method: 'POST' })).json()).token
  const r = await fetch(`${API}/api${p}`, { headers: { Authorization: `Bearer ${JWT}`, 'X-Api-Token': apiToken } })
  if (!r.ok) throw new Error(`${p} -> ${r.status}`)
  return r.json()
}
async function finalProof(fixtureId) {
  const rows = await tx(`/scores/snapshot/${fixtureId}`)
  const seqs = [...new Set(rows.map(r => r.Seq).filter(x => x != null))].sort((a, b) => b - a)
  for (const seq of seqs.slice(0, 20)) {
    const p = await tx(`/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKeys=1,2`).catch(() => null)
    if (p && Array.isArray(p.statsToProve) && p.statsToProve.every(s => s.period === 100)) return { seq, proof: p }
  }
  throw new Error('no period-100 (full-time) proof found')
}

function rootsPdaFor(minTsMs) {
  const day = Math.floor(minTsMs / 86_400_000)
  const b = Buffer.alloc(2); b.writeUInt16LE(day & 0xffff)
  return { pda: PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), b], TXLINE)[0], day }
}

// --- run ---------------------------------------------------------------------
console.log('STEP 1 — dumping real artifacts via devnet RPC + TxLINE API')
console.log('programs:')
const txlineSize = await dumpProgramSo(TXLINE, 'txline.so')
const fulltimeSize = await dumpProgramSo(FULLTIME, 'fulltime.so')

console.log(`proof: fixture ${FIXTURE}`)
const { seq, proof } = await finalProof(FIXTURE)
const g0 = proof.statsToProve[0].value, g1 = proof.statsToProve[1].value
const expectedOutcome = g0 > g1 ? 'Yes' : 'No'
console.log(`  seq=${seq}  goals ${g0}-${g1} (period 100)  MatchWinner -> ${expectedOutcome}`)

const minTs = proof.summary.updateStats.minTimestamp
const maxTs = proof.summary.updateStats.maxTimestamp
const { pda: rootsPda, day } = rootsPdaFor(minTs)
console.log(`  day=${day}  rootsPda=${rootsPda.toBase58()}`)

const rootsAcct = await conn.getAccountInfo(rootsPda)
if (!rootsAcct) throw new Error(`roots account ${rootsPda} is GONE on devnet — pick another fixture`)
const roots = {
  pubkey: rootsPda.toBase58(),
  owner: rootsAcct.owner.toBase58(),
  lamports: rootsAcct.lamports,
  executable: rootsAcct.executable,
  rentEpoch: Number(rootsAcct.rentEpoch ?? 0),
  dataLen: rootsAcct.data.length,
  dataBase64: rootsAcct.data.toString('base64'),
}
fs.writeFileSync(path.join(OUT, 'roots.json'), JSON.stringify(roots, null, 2))
console.log(`  roots.json: ${roots.dataLen} bytes, owner ${roots.owner}`)

const meta = {
  fixtureId: FIXTURE,
  seq,
  realScore: { team1: g0, team2: g1, statKey1: proof.statsToProve[0].key, statKey2: proof.statsToProve[1].key },
  expectedOutcome,            // MatchWinner outcome derived from the real score
  minTimestamp: minTs,
  maxTimestamp: maxTs,
  day,
  rootsPda: rootsPda.toBase58(),
  txlineProgram: TXLINE.toBase58(),
  fulltimeProgram: FULLTIME.toBase58(),
  raw: proof,                 // full TxLINE stat-validation response — encoded in-test
}
fs.writeFileSync(path.join(OUT, 'proof.json'), JSON.stringify(meta, null, 2))
console.log(`  proof.json: fixture ${FIXTURE}, expectedOutcome=${expectedOutcome}`)

fs.writeFileSync(path.join(OUT, 'MANIFEST.json'), JSON.stringify({
  dumpedAt: new Date().toISOString(),
  rpc: RPC,
  txlineSo: { file: 'txline.so', bytes: txlineSize, address: TXLINE.toBase58() },
  fulltimeSo: { file: 'fulltime.so', bytes: fulltimeSize, address: FULLTIME.toBase58() },
  roots: { file: 'roots.json', pubkey: roots.pubkey, bytes: roots.dataLen },
  proof: { file: 'proof.json', fixtureId: FIXTURE, score: `${g0}-${g1}`, outcome: expectedOutcome },
}, null, 2))
console.log('done.')
