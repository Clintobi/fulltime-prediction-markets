// ft-parlay-demo.mjs — full trustless parlay lifecycle on devnet:
// init config -> fund reward vault -> create a 2-leg ticket -> prove each leg from a
// REAL TxLINE proof -> claim. Leg 1: fixture 18179549 (1-0) predict YES (hits).
// Leg 2: fixture 18193785 (1-4) predict NO (hits). Both hit -> Won -> payout 1.9^2.
//   DEPLOYER_KEYPAIR=~/fulltime-keys/deployer.json CREDS=~/fulltime-keys/txline-creds.json node app/ft-parlay-demo.mjs
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction,
  sendAndConfirmTransaction, ComputeBudgetProgram,
} from '@solana/web3.js'
import {
  TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAccount,
} from '@solana/spl-token'
import { createHash } from 'crypto'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
const cfg = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'src/lib/demo-market.json'), 'utf8'))

const RPC = 'https://api.devnet.solana.com', API = 'https://txline-dev.txodds.com'
const PROGRAM = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const TXLINE = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')
const MINT = new PublicKey(cfg.mint)
const conn = new Connection(RPC, 'confirmed')
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'))))
const faucet = Keypair.fromSecretKey(Uint8Array.from(cfg.faucetSecret))
const creds = JSON.parse(fs.readFileSync(process.env.CREDS, 'utf8'))
const apiToken = typeof creds.apiToken === 'string' ? creds.apiToken : creds.apiToken.token
const EX = s => `https://explorer.solana.com/tx/${s}?cluster=devnet`

const disc = n => createHash('sha256').update(`global:${n}`).digest().subarray(0, 8)
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const i64 = n => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b }
const i32 = n => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b }
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const cat = (...a) => Buffer.concat(a.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x)))
const vec = (arr, enc) => cat(u32(arr.length), ...arr.map(enc))
const proofNode = n => cat(Buffer.from(n.hash), Buffer.from([n.isRightSibling ? 1 : 0]))
const scoreStat = s => cat(u32(s.key), i32(s.value), i32(s.period))
const statTerm = (s, r, p) => cat(scoreStat(s), Buffer.from(r), vec(p, proofNode))

let JWT = null
async function tx(path) {
  if (!JWT) JWT = (await (await fetch(`${API}/auth/guest/start`, { method: 'POST' })).json()).token
  const r = await fetch(`${API}/api${path}`, { headers: { Authorization: `Bearer ${JWT}`, 'X-Api-Token': apiToken } })
  if (!r.ok) throw new Error(`${path} -> ${r.status}`); return r.json()
}
async function finalProof(fixtureId) {
  const rows = await tx(`/scores/snapshot/${fixtureId}`)
  const seqs = [...new Set(rows.map(r => r.Seq).filter(x => x != null))].sort((a, b) => b - a)
  for (const seq of seqs.slice(0, 20)) {
    const p = await tx(`/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKeys=1,2`).catch(() => null)
    if (p && Array.isArray(p.statsToProve) && p.statsToProve.every(s => s.period === 100)) return p
  }
  throw new Error('no period-100 proof')
}
function encodeArgs(s) {
  const summary = cat(i64(s.summary.fixtureId), cat(i32(s.summary.updateStats.updateCount), i64(s.summary.updateStats.minTimestamp), i64(s.summary.updateStats.maxTimestamp)), Buffer.from(s.summary.eventStatsSubTreeRoot))
  const predicate = cat(i32(0), Buffer.from([0]))
  const statA = statTerm(s.statsToProve[0], s.eventStatRoot, s.statProofs[0])
  const statB = cat(Buffer.from([1]), statTerm(s.statsToProve[1], s.eventStatRoot, s.statProofs[1]))
  const op = cat(Buffer.from([1]), Buffer.from([1]))
  return cat(i64(s.summary.updateStats.minTimestamp), summary, vec(s.subTreeProof, proofNode), vec(s.mainTreeProof, proofNode), predicate, statA, statB, op)
}
const rootsPda = ms => { const day = Math.floor(ms / 86400000); const b = Buffer.alloc(2); b.writeUInt16LE(day & 0xffff); return PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), b], TXLINE)[0] }
const leg = (fixtureId, kind, k1, k2, threshold, predictedYes) => cat(u64(fixtureId), Buffer.from([kind]), u16(k1), u16(k2), u64(threshold), Buffer.from([predictedYes ? 1 : 0]))

