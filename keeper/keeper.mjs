#!/usr/bin/env node
// keeper.mjs — permissionless auto-settle keeper for the "Fulltime" Solana
// prediction market (program 37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW).
//
// On a loop it: (a) enumerates open Fulltime markets on-chain, (b) for each,
// asks TxLINE for a finalised (full-time / period-100) score proof, and (c) if a
// valid proof exists, settles the market permissionlessly by building and sending
// the real settle-from-proof transaction (the outcome is DERIVED on-chain from
// TxLINE's Merkle verdict — the keeper never chooses it, and a tampered proof just
// reverts). Nobody is privileged: any keeper, or any bettor, can call settle.
//
//   Modes:
//     node keeper.mjs                # loop forever (default)
//     node keeper.mjs --once         # single pass (CI / demo)
//     node keeper.mjs --dry-run      # detect + log; send NO transactions
//     node keeper.mjs --once --dry-run
//
//   Env:
//     RPC_URL         Solana RPC          (default https://api.devnet.solana.com)
//     CREDS           TxLINE creds JSON   (default ~/fulltime-keys/txline-creds.json)
//     KEEPER_KEYPAIR  fee-payer keypair   (default ~/fulltime-keys/deployer.json)
//     TXLINE_API_TOKEN  overrides the credentials file token
//     WATCHLIST       comma-separated fixture ids to check in addition to the
//                     on-chain scan (fallback if the RPC blocks getProgramAccounts)
//     INTERVAL_MS     loop pause between passes (default 30000)
//     MAX_BACKOFF_MS  cap on exponential backoff after RPC errors (default 60000)
//
// Reuses the Borsh encoding and settle-tx construction proven in app/ft-real-settle.mjs.

import {
  Connection, Keypair, PublicKey, Transaction,
  TransactionInstruction, sendAndConfirmTransaction, ComputeBudgetProgram,
} from '@solana/web3.js'
import { createHash } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { classifyScoreFeed } from './policy.mjs'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PROGRAM = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const TXLINE = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')
const TXLINE_API = process.env.TXLINE_API || 'https://txline-dev.txodds.com'
const DAY_MS = 86_400_000

const expand = p => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)

const argv = new Set(process.argv.slice(2))
const ONCE = argv.has('--once')
const DRY_RUN = argv.has('--dry-run')

const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com'
const CREDS_PATH = expand(process.env.CREDS || '~/fulltime-keys/txline-creds.json')
const KEYPAIR_PATH = expand(process.env.KEEPER_KEYPAIR || '~/fulltime-keys/deployer.json')
const WATCHLIST = (process.env.WATCHLIST || '')
  .split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(Number.isFinite)
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 30_000)
const MAX_BACKOFF_MS = Number(process.env.MAX_BACKOFF_MS || 60_000)

const conn = new Connection(RPC_URL, 'confirmed')
const EX = s => `https://explorer.solana.com/tx/${s}?cluster=devnet`

// ---------------------------------------------------------------------------
// Structured JSON logging
// ---------------------------------------------------------------------------
function log(level, event, fields = {}) {
  process.stdout.write(JSON.stringify({ t: new Date().toISOString(), level, event, ...fields }) + '\n')
}
const info = (e, f) => log('info', e, f)
const warn = (e, f) => log('warn', e, f)
const error = (e, f) => log('error', e, f)

// ---------------------------------------------------------------------------
// Load TxLINE API token (environment -> credentials file). Never ship credentials.
// ---------------------------------------------------------------------------
function loadApiToken() {
  if (process.env.TXLINE_API_TOKEN) return process.env.TXLINE_API_TOKEN
  try {
    const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'))
    const t = typeof creds.apiToken === 'string' ? creds.apiToken : creds.apiToken?.token
    if (t) return t
  } catch { /* fall through */ }
  return null
}
const API_TOKEN = loadApiToken()
if (!API_TOKEN) {
  error('startup_fatal', { reason: 'no_txline_api_token', hint: 'set TXLINE_API_TOKEN or CREDS; the judge verifier uses recorded proofs and needs neither' })
  process.exit(1)
}

