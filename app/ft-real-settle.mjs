// ft-real-settle.mjs — settle a fulltime market from a REAL TxLINE validate_stat proof.
//
// Fetches the finalised (period==100) proof for a finished fixture, Borsh-encodes it
// into the program's ValidateStatArgs, and calls `settle` via a CPI to TxLINE's
// on-chain validate_stat. A valid proof settles; a tampered goal value makes TxLINE's
// Merkle check fail and the tx reverts.
//
//   DEPLOYER_KEYPAIR=deployer.json CREDS=txline-creds.json FIXTURE=18202701 node ft-real-settle.mjs
//
// Env:
//   MODE=cpi-test   -> current program (settle takes an `outcome` arg); just checks the CPI validates.
//   MODE=real       -> new program (settle derives the outcome on-chain); no outcome arg.  [default]
//   TAMPER=1        -> corrupt a goal value to prove the fraud path reverts.
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  TransactionInstruction, sendAndConfirmTransaction, ComputeBudgetProgram,
} from '@solana/web3.js'
import { createHash } from 'crypto'
import fs from 'fs'

const RPC = 'https://api.devnet.solana.com'
const API = 'https://txline-dev.txodds.com'
const PROGRAM = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const TXLINE = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')
const FIXTURE = Number(process.env.FIXTURE || 18202701)
const MODE = process.env.MODE || 'real'
const TAMPER = process.env.TAMPER === '1'
const conn = new Connection(RPC, 'confirmed')
const agent = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'))))
const creds = JSON.parse(fs.readFileSync(process.env.CREDS, 'utf8'))
const apiToken = typeof creds.apiToken === 'string' ? creds.apiToken : creds.apiToken.token
const EX = s => `https://explorer.solana.com/tx/${s}?cluster=devnet`

// ---- borsh helpers ----
const disc = n => createHash('sha256').update(`global:${n}`).digest().subarray(0, 8)
const i64 = n => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b }
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const i32 = n => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b }
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }
const bytes32 = arr => Buffer.from(arr)
const cat = (...a) => Buffer.concat(a.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x)))
const vec = (arr, enc) => cat(u32(arr.length), ...arr.map(enc))
const proofNode = n => cat(bytes32(n.hash), Buffer.from([n.isRightSibling ? 1 : 0]))
const scoreStat = s => cat(u32(s.key), i32(s.value), i32(s.period))
const statTerm = (stat, root, prf) => cat(scoreStat(stat), bytes32(root), vec(prf, proofNode))

// ---- TxLINE ----
let JWT = null
async function tx(path) {
  if (!JWT) JWT = (await (await fetch(`${API}/auth/guest/start`, { method: 'POST' })).json()).token
  const r = await fetch(`${API}/api${path}`, { headers: { Authorization: `Bearer ${JWT}`, 'X-Api-Token': apiToken } })
  if (!r.ok) throw new Error(`${path} -> ${r.status}`)
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

// map proof -> ValidateStatArgs bytes.  YES = team1 goals - team2 goals > 0.
function encodeArgs(proof) {
  const s = proof
  const stats = s.statsToProve.map(x => ({ ...x })) // key1, key2
  if (TAMPER) stats[0].value += 1 // corrupt team1 goals -> Merkle leaf won't match -> revert
  const summary = cat(
    i64(s.summary.fixtureId),
    cat(i32(s.summary.updateStats.updateCount), i64(s.summary.updateStats.minTimestamp), i64(s.summary.updateStats.maxTimestamp)),
    bytes32(s.summary.eventStatsSubTreeRoot),
  )
  const predicate = cat(i32(0), Buffer.from([0])) // threshold 0, Comparison::GreaterThan
  const statA = statTerm(stats[0], s.eventStatRoot, s.statProofs[0])
  const statB = cat(Buffer.from([1]), statTerm(stats[1], s.eventStatRoot, s.statProofs[1])) // Option::Some
  const op = cat(Buffer.from([1]), Buffer.from([1])) // Option::Some(BinaryExpression::Subtract)
  return cat(
    i64(s.ts), summary,
    vec(s.subTreeProof, proofNode),   // fixture_proof
    vec(s.mainTreeProof, proofNode),  // main_tree_proof
    predicate, statA, statB, op,
  )
}

function rootsPda(minTsMs) {
  const day = Math.floor(minTsMs / 86400000)
  const b = Buffer.alloc(2); b.writeUInt16LE(day & 0xffff)
  return PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), b], TXLINE)[0]
}

