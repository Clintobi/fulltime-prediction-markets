// Hermetic settlement tests — run the REAL TxLINE oracle binary in-process (LiteSVM)
// against its REAL anchored daily_scores_roots and a REAL finalised proof. No devnet,
// no validator, no mock: our settle() CPIs the genuine validate_stat and we assert the
// outcome is DERIVED from its verdict, and that every fraud path reverts.
//
//   node dump-artifacts.mjs      # once, produces artifacts/
//   node --test settle.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import { LiteSVM } from 'litesvm'
import {
  PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram,
} from '@solana/web3.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const A = path.join(HERE, 'artifacts')
const proof = JSON.parse(fs.readFileSync(path.join(A, 'proof.json'), 'utf8'))
const roots = JSON.parse(fs.readFileSync(path.join(A, 'roots.json'), 'utf8'))
const FULLTIME = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const TXLINE = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')

// ---- borsh helpers (mirror app/ft-real-settle.mjs) ----
const disc = n => createHash('sha256').update(`global:${n}`).digest().subarray(0, 8)
const i64 = n => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b }
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const i32 = n => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b }
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const b32 = a => Buffer.from(a)
const cat = (...a) => Buffer.concat(a.map(x => (Buffer.isBuffer(x) ? x : Buffer.from(x))))
const vec = (arr, enc) => cat(u32(arr.length), ...arr.map(enc))
const proofNode = n => cat(b32(n.hash), Buffer.from([n.isRightSibling ? 1 : 0]))
const scoreStat = s => cat(u32(s.key), i32(s.value), i32(s.period))
const statTerm = (stat, root, prf) => cat(scoreStat(stat), b32(root), vec(prf, proofNode))

// Encode ValidateStatArgs for a MatchWinner proof (team1 - team2 > 0). `mut` lets a
// test corrupt a copy of the proof for the tamper/attack cases.
function encodeArgs(raw, mut = x => x) {
  const s = mut(JSON.parse(JSON.stringify(raw)))
  const summary = cat(
    i64(s.summary.fixtureId),
    cat(i32(s.summary.updateStats.updateCount), i64(s.summary.updateStats.minTimestamp), i64(s.summary.updateStats.maxTimestamp)),
    b32(s.summary.eventStatsSubTreeRoot),
  )
  const predicate = cat(i32(0), Buffer.from([0]))                 // threshold 0, GreaterThan
  const statA = statTerm(s.statsToProve[0], s.eventStatRoot, s.statProofs[0])
  const statB = cat(Buffer.from([1]), statTerm(s.statsToProve[1], s.eventStatRoot, s.statProofs[1]))  // Some
  const op = cat(Buffer.from([1]), Buffer.from([1]))              // Some(Subtract)
  return cat(i64(s.summary.updateStats.minTimestamp), summary, vec(s.subTreeProof, proofNode), vec(s.mainTreeProof, proofNode), predicate, statA, statB, op)
}

const marketPda = fixtureId => PublicKey.findProgramAddressSync([Buffer.from('market'), u64(fixtureId)], FULLTIME)[0]
const rootsFor = minTsMs => {
  const day = Math.floor(minTsMs / 86_400_000)
  return PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), u16(day & 0xffff)], TXLINE)[0]
}

// Build a fresh SVM with both real programs + the real roots account loaded.
function freshSvm() {
  const svm = new LiteSVM()
  svm.addProgramFromFile(FULLTIME, path.join(A, 'fulltime.so'))
  svm.addProgramFromFile(TXLINE, path.join(A, 'txline.so'))
  const rootsPk = new PublicKey(roots.pubkey)
  svm.setAccount(rootsPk, {
    lamports: 1_000_000_000,
    data: new Uint8Array(Buffer.from(roots.dataBase64, 'base64')),
    owner: TXLINE,
    executable: false,
    rentEpoch: 0,
  })
  const payer = new Keypair()
  svm.airdrop(payer.publicKey, BigInt(10_000_000_000))
  return { svm, payer, rootsPk }
}

function send(svm, payer, ixs, signers = []) {
  const tx = new Transaction()
  ixs.forEach(ix => tx.add(ix))
  tx.recentBlockhash = svm.latestBlockhash()
  tx.feePayer = payer.publicKey
  tx.sign(payer, ...signers)
  return svm.sendTransaction(tx)
}
const failed = res => typeof res?.err === 'function' ? res.err() != null : res?.constructor?.name?.includes('Failed')
const logsOf = res => { try { return (res.meta ? res.meta() : res).logs?.() || res.logs?.() || [] } catch { return [] } }