// Fee-payer / settler keypair. Optional in --dry-run (we never send a tx there).
let settler = null
function loadKeypairOrNull() {
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'))))
  } catch { return null }
}
settler = loadKeypairOrNull()
if (!settler && !DRY_RUN) {
  error('startup_fatal', { reason: 'no_keypair', keypair: KEYPAIR_PATH, hint: 'set KEEPER_KEYPAIR to a fee-payer json, or use --dry-run' })
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Borsh helpers (byte-compatible with the program's ValidateStatArgs).
// Ported verbatim from app/ft-real-settle.mjs.
// ---------------------------------------------------------------------------
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

// Encode a MatchWinner ValidateStatArgs from a TxLINE proof.
// YES <=> team1_goals - team2_goals > 0 (matches the program's predicate constraint).
// `pairs` is [{stat, proof}] ordered so pairs[0].stat.key == team1_key, pairs[1] == team2_key.
function encodeMatchWinnerArgs(proof, pairs) {
  const s = proof
  const summary = cat(
    i64(s.summary.fixtureId),
    cat(i32(s.summary.updateStats.updateCount), i64(s.summary.updateStats.minTimestamp), i64(s.summary.updateStats.maxTimestamp)),
    bytes32(s.summary.eventStatsSubTreeRoot),
  )
  const predicate = cat(i32(0), Buffer.from([0]))                 // threshold 0, Comparison::GreaterThan
  const statA = statTerm(pairs[0].stat, s.eventStatRoot, pairs[0].proof)
  const statB = cat(Buffer.from([1]), statTerm(pairs[1].stat, s.eventStatRoot, pairs[1].proof)) // Option::Some
  const op = cat(Buffer.from([1]), Buffer.from([1]))              // Option::Some(BinaryExpression::Subtract)
  // Top-level `ts` MUST equal the snapshot's min_timestamp (validate_stat rejects a mismatch).
  return cat(
    i64(s.summary.updateStats.minTimestamp), summary,
    vec(s.subTreeProof, proofNode),   // fixture_proof
    vec(s.mainTreeProof, proofNode),  // main_tree_proof
    predicate, statA, statB, op,
  )
}

function rootsPda(minTsMs) {
  const day = Math.floor(minTsMs / DAY_MS)
  const b = Buffer.alloc(2); b.writeUInt16LE(day & 0xffff)
  return PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), b], TXLINE)[0]
}

// ---------------------------------------------------------------------------
// Market account decoding
// ---------------------------------------------------------------------------
// Anchor account discriminator for the `Market` account.
const MARKET_DISC = createHash('sha256').update('account:Market').digest().subarray(0, 8)

// The account is always allocated to INIT_SPACE (111 bytes) but the *serialized*
// fields after `market_type` sit at an offset that depends on the enum variant's
// real length (MatchWinner=5B, Over/Exact=11B). So we decode the tag and compute
// the true `state` offset rather than hard-coding one (a fixed offset-85 memcmp
// only lines up for MatchWinner markets).
function decodeMarket(pubkey, data) {
  if (data.length < 8 || !data.subarray(0, 8).equals(MARKET_DISC)) return null
  const fixtureId = data.readBigUInt64LE(40)
  const tag = data[48]
  let type, team1Key = null, team2Key = null, statKey = null, threshold = null, mtLen
  if (tag === 0) {
    type = 'MatchWinner'
    team1Key = data.readUInt16LE(49); team2Key = data.readUInt16LE(51); mtLen = 5
  } else if (tag === 1) {
    type = 'OverUnder'
    statKey = data.readUInt16LE(49); threshold = data.readBigUInt64LE(51); mtLen = 11
  } else if (tag === 2) {
    type = 'ExactScore'
    statKey = data.readUInt16LE(49); threshold = data.readBigUInt64LE(51); mtLen = 11
  } else return null
  const stateOff = 48 + mtLen + 32           // after market_type + settle_authority(32)
  const state = data[stateOff]               // 0=Open, 1=Settled
  const resOff = stateOff + 1 + 8 + 8         // after state(1)+yes(8)+no(8)
  const resolution = data[resOff] === 1 ? (data[resOff + 1] === 0 ? 'Yes' : 'No') : null
  return {
    pubkey: pubkey.toBase58(),
    fixtureId: Number(fixtureId),
    fixtureIdBig: fixtureId,
    type, team1Key, team2Key, statKey,
    threshold: threshold == null ? null : Number(threshold),
    state: state === 0 ? 'Open' : state === 1 ? 'Settled' : `unknown(${state})`,
    resolution,
  }
}

