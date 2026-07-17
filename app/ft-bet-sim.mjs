// ft-bet-sim.mjs — simulate the exact browser flow (faucet -> deposit -> settle-from-proof
// -> claim) with keypairs, to verify the transactions the betting page builds are correct.
// Uses its OWN throwaway market (not the demo market) so the demo stays pristine.
//   DEPLOYER_KEYPAIR=deployer.json CREDS=txline-creds.json FIXTURE=17588302 node ft-bet-sim.mjs
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction,
  sendAndConfirmTransaction, ComputeBudgetProgram, LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {
  TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAccount,
} from '@solana/spl-token'
import { createHash } from 'crypto'
import fs from 'fs'

const RPC = 'https://api.devnet.solana.com', API = 'https://txline-dev.txodds.com'
const PROGRAM = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const TXLINE = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')
const FIXTURE = Number(process.env.FIXTURE || 17588302)
const conn = new Connection(RPC, 'confirmed')
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'))))
const creds = JSON.parse(fs.readFileSync(process.env.CREDS, 'utf8'))
const apiToken = typeof creds.apiToken === 'string' ? creds.apiToken : creds.apiToken.token

const disc = n => createHash('sha256').update(`global:${n}`).digest().subarray(0, 8)
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const i64 = n => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b }
const i32 = n => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b }
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const b32 = a => Buffer.from(a)
const cat = (...a) => Buffer.concat(a.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x)))
const vecN = (arr, enc) => cat(u32(arr.length), ...arr.map(enc))
const pn = n => cat(b32(n.hash), Buffer.from([n.isRightSibling ? 1 : 0]))
const ss = s => cat(u32(s.key), i32(s.value), i32(s.period))
const st = (stat, root, prf) => cat(ss(stat), b32(root), vecN(prf, pn))

let JWT = null
async function tx(p) { if (!JWT) JWT = (await (await fetch(`${API}/auth/guest/start`, { method: 'POST' })).json()).token; const r = await fetch(`${API}/api${p}`, { headers: { Authorization: `Bearer ${JWT}`, 'X-Api-Token': apiToken } }); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json() }
async function finalProof(fid) { const rows = await tx(`/scores/snapshot/${fid}`); const seqs = [...new Set(rows.map(r => r.Seq).filter(x => x != null))].sort((a, b) => b - a); for (const s of seqs.slice(0, 20)) { const p = await tx(`/scores/stat-validation?fixtureId=${fid}&seq=${s}&statKeys=1,2`).catch(() => null); if (p && p.statsToProve?.every(x => x.period === 100)) return p } throw new Error('no proof') }
function encodeArgs(p) {
  const summary = cat(i64(p.summary.fixtureId), cat(i32(p.summary.updateStats.updateCount), i64(p.summary.updateStats.minTimestamp), i64(p.summary.updateStats.maxTimestamp)), b32(p.summary.eventStatsSubTreeRoot))
  return cat(i64(p.summary.updateStats.minTimestamp), summary, vecN(p.subTreeProof, pn), vecN(p.mainTreeProof, pn), cat(i32(0), Buffer.from([0])), st(p.statsToProve[0], p.eventStatRoot, p.statProofs[0]), cat(Buffer.from([1]), st(p.statsToProve[1], p.eventStatRoot, p.statProofs[1])), cat(Buffer.from([1]), Buffer.from([1])))
}

const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), u64(FIXTURE)], PROGRAM)
const [vaultAuth] = PublicKey.findProgramAddressSync([Buffer.from('vault'), marketPda.toBuffer()], PROGRAM)
const depositPda = u => PublicKey.findProgramAddressSync([Buffer.from('deposit'), marketPda.toBuffer(), u.toBuffer()], PROGRAM)[0]
const send = (ixs, signers) => sendAndConfirmTransaction(conn, new Transaction().add(...ixs), signers, { commitment: 'confirmed' })

if (await conn.getAccountInfo(marketPda)) throw new Error(`market ${FIXTURE} exists; pick a fresh FIXTURE`)
const proof = await finalProof(FIXTURE)
const yesWon = proof.statsToProve[0].value > proof.statsToProve[1].value
console.log(`fixture ${FIXTURE}: ${proof.statsToProve[0].value}-${proof.statsToProve[1].value} -> ${yesWon ? 'YES' : 'NO'} wins`)