function createMarketIx(payer, fixtureId, team1, team2) {
  const data = cat(disc('create_market'), u64(fixtureId), Buffer.from([0]), u16(team1), u16(team2), payer.publicKey.toBuffer())
  return new TransactionInstruction({
    programId: FULLTIME, data,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: marketPda(fixtureId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  })
}
function settleIx(payer, fixtureId, argBytes, rootsPk) {
  return new TransactionInstruction({
    programId: FULLTIME, data: cat(disc('settle'), argBytes),
    keys: [
      { pubkey: marketPda(fixtureId), isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: TXLINE, isSigner: false, isWritable: false },
      { pubkey: rootsPk, isSigner: false, isWritable: false },
    ],
  })
}

const FIX = proof.fixtureId
const T1 = proof.realScore.statKey1 // 1
const T2 = proof.realScore.statKey2 // 2
const realRoots = rootsFor(proof.raw.summary.updateStats.minTimestamp)

test('artifacts: real TxLINE binary + real roots + real proof loaded', () => {
  assert.equal(roots.owner, TXLINE.toBase58(), 'roots account is owned by the real TxLINE program')
  assert.equal(realRoots.toBase58(), roots.pubkey, 'roots PDA re-derives from the proof timestamp')
  assert.equal(proof.expectedOutcome, 'Yes')
})

test('HAPPY PATH: settle derives YES on-chain from the real validate_stat verdict', () => {
  const { svm, payer } = freshSvm()
  assert.ok(!failed(send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])), 'create_market')
  const res = send(svm, payer, [settleIx(payer, FIX, encodeArgs(proof.raw), realRoots)])
  assert.ok(!failed(res), 'settle should succeed: ' + logsOf(res).join('\n'))
  const logs = logsOf(res).join('\n')
  assert.match(logs, /Instruction: ValidateStat/, 'the REAL TxLINE validate_stat ran inside the CPI')
  const acct = svm.getAccount(marketPda(FIX))
  const d = Buffer.from(acct.data)
  assert.equal(d[85], 1, 'market is Settled')
  assert.equal(d[102], 1, 'resolution is Some')
  assert.equal(d[103], 0, 'resolution == YES (real 1-0), derived not caller-chosen')
})

test('ATTACK: tampered goal value -> Merkle check fails inside validate_stat -> revert', () => {
  const { svm, payer } = freshSvm()
  send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
  const tampered = encodeArgs(proof.raw, p => { p.statsToProve[0].value += 5; return p })
  const res = send(svm, payer, [settleIx(payer, FIX, tampered, realRoots)])
  assert.ok(failed(res), 'a tampered proof must revert')
})

test('ATTACK: proof for a different fixture -> FixtureMismatch', () => {
  const { svm, payer } = freshSvm()
  const otherFix = FIX + 1
  send(svm, payer, [createMarketIx(payer, otherFix, T1, T2)])
  const res = send(svm, payer, [settleIx(payer, otherFix, encodeArgs(proof.raw), realRoots)])
  assert.ok(failed(res), 'settling fixture N+1 with fixture N proof must revert')
  assert.match(logsOf(res).join('\n'), /FixtureMismatch|6006|custom program error/i)
})

test('ATTACK: substituted roots account -> RootsMismatch', () => {
  const { svm, payer } = freshSvm()
  send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
  const wrongRoots = PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), u16(9999)], TXLINE)[0]
  const res = send(svm, payer, [settleIx(payer, FIX, encodeArgs(proof.raw), wrongRoots)])
  assert.ok(failed(res), 'a roots account that does not match the proof day must revert')
})

test('ATTACK: non-final period (!= 100) -> NotFinal', () => {
  const { svm, payer } = freshSvm()
  send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
  const notFinal = encodeArgs(proof.raw, p => { p.statsToProve[0].period = 1; p.statsToProve[1].period = 1; return p })
  const res = send(svm, payer, [settleIx(payer, FIX, notFinal, realRoots)])
  assert.ok(failed(res), 'an in-play (period != 100) proof must revert')
})

test('ATTACK: predicate not matching the market question -> PredicateMismatch', () => {
  const { svm, payer } = freshSvm()
  // market asks team1(=T1) vs team2(=T2); create it with SWAPPED keys so the proof no longer matches
  send(svm, payer, [createMarketIx(payer, FIX, T2, T1)])
  const res = send(svm, payer, [settleIx(payer, FIX, encodeArgs(proof.raw), realRoots)])
  assert.ok(failed(res), 'a proof whose stats do not match the market question must revert')
})

test('ATTACK: settling an already-Settled market -> NotOpen', () => {
  const { svm, payer } = freshSvm()
  send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
  assert.ok(!failed(send(svm, payer, [settleIx(payer, FIX, encodeArgs(proof.raw), realRoots)])), 'first settle')
  const res = send(svm, payer, [settleIx(payer, FIX, encodeArgs(proof.raw), realRoots)])
  assert.ok(failed(res), 'a second settle on a Settled market must revert (NotOpen)')
})

// --- more real coverage on the same hermetic rig ---