function marketPdaFor(fixtureIdBig) {
  return PublicKey.findProgramAddressSync([Buffer.from('market'), u64(fixtureIdBig)], PROGRAM)[0]
}

// ---------------------------------------------------------------------------
// TxLINE client (guest JWT + finalised proof lookup)
// ---------------------------------------------------------------------------
let JWT = null
async function txAuth() {
  const r = await fetch(`${TXLINE_API}/auth/guest/start`, { method: 'POST' })
  if (!r.ok) throw new Error(`txline auth ${r.status}`)
  JWT = (await r.json()).token
  return JWT
}
async function txGet(pathStr) {
  if (!JWT) await txAuth()
  let r = await fetch(`${TXLINE_API}/api${pathStr}`, { headers: { Authorization: `Bearer ${JWT}`, 'X-Api-Token': API_TOKEN } })
  if (r.status === 401 || r.status === 403) {          // stale guest token -> refresh once
    await txAuth()
    r = await fetch(`${TXLINE_API}/api${pathStr}`, { headers: { Authorization: `Bearer ${JWT}`, 'X-Api-Token': API_TOKEN } })
  }
  if (!r.ok) throw new Error(`${pathStr} -> ${r.status}`)
  const t = await r.text()
  try { return JSON.parse(t) } catch { return t }
}

// Find the finalised (all stats period==100) proof for a fixture and the requested
// stat keys. Returns { seq, proof } or null if none is available yet.
async function finalProof(fixtureId, statKeys) {
  const rows = await txGet(`/scores/snapshot/${fixtureId}`)
  const policy = classifyScoreFeed(rows, fixtureId)
  if (policy.state === 'malformed' || policy.state === 'void-review') return { policy }
  if (policy.state !== 'final') return { policy }
  const seqs = [...new Set(rows.map(r => r.Seq).filter(x => x != null))].sort((a, b) => b - a)
  for (const seq of seqs.slice(0, 20)) {
    const p = await txGet(`/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKeys=${statKeys}`).catch(() => null)
    if (p && Array.isArray(p.statsToProve) && p.statsToProve.length && p.statsToProve.every(s => s.period === 100)) {
      return { policy, seq, proof: p }
    }
  }
  return { policy: { state: 'pending', reason: 'final-score-has-no-validation-proof' } }
}

// ---------------------------------------------------------------------------
// Enumerate open markets (on-chain scan + optional watchlist)
// ---------------------------------------------------------------------------
async function enumerateMarkets() {
  const byPubkey = new Map()

  // 1) getProgramAccounts scan, filtered to Market accounts by discriminator.
  try {
    const accts = await conn.getProgramAccounts(PROGRAM, {
      filters: [{ memcmp: { offset: 0, bytes: bs58Encode(MARKET_DISC) } }],
    })
    for (const { pubkey, account } of accts) {
      const m = decodeMarket(pubkey, account.data)
      if (m) byPubkey.set(m.pubkey, m)
    }
    info('scan_ok', { source: 'getProgramAccounts', accounts: accts.length })
  } catch (e) {
    warn('scan_failed', { source: 'getProgramAccounts', err: String(e.message || e), fallback: WATCHLIST.length ? 'watchlist' : 'none' })
    if (!WATCHLIST.length) throw e                 // no fallback -> let the caller back off
  }

  // 2) Watchlist: fetch each fixture's market PDA directly (works even if the RPC
  //    blocks getProgramAccounts). Unioned with the scan.
  for (const fid of WATCHLIST) {
    const pda = marketPdaFor(BigInt(fid))
    try {
      const acc = await conn.getAccountInfo(pda)
      if (!acc) continue
      const m = decodeMarket(pda, acc.data)
      if (m) byPubkey.set(m.pubkey, m)
    } catch (e) {
      warn('watchlist_fetch_failed', { fixture: fid, err: String(e.message || e) })
    }
  }

  return [...byPubkey.values()]
}

