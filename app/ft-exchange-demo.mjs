// ft-exchange-demo.mjs — full P2P back/lay exchange lifecycle on devnet:
// maker BACKs "team1 wins" at 2.0x (stake 100) -> taker LAYs (liability 100) ->
// settle_offer from a REAL TxLINE proof -> winner claims the 200 pot.
// FIXTURE 18179549 (1-0) settles YES so the BACKer (maker) wins; run with
// FIXTURE=18193785 (1-4 -> NO) to see the LAYer (taker) win instead.
//   DEPLOYER_KEYPAIR=~/fulltime-keys/deployer.json CREDS=~/fulltime-keys/txline-creds.json node app/ft-exchange-demo.mjs
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
const FIXTURE = Number(process.env.FIXTURE || 18179549)
const NONCE = Number(process.env.NONCE || 1)
const conn = new Connection(RPC, 'confirmed')
const maker = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'))))
const faucetValue = process.env.FULLTIME_FAUCET_SECRET
if (!faucetValue) throw new Error('FULLTIME_FAUCET_SECRET is required for the operator demo')
const faucetBytes = faucetValue.trim().startsWith('[') ? JSON.parse(faucetValue) : Array.from(Buffer.from(faucetValue, 'base64'))
const faucet = Keypair.fromSecretKey(Uint8Array.from(faucetBytes))
const taker = Keypair.generate()
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
async function tx(p) {
  if (!JWT) JWT = (await (await fetch(`${API}/auth/guest/start`, { method: 'POST' })).json()).token
  const r = await fetch(`${API}/api${p}`, { headers: { Authorization: `Bearer ${JWT}`, 'X-Api-Token': apiToken } })
  if (!r.ok) throw new Error(`${p} -> ${r.status}`); return r.json()
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
  const statA = statTerm(s.statsToProve[0], s.eventStatRoot, s.statProofs[0])
  const statB = cat(Buffer.from([1]), statTerm(s.statsToProve[1], s.eventStatRoot, s.statProofs[1]))
  return cat(i64(s.summary.updateStats.minTimestamp), summary, vec(s.subTreeProof, proofNode), vec(s.mainTreeProof, proofNode), cat(i32(0), Buffer.from([0])), statA, statB, cat(Buffer.from([1]), Buffer.from([1])))
}
const rootsPda = ms => { const d = Math.floor(ms / 86400000); const b = Buffer.alloc(2); b.writeUInt16LE(d & 0xffff); return PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), b], TXLINE)[0] }
const ata = o => getAssociatedTokenAddressSync(MINT, o, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
const send = async (ixs, signers, label) => { const s = await sendAndConfirmTransaction(conn, new Transaction().add(...ixs), signers, { commitment: 'confirmed' }); console.log(`  ${label}: ${EX(s)}`); return s }

const [offer] = PublicKey.findProgramAddressSync([Buffer.from('offer'), maker.publicKey.toBuffer(), u64(NONCE)], PROGRAM)
const offerVault = ata(offer)
const makerToken = getAssociatedTokenAddressSync(MINT, maker.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
const takerToken = getAssociatedTokenAddressSync(MINT, taker.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
const STAKE = 100_000000, ODDS = 20000 // 2.0x

console.log(`offer ${offer.toBase58()} · maker ${maker.publicKey.toBase58().slice(0, 8)} · taker ${taker.publicKey.toBase58().slice(0, 8)}`)
// fund taker with a little SOL (fees) + both with test-USDC
await send([SystemProgram.transfer({ fromPubkey: maker.publicKey, toPubkey: taker.publicKey, lamports: 30_000_000 })], [maker], 'fund taker SOL')
await send([
  createAssociatedTokenAccountIdempotentInstruction(maker.publicKey, makerToken, maker.publicKey, MINT, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
  createAssociatedTokenAccountIdempotentInstruction(maker.publicKey, takerToken, taker.publicKey, MINT, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
  createMintToInstruction(MINT, makerToken, faucet.publicKey, 1_000_000000, [], TOKEN_2022_PROGRAM_ID),
  createMintToInstruction(MINT, takerToken, faucet.publicKey, 1_000_000000, [], TOKEN_2022_PROGRAM_ID),
], [maker, faucet], 'mint test-USDC to maker + taker')

// 1) create_offer: BACK team1-wins @ 2.0x, stake 100
await send([new TransactionInstruction({
  programId: PROGRAM, data: cat(disc('create_offer'), u64(NONCE), u64(FIXTURE), Buffer.from([0]), u16(1), u16(2), u64(0), u32(ODDS), u64(STAKE)),
  keys: [
    { pubkey: maker.publicKey, isSigner: true, isWritable: true }, { pubkey: offer, isSigner: false, isWritable: true },
    { pubkey: makerToken, isSigner: false, isWritable: true }, { pubkey: offerVault, isSigner: false, isWritable: true },
    { pubkey: MINT, isSigner: false, isWritable: false }, { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }],
})], [maker], 'create_offer (BACK team1 @ 2.0x, stake 100)')

// 2) fill_offer: taker LAYs (liability 100)
await send([new TransactionInstruction({
  programId: PROGRAM, data: disc('fill_offer'),
  keys: [
    { pubkey: offer, isSigner: false, isWritable: true }, { pubkey: taker.publicKey, isSigner: true, isWritable: true },
    { pubkey: takerToken, isSigner: false, isWritable: true }, { pubkey: offerVault, isSigner: false, isWritable: true },
    { pubkey: MINT, isSigner: false, isWritable: false }, { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }],
})], [taker], 'fill_offer (LAY, liability 100 -> pot 200)')

// 3) settle_offer from the real proof
const proof = await finalProof(FIXTURE)
console.log(`  proof: ${FIXTURE} = ${proof.statsToProve[0].value}-${proof.statsToProve[1].value} -> ${proof.statsToProve[0].value > proof.statsToProve[1].value ? 'YES (maker wins)' : 'NO (taker wins)'}`)
await send([ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }), new TransactionInstruction({
  programId: PROGRAM, data: cat(disc('settle_offer'), encodeArgs(proof)),
  keys: [
    { pubkey: offer, isSigner: false, isWritable: true }, { pubkey: maker.publicKey, isSigner: true, isWritable: false },
    { pubkey: TXLINE, isSigner: false, isWritable: false }, { pubkey: rootsPda(proof.summary.updateStats.minTimestamp), isSigner: false, isWritable: false }],
})], [maker], 'settle_offer (proof CPI)')

// 4) claim: winner takes pot
const d = (await conn.getAccountInfo(offer)).data
const outcomeYes = d[d.length - 2] === 1 // ...status, outcome_yes, bump  (outcome_yes is 2nd-from-last)
const winner = outcomeYes ? maker : taker
const winnerToken = outcomeYes ? makerToken : takerToken
const before = Number((await getAccount(conn, winnerToken, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount)
await send([new TransactionInstruction({
  programId: PROGRAM, data: disc('claim_offer'),
  keys: [
    { pubkey: offer, isSigner: false, isWritable: true }, { pubkey: winner.publicKey, isSigner: true, isWritable: true },
    { pubkey: offerVault, isSigner: false, isWritable: true }, { pubkey: winnerToken, isSigner: false, isWritable: true },
    { pubkey: MINT, isSigner: false, isWritable: false }, { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }],
})], [winner], `claim_offer (${outcomeYes ? 'maker/BACK' : 'taker/LAY'} wins)`)
const after = Number((await getAccount(conn, winnerToken, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount)
console.log(`  winner received: ${(after - before) / 1e6} USDC (pot = 200 expected)`)