test('create_market: initializes Open with zero pools and the right fixture', () => {
  const { svm, payer } = freshSvm()
  assert.ok(!failed(send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])))
  const d = Buffer.from(svm.getAccount(marketPda(FIX)).data)
  assert.equal(d[85], 0, 'state == Open')
  assert.equal(Number(d.readBigUInt64LE(40)), FIX, 'fixture_id stored')
  assert.equal(Number(d.readBigUInt64LE(86)), 0, 'yes pool 0')
  assert.equal(Number(d.readBigUInt64LE(94)), 0, 'no pool 0')
  assert.equal(d[102], 0, 'no resolution yet')
})

test('create_market: a market for the same fixture cannot be created twice', () => {
  const { svm, payer } = freshSvm()
  assert.ok(!failed(send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])))
  assert.ok(failed(send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])), 'second init on the same PDA must fail')
})

test('ATTACK: truncated settle args -> InstructionDidNotDeserialize', () => {
  const { svm, payer } = freshSvm()
  send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
  const res = send(svm, payer, [settleIx(payer, FIX, encodeArgs(proof.raw).subarray(0, 32), realRoots)])
  assert.ok(failed(res), 'a truncated ValidateStatArgs must revert at deserialization')
})

test('ATTACK: tampered team2 goal value -> revert', () => {
  const { svm, payer } = freshSvm()
  send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
  const t = encodeArgs(proof.raw, p => { p.statsToProve[1].value += 3; return p })
  assert.ok(failed(send(svm, payer, [settleIx(payer, FIX, t, realRoots)])))
})

test('ATTACK: tampered Merkle sub-tree proof node -> revert', () => {
  const { svm, payer } = freshSvm()
  send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
  const t = encodeArgs(proof.raw, p => { if (p.subTreeProof[0]) p.subTreeProof[0].hash[0] ^= 0xff; return p })
  assert.ok(failed(send(svm, payer, [settleIx(payer, FIX, t, realRoots)])))
})

test('ATTACK: tampered summary sub-tree root -> revert', () => {
  const { svm, payer } = freshSvm()
  send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
  const t = encodeArgs(proof.raw, p => { p.summary.eventStatsSubTreeRoot[0] ^= 0xff; return p })
  assert.ok(failed(send(svm, payer, [settleIx(payer, FIX, t, realRoots)])))
})

test('ATTACK: tampered stat Merkle proof (statProofs) -> revert', () => {
  const { svm, payer } = freshSvm()
  send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
  const t = encodeArgs(proof.raw, p => { if (p.statProofs[0]?.[0]) p.statProofs[0][0].hash[1] ^= 0xff; return p })
  assert.ok(failed(send(svm, payer, [settleIx(payer, FIX, t, realRoots)])))
})

test('DETERMINISM: two independent settlements of the real proof both derive YES', () => {
  for (let i = 0; i < 2; i++) {
    const { svm, payer } = freshSvm()
    send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
    const res = send(svm, payer, [settleIx(payer, FIX, encodeArgs(proof.raw), realRoots)])
    assert.ok(!failed(res), 'settle ' + i)
    assert.equal(Buffer.from(svm.getAccount(marketPda(FIX)).data)[103], 0, 'YES')
  }
})

// --- oracle-pin attack (added after pinning txline_program to the real oracle) ---

import { Keypair as _Kp } from '@solana/web3.js'

test('ATTACK: fake oracle at the txline_program slot -> rejected by the address pin', () => {
  const { svm, payer } = freshSvm()
  send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
  const fakeOracle = _Kp.generate().publicKey // NOT the real 6pW64… oracle
  const ix = new TransactionInstruction({
    programId: FULLTIME, data: cat(disc('settle'), encodeArgs(proof.raw)),
    keys: [
      { pubkey: marketPda(FIX), isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: fakeOracle, isSigner: false, isWritable: false }, // pinned -> must fail
      { pubkey: realRoots, isSigner: false, isWritable: false },
    ],
  })
  const res = send(svm, payer, [ix])
  assert.ok(failed(res), 'a non-canonical program at the txline_program slot must be rejected before any CPI')
})

test('ATTACK: roots account not owned by the real oracle -> rejected by the owner pin', () => {
  const { svm, payer } = freshSvm()
  send(svm, payer, [createMarketIx(payer, FIX, T1, T2)])
  // a roots-shaped account at the CORRECT PDA but owned by someone else
  const impostor = _Kp.generate().publicKey
  svm.setAccount(realRoots, { lamports: 1_000_000_000, data: new Uint8Array(64), owner: impostor, executable: false, rentEpoch: 0 })
  const res = send(svm, payer, [settleIx(payer, FIX, encodeArgs(proof.raw), realRoots)])
  assert.ok(failed(res), 'a roots account not owned by the real TxLINE program must be rejected')
})