// bs58 is a transitive dep of @solana/web3.js; import lazily so the file stays single-purpose.
import bs58 from 'bs58'
const bs58Encode = b => bs58.encode(b)

// ---------------------------------------------------------------------------
// Settle one market
// ---------------------------------------------------------------------------
// Returns one of:
//   { action:'skip', reason }                      not settleable (logged, never fatal)
//   { action:'would-settle', outcome, latencyMs }  dry-run detected a settleable market
//   { action:'settled', sig, outcome, latencyMs }  a real settle tx landed
async function processMarket(m) {
  if (m.state !== 'Open') return { action: 'skip', reason: 'not-open' }

  // Only MatchWinner is wired for goal-based settlement (the demo market type).
  // Other types would need type-specific proof params; skip them cleanly.
  if (m.type !== 'MatchWinner') return { action: 'skip', reason: `unsupported-type:${m.type}` }

  const statKeys = `${m.team1Key},${m.team2Key}`
  const found = await finalProof(m.fixtureId, statKeys)
  if (found.policy.state === 'malformed') return { action: 'skip', reason: `malformed-feed:${found.policy.reason}` }
  if (found.policy.state === 'void-review') return { action: 'skip', reason: 'postponed-void-review' }
  if (!found.proof) return { action: 'skip', reason: found.policy.reason || 'no-final-proof' }
  const { seq, proof } = found

  // Order (stat, statProof) pairs so index 0 == team1_key, index 1 == team2_key,
  // as the program's predicate constraint requires (guards against API ordering).
  const pairFor = key => {
    const idx = proof.statsToProve.findIndex(s => s.key === key)
    if (idx < 0) return null
    return { stat: proof.statsToProve[idx], proof: proof.statProofs[idx] }
  }
  const p1 = pairFor(m.team1Key), p2 = pairFor(m.team2Key)
  if (!p1 || !p2) return { action: 'skip', reason: 'proof-missing-team-key' }

  // Roots account must be live on-chain or the CPI can't validate.
  const rootsAcct = rootsPda(proof.summary.updateStats.minTimestamp)
  const rootsInfo = await conn.getAccountInfo(rootsAcct)
  if (!rootsInfo) return { action: 'skip', reason: 'roots-account-missing', roots: rootsAcct.toBase58() }

  const g1 = p1.stat.value, g2 = p2.stat.value
  const outcome = g1 > g2 ? 'Yes' : 'No'
  const finalTs = proof.summary.updateStats.maxTimestamp   // full-time / last-update time
  const latencyMs = Date.now() - finalTs

  const detail = { market: m.pubkey, fixture: m.fixtureId, seq, score: `${g1}-${g2}`, outcome, roots: rootsAcct.toBase58() }

  if (DRY_RUN) {
    info('would_settle', { ...detail, latencyMs, note: 'dry-run: no transaction sent' })
    return { action: 'would-settle', outcome, latencyMs }
  }

  // Build + send the real settle-from-proof tx (reuses ft-real-settle encoding).
  const argBytes = encodeMatchWinnerArgs(proof, [p1, p2])
  const data = cat(disc('settle'), argBytes)
  const marketPk = new PublicKey(m.pubkey)
  const settleIx = new TransactionInstruction({
    programId: PROGRAM, data,
    keys: [
      { pubkey: marketPk, isSigner: false, isWritable: true },
      { pubkey: settler.publicKey, isSigner: true, isWritable: false },
      { pubkey: TXLINE, isSigner: false, isWritable: false },
      { pubkey: rootsAcct, isSigner: false, isWritable: false },
    ],
  })
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
    settleIx,
  )
  const sig = await sendAndConfirmTransaction(conn, tx, [settler], { commitment: 'confirmed', skipPreflight: false })

  // Confirm the DERIVED on-chain resolution (state@stateOff, resolution shortly after).
  const after = decodeMarket(marketPk, (await conn.getAccountInfo(marketPk)).data)
  info('settled', { ...detail, sig, explorer: EX(sig), onchainResolution: after?.resolution, latencyMs })
  return { action: 'settled', sig, outcome, latencyMs }
}