// faucet mint (authority = faucet keypair, like the demo market)
const faucet = Keypair.generate()
const mint = await createMint(conn, payer, faucet.publicKey, null, 6, Keypair.generate(), { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID)
const vault = getAssociatedTokenAddressSync(mint, vaultAuth, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
const ata = u => getAssociatedTokenAddressSync(mint, u, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
await send([new TransactionInstruction({ programId: PROGRAM, data: cat(disc('create_market'), u64(FIXTURE), cat(Buffer.from([0]), u16(1), u16(2)), payer.publicKey.toBuffer()), keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }, { pubkey: marketPda, isSigner: false, isWritable: true }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }] })], [payer])
console.log('market created')

const depIx = (name, user, amount) => new TransactionInstruction({ programId: PROGRAM, data: cat(disc(name), u64(amount)), keys: [
  { pubkey: marketPda, isSigner: false, isWritable: true }, { pubkey: user.publicKey, isSigner: true, isWritable: true }, { pubkey: depositPda(user.publicKey), isSigner: false, isWritable: true },
  { pubkey: ata(user.publicKey), isSigner: false, isWritable: true }, { pubkey: vault, isSigner: false, isWritable: true }, { pubkey: vaultAuth, isSigner: false, isWritable: false },
  { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }] })

// two judges: A backs the winning side, B backs the loser
const A = Keypair.generate(), B = Keypair.generate()
for (const k of [A, B]) await send([SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: k.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })], [payer])
// FAUCET flow (exactly like the page: create ATA + mintTo, faucet co-signs, user pays)
for (const k of [A, B]) await send([createAssociatedTokenAccountIdempotentInstruction(k.publicKey, ata(k.publicKey), k.publicKey, mint, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID), createMintToInstruction(mint, ata(k.publicKey), faucet.publicKey, 1000_000000, [], TOKEN_2022_PROGRAM_ID)], [k, faucet])
console.log('faucet: A & B each got 1000 test-USDC')
const winSide = yesWon ? 'deposit_yes' : 'deposit_no', loseSide = yesWon ? 'deposit_no' : 'deposit_yes'
await send([depIx(winSide, A, 100_000000)], [A]); console.log('A bet 100 on the winner')
await send([depIx(loseSide, B, 50_000000)], [B]); console.log('B bet 50 on the loser')

// SETTLE from proof (permissionless — A submits)
const day = Math.floor(proof.summary.updateStats.minTimestamp / 86_400_000); const dayB = Buffer.alloc(2); dayB.writeUInt16LE(day & 0xffff)
const roots = PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), dayB], TXLINE)[0]
await send([ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }), new TransactionInstruction({ programId: PROGRAM, data: cat(disc('settle'), encodeArgs(proof)), keys: [{ pubkey: marketPda, isSigner: false, isWritable: true }, { pubkey: A.publicKey, isSigner: true, isWritable: false }, { pubkey: TXLINE, isSigner: false, isWritable: false }, { pubkey: roots, isSigner: false, isWritable: false }] })], [A])
const md = (await conn.getAccountInfo(marketPda)).data; console.log(`settled from proof -> resolution ${md[102] === 1 ? (md[103] === 0 ? 'YES' : 'NO') : '?'}`)

// CLAIM (A, the winner)
const before = Number((await getAccount(conn, ata(A.publicKey), 'confirmed', TOKEN_2022_PROGRAM_ID)).amount)
await send([new TransactionInstruction({ programId: PROGRAM, data: cat(disc('claim_winnings'), u64(0)), keys: [{ pubkey: marketPda, isSigner: false, isWritable: true }, { pubkey: A.publicKey, isSigner: true, isWritable: true }, { pubkey: depositPda(A.publicKey), isSigner: false, isWritable: true }, { pubkey: ata(A.publicKey), isSigner: false, isWritable: true }, { pubkey: vault, isSigner: false, isWritable: true }, { pubkey: vaultAuth, isSigner: false, isWritable: false }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }] })], [A])
const after = Number((await getAccount(conn, ata(A.publicKey), 'confirmed', TOKEN_2022_PROGRAM_ID)).amount)
const payout = (after - before) / 1e6
console.log(`A claimed: +${payout} USDC (staked 100, pool 150 -> fair 150)`)
console.log(payout === 150 ? '\n✅ PASS — faucet + deposit + proof-settle + claim all work (page txs are correct)' : `\n⚠️ payout ${payout} (expected 150)`)