const [config] = PublicKey.findProgramAddressSync([Buffer.from('parlay_config')], PROGRAM)
const [vaultAuth] = PublicKey.findProgramAddressSync([Buffer.from('parlay_vault')], PROGRAM)
const rewardVault = getAssociatedTokenAddressSync(MINT, vaultAuth, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
const userToken = getAssociatedTokenAddressSync(MINT, kp.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
const send = async (ixs, signers, label) => { const sig = await sendAndConfirmTransaction(conn, new Transaction().add(...ixs), signers, { commitment: 'confirmed' }); console.log(`  ${label}: ${EX(sig)}`); return sig }

// 1) config (idempotent)
if (!(await conn.getAccountInfo(config))) {
  await send([new TransactionInstruction({ programId: PROGRAM, data: cat(disc('init_parlay_config'), u16(19000)),
    keys: [{ pubkey: kp.publicKey, isSigner: true, isWritable: true }, { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false }, { pubkey: rewardVault, isSigner: false, isWritable: true },
      { pubkey: MINT, isSigner: false, isWritable: false }, { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }] })], [kp], 'init_parlay_config (1.9x/leg)')
} else console.log('  config exists')

// 2) fund reward vault + user (faucet is mint authority)
await send([
  createAssociatedTokenAccountIdempotentInstruction(kp.publicKey, userToken, kp.publicKey, MINT, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
  createMintToInstruction(MINT, rewardVault, faucet.publicKey, 100_000_000000, [], TOKEN_2022_PROGRAM_ID),
  createMintToInstruction(MINT, userToken, faucet.publicKey, 1_000_000000, [], TOKEN_2022_PROGRAM_ID),
], [kp, faucet], 'fund reward vault (100k) + user (1k)')

// 3) create 2-leg parlay: leg1 18179549 predict YES, leg2 18193785 predict NO
const nonce = Number(process.env.NONCE || 1)
const [parlay] = PublicKey.findProgramAddressSync([Buffer.from('parlay'), kp.publicKey.toBuffer(), u64(nonce)], PROGRAM)
const legs = [leg(18179549, 0, 1, 2, 0, true), leg(18193785, 0, 1, 2, 0, process.env.FLIP ? true : false)]
const stake = 100_000000
if (!(await conn.getAccountInfo(parlay))) {
  await send([new TransactionInstruction({ programId: PROGRAM, data: cat(disc('create_parlay'), u64(nonce), vec(legs, x => x), u64(stake)),
    keys: [{ pubkey: kp.publicKey, isSigner: true, isWritable: true }, { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: parlay, isSigner: false, isWritable: true }, { pubkey: userToken, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false }, { pubkey: rewardVault, isSigner: false, isWritable: true },
      { pubkey: MINT, isSigner: false, isWritable: false }, { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }] })], [kp], 'create_parlay (2 legs, 100 stake)')
} else console.log('  parlay exists — reusing')

// 4) prove each leg from a real proof
for (const [idx, fx] of [[0, 18179549], [1, 18193785]]) {
  const p = await finalProof(fx)
  const roots = rootsPda(p.summary.updateStats.minTimestamp)
  await send([ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }), new TransactionInstruction({ programId: PROGRAM, data: cat(disc('prove_leg'), Buffer.from([idx]), encodeArgs(p)),
    keys: [{ pubkey: parlay, isSigner: false, isWritable: true }, { pubkey: kp.publicKey, isSigner: true, isWritable: false },
      { pubkey: TXLINE, isSigner: false, isWritable: false }, { pubkey: roots, isSigner: false, isWritable: false }] })], [kp], `prove_leg ${idx} (fixture ${fx}, ${p.statsToProve[0].value}-${p.statsToProve[1].value})`)
}

// 5) read status + claim
const d = (await conn.getAccountInfo(parlay)).data
// Parlay: 8 disc +32 owner +8 nonce +8 stake +1 num_legs +4 vec_len +legs... find status: after legs vec + proven_mask(2)
const numLegs = d[56]
const legsLen = 4 + numLegs * 22
const statusOff = 8 + 32 + 8 + 8 + 1 + legsLen + 2
const status = d[statusOff]
console.log(`  parlay status = ${['Pending', 'WON', 'Lost', 'Claimed'][status]} (proven_mask=${d.readUInt16LE(8 + 32 + 8 + 8 + 1 + legsLen)})`)
if (status === 1) {
  const before = Number((await getAccount(conn, userToken, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount)
  await send([new TransactionInstruction({ programId: PROGRAM, data: disc('claim_parlay'),
    keys: [{ pubkey: parlay, isSigner: false, isWritable: true }, { pubkey: kp.publicKey, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false }, { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: rewardVault, isSigner: false, isWritable: true }, { pubkey: userToken, isSigner: false, isWritable: true },
      { pubkey: MINT, isSigner: false, isWritable: false }, { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }] })], [kp], 'claim_parlay')
  const after = Number((await getAccount(conn, userToken, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount)
  console.log(`  payout received: ${(after - before) / 1e6} USDC (stake 100 x 1.9^2 = 361 expected)`)
} else if (status === 2) console.log('  parlay LOST (a leg missed its prediction)')