// ---------------------------------------------------------------------------
// One pass over all markets
// ---------------------------------------------------------------------------
const lifetime = { passes: 0, settled: 0, latencies: [] }

async function runPass() {
  const started = Date.now()
  lifetime.passes++
  const metrics = { scanned: 0, open: 0, settleable: 0, settled: 0, skipped: {} }
  const bump = reason => { metrics.skipped[reason] = (metrics.skipped[reason] || 0) + 1 }

  const markets = await enumerateMarkets()
  metrics.scanned = markets.length
  const open = markets.filter(m => m.state === 'Open')
  metrics.open = open.length
  info('open_markets', { count: open.length, fixtures: open.map(m => m.fixtureId) })

  for (const m of open) {
    try {
      const r = await processMarket(m)
      if (r.action === 'skip') { bump(r.reason); info('skip', { market: m.pubkey, fixture: m.fixtureId, reason: r.reason }) }
      else if (r.action === 'would-settle') { metrics.settleable++ }
      else if (r.action === 'settled') {
        metrics.settleable++; metrics.settled++; lifetime.settled++
        if (Number.isFinite(r.latencyMs)) lifetime.latencies.push(r.latencyMs)
      }
    } catch (e) {
      // A revert / RPC hiccup on ONE market is logged and skipped — never crashes the loop.
      const logs = (e.transactionLogs || e.logs || [])
      const hint = logs.filter(l => /Error|failed|constraint|Merkle|proof|NotOpen|custom program/i.test(l)).slice(0, 4)
      bump('error')
      error('market_error', { market: m.pubkey, fixture: m.fixtureId, err: String(e.message || e), logs: hint })
    }
  }

  const avgLatencyMs = lifetime.latencies.length
    ? Math.round(lifetime.latencies.reduce((a, b) => a + b, 0) / lifetime.latencies.length)
    : null
  info('pass_summary', {
    pass: lifetime.passes,
    durationMs: Date.now() - started,
    dryRun: DRY_RUN,
    scanned: metrics.scanned,
    open: metrics.open,
    settleable: metrics.settleable,
    settled: metrics.settled,
    skipped: metrics.skipped,
    lifetimeSettled: lifetime.settled,
    avgSettleLatencyMs: avgLatencyMs,           // final-whistle proof ts -> on-chain settlement
  })
  return metrics
}

// ---------------------------------------------------------------------------
// Main loop with exponential backoff on RPC/pass errors
// ---------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  info('keeper_start', {
    mode: ONCE ? 'once' : 'loop',
    dryRun: DRY_RUN,
    rpc: RPC_URL,
    program: PROGRAM.toBase58(),
    txlineApi: TXLINE_API,
    settler: settler ? settler.publicKey.toBase58() : '(none — dry-run)',
    watchlist: WATCHLIST,
    intervalMs: INTERVAL_MS,
  })

  let backoff = 1_000
  let stop = false
  process.on('SIGINT', () => { warn('sigint', { note: 'shutting down after current pass' }); stop = true })
  process.on('SIGTERM', () => { warn('sigterm', { note: 'shutting down after current pass' }); stop = true })

  do {
    try {
      await runPass()
      backoff = 1_000                              // reset on a clean pass
      if (ONCE || stop) break
      await sleep(INTERVAL_MS)
    } catch (e) {
      error('pass_error', { err: String(e.message || e), backoffMs: backoff })
      if (ONCE) { process.exitCode = 1; break }     // surface failure to CI
      await sleep(backoff)
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
    }
  } while (!stop)

  info('keeper_stop', { passes: lifetime.passes, lifetimeSettled: lifetime.settled })
}

main().catch(e => { error('fatal', { err: String(e.stack || e) }); process.exit(1) })