const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
async function send(ixs, signers, label) {
  const sig = await sendAndConfirmTransaction(conn, new Transaction().add(...ixs), signers, { commitment: 'confirmed', skipPreflight: false })
  console.log(`  tx ${label}: ${EX(sig)}`); return sig
}

// ---- run ----
const { seq, proof } = await finalProof(FIXTURE)
console.log(`Fixture ${FIXTURE}: finalised proof seq=${seq}, goals ${proof.statsToProve[0].value}-${proof.statsToProve[1].value} (period 100)`)
const expectedOutcome = proof.statsToProve[0].value > proof.statsToProve[1].value ? 0 : 1 // 0=Yes
console.log(`Real result -> ${expectedOutcome === 0 ? 'YES (team1 wins)' : 'NO'}${TAMPER ? '  [TAMPERED: expect REVERT]' : ''}`)

// fresh market bound to this fixture (nonce id so the script is re-runnable in cpi-test mode)
const marketFixtureId = MODE === 'real' ? BigInt(FIXTURE) : BigInt(process.env.MARKET_NONCE || Date.now())
const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), u64(marketFixtureId)], PROGRAM)
const rootsAcct = rootsPda(proof.summary.updateStats.minTimestamp)
console.log(`market ${marketPda.toBase58()} (fixture_id ${marketFixtureId}) · roots ${rootsAcct.toBase58()}`)

// create the market (MatchWinner team1_key=1, team2_key=2 to match goal stat keys) unless it exists
const existing = await conn.getAccountInfo(marketPda)
if (!existing) {
  await send([new TransactionInstruction({
    programId: PROGRAM, data: cat(disc('create_market'), u64(marketFixtureId), cat(Buffer.from([0]), u16(1), u16(2)), agent.publicKey.toBuffer()),
    keys: [{ pubkey: agent.publicKey, isSigner: true, isWritable: true }, { pubkey: marketPda, isSigner: false, isWritable: true }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }],
  })], [agent], 'create_market')
} else console.log('  (market already exists — reusing)')

// build settle data: current program takes `outcome`; new program derives it.
const argBytes = encodeArgs(proof)
const data = MODE === 'real'
  ? cat(disc('settle'), argBytes)
  : cat(disc('settle'), argBytes, Buffer.from([expectedOutcome]))
const settleIx = new TransactionInstruction({
  programId: PROGRAM, data,
  keys: [
    { pubkey: marketPda, isSigner: false, isWritable: true },
    { pubkey: agent.publicKey, isSigner: true, isWritable: false },
    { pubkey: TXLINE, isSigner: false, isWritable: false },
    { pubkey: rootsAcct, isSigner: false, isWritable: false },
  ],
})
try {
  await send([ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }), settleIx], [agent], 'settle')
  const m = await conn.getAccountInfo(marketPda)
  // Market layout: 8 disc + 32 authority + 8 fixture_id + market_type(variant+..) ... resolution near the end.
  console.log(TAMPER ? '  ⚠️ UNEXPECTED: tampered proof did NOT revert' : '  ✅ settle succeeded — proof validated on-chain')
} catch (e) {
  const msg = (e.transactionLogs || e.logs || []).join('\n') || e.message
  console.log(TAMPER ? '  ✅ EXPECTED: tampered proof reverted (Merkle check failed)' : '  ❌ settle reverted')
  console.log(String(msg).split('\n').filter(l => /Error|failed|Program log|constraint|Merkle|proof/i.test(l)).slice(0, 8).join('\n'))
}
