// On-chain client for the demo prediction market — read state and build the
// faucet / deposit / settle / claim transactions the betting page signs with the wallet.
import { Buffer } from 'buffer'
import {
  Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair, ComputeBudgetProgram,
} from '@solana/web3.js'
import {
  TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAccount,
} from '@solana/spl-token'
import cfg from './demo-market.json'

export const PROGRAM = new PublicKey(cfg.program)
export const TXLINE = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')
export const MARKET = new PublicKey(cfg.market)
export const MINT = new PublicKey(cfg.mint)
export const DEMO = cfg
const FAUCET = Keypair.fromSecretKey(Uint8Array.from(cfg.faucetSecret))
const API = 'https://txline-dev.txodds.com'

const DISC: Record<string, number[]> = {
  deposit_yes: [5, 45, 244, 138, 207, 34, 60, 183],
  deposit_no: [138, 190, 175, 5, 102, 204, 112, 202],
  claim_winnings: [161, 215, 24, 59, 14, 236, 242, 221],
  settle: [175, 42, 185, 87, 144, 131, 102, 212],
}
const disc = (n: string) => Buffer.from(DISC[n])
const u64 = (n: number | bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const i64 = (n: number | bigint) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b }
const i32 = (n: number) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b }
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }
const b32 = (a: number[]) => Buffer.from(a)
const cat = (...a: Buffer[]) => Buffer.concat(a)
const vecN = (arr: any[], enc: (x: any) => Buffer) => cat(u32(arr.length), ...arr.map(enc))
const proofNode = (n: any) => cat(b32(n.hash), Buffer.from([n.isRightSibling ? 1 : 0]))
const scoreStat = (s: any) => cat(u32(s.key), i32(s.value), i32(s.period))
const statTerm = (stat: any, root: number[], prf: any[]) => cat(scoreStat(stat), b32(root), vecN(prf, proofNode))

const [VAULT_AUTH] = PublicKey.findProgramAddressSync([Buffer.from('vault'), MARKET.toBuffer()], PROGRAM)
export const VAULT = getAssociatedTokenAddressSync(MINT, VAULT_AUTH, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
const depositPda = (user: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from('deposit'), MARKET.toBuffer(), user.toBuffer()], PROGRAM)[0]
export const userAta = (user: PublicKey) => getAssociatedTokenAddressSync(MINT, user, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

export type MarketState = { yes: number; no: number; settled: boolean; resolution: 'YES' | 'NO' | null }
export async function readMarket(conn: Connection): Promise<MarketState | null> {
  const info = await conn.getAccountInfo(MARKET)
  if (!info) return null
  const d = info.data as Buffer
  return {
    yes: Number(d.readBigUInt64LE(86)),
    no: Number(d.readBigUInt64LE(94)),
    settled: d[85] === 1,                                   // MarketState: 0 Open, 1 Settled
    resolution: d[102] === 1 ? (d[103] === 0 ? 'YES' : 'NO') : null,
  }
}
export async function usdcBalance(conn: Connection, user: PublicKey): Promise<number> {
  try { return Number((await getAccount(conn, userAta(user), 'confirmed', TOKEN_2022_PROGRAM_ID)).amount) } catch { return 0 }
}
export type Deposit = { amount: number; isYes: boolean; claimed: boolean }
export async function readDeposit(conn: Connection, user: PublicKey): Promise<Deposit | null> {
  const info = await conn.getAccountInfo(depositPda(user))
  if (!info) return null
  const d = info.data as Buffer                             // 8 disc +32 owner +32 market +8 amount +1 is_yes +1 claimed
  return { amount: Number(d.readBigUInt64LE(72)), isYes: d[80] === 1, claimed: d[81] === 1 }
}

// --- transactions (each returns extra signers to pass to wallet sendTransaction) ---

// Faucet is signed ENTIRELY by the devnet faucet keypair (fee payer + mint authority),
// so the user's wallet is never a signer — no Phantom "unexpected signer" warning, no
// popup, and the app controls the tx (re-broadcasts through the flaky public RPC).
export async function sendFaucet(connection: Connection, user: PublicKey): Promise<string> {
  const ata = userAta(user)
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 300_000 }),
    createAssociatedTokenAccountIdempotentInstruction(FAUCET.publicKey, ata, user, MINT, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    createMintToInstruction(MINT, ata, FAUCET.publicKey, 1_000_000000, [], TOKEN_2022_PROGRAM_ID),
  )
  const latest = await connection.getLatestBlockhash('confirmed')
  tx.feePayer = FAUCET.publicKey
  tx.recentBlockhash = latest.blockhash
  tx.sign(FAUCET)
  const raw = tx.serialize()
  const sig = await connection.sendRawTransaction(raw, { maxRetries: 3 })
  for (;;) {
    await new Promise(r => setTimeout(r, 2000))
    const st = await connection.getSignatureStatus(sig)
    if (st.value?.err) throw new Error('faucet reverted: ' + JSON.stringify(st.value.err))
    const cs = st.value?.confirmationStatus
    if (cs === 'confirmed' || cs === 'finalized') return sig
    if ((await connection.getBlockHeight('confirmed')) > latest.lastValidBlockHeight)
      throw new Error('faucet not confirmed — devnet RPC is dropping it; retry or set NEXT_PUBLIC_RPC')
    try { await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 2 }) } catch {}
  }
}

export function depositTx(user: PublicKey, side: 'YES' | 'NO', amount: number): { tx: Transaction; signers: Keypair[] } {
  const name = side === 'YES' ? 'deposit_yes' : 'deposit_no'
  const ix = new TransactionInstruction({
    programId: PROGRAM, data: cat(disc(name), u64(amount)),
    keys: [
      { pubkey: MARKET, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: depositPda(user), isSigner: false, isWritable: true },
      { pubkey: userAta(user), isSigner: false, isWritable: true },
      { pubkey: VAULT, isSigner: false, isWritable: true },
      { pubkey: VAULT_AUTH, isSigner: false, isWritable: false },
      { pubkey: MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  })
  return { tx: new Transaction().add(ix), signers: [] }
}

export function claimTx(user: PublicKey): { tx: Transaction; signers: Keypair[] } {
  const ix = new TransactionInstruction({
    programId: PROGRAM, data: cat(disc('claim_winnings'), u64(0)),   // amount is ignored on-chain
    keys: [
      { pubkey: MARKET, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: depositPda(user), isSigner: false, isWritable: true },
      { pubkey: userAta(user), isSigner: false, isWritable: true },
      { pubkey: VAULT, isSigner: false, isWritable: true },
      { pubkey: VAULT_AUTH, isSigner: false, isWritable: false },
      { pubkey: MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
  })
  return { tx: new Transaction().add(ix), signers: [] }
}

// --- permissionless settle from a real TxLINE proof ---
let JWT: string | null = null
async function txapi(path: string) {
  if (!JWT) JWT = (await (await fetch(`${API}/auth/guest/start`, { method: 'POST' })).json()).token
  const r = await fetch(`${API}/api${path}`, { headers: { Authorization: `Bearer ${JWT}`, 'X-Api-Token': cfg.txlineApiToken } })
  if (!r.ok) throw new Error(`TxLINE ${path} -> ${r.status}`)
  return r.json()
}
async function finalProof(fixtureId: number) {
  const rows = await txapi(`/scores/snapshot/${fixtureId}`)
  const seqs = [...new Set(rows.map((r: any) => r.Seq).filter((x: any) => x != null))].sort((a: any, b: any) => b - a)
  for (const seq of seqs.slice(0, 20)) {
    const p = await txapi(`/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKeys=1,2`).catch(() => null)
    if (p && Array.isArray(p.statsToProve) && p.statsToProve.every((s: any) => s.period === 100)) return p
  }
  throw new Error('no full-time (period 100) proof available')
}
function encodeArgs(p: any): Buffer {
  const summary = cat(
    i64(p.summary.fixtureId),
    cat(i32(p.summary.updateStats.updateCount), i64(p.summary.updateStats.minTimestamp), i64(p.summary.updateStats.maxTimestamp)),
    b32(p.summary.eventStatsSubTreeRoot),
  )
  const predicate = cat(i32(0), Buffer.from([0]))                       // threshold 0, GreaterThan
  const statA = statTerm(p.statsToProve[0], p.eventStatRoot, p.statProofs[0])
  const statB = cat(Buffer.from([1]), statTerm(p.statsToProve[1], p.eventStatRoot, p.statProofs[1]))  // Some
  const op = cat(Buffer.from([1]), Buffer.from([1]))                    // Some(Subtract)
  // ts MUST equal summary.min_timestamp (validate_stat rejects a mismatch)
  return cat(i64(p.summary.updateStats.minTimestamp), summary, vecN(p.subTreeProof, proofNode), vecN(p.mainTreeProof, proofNode), predicate, statA, statB, op)
}
export async function settleTx(user: PublicKey): Promise<{ tx: Transaction; signers: Keypair[] }> {
  const proof = await finalProof(cfg.fixtureId)
  const day = Math.floor(proof.summary.updateStats.minTimestamp / 86_400_000)
  const dayB = Buffer.alloc(2); dayB.writeUInt16LE(day & 0xffff)
  const roots = PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), dayB], TXLINE)[0]
  const ix = new TransactionInstruction({
    programId: PROGRAM, data: cat(disc('settle'), encodeArgs(proof)),
    keys: [
      { pubkey: MARKET, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: false },
      { pubkey: TXLINE, isSigner: false, isWritable: false },
      { pubkey: roots, isSigner: false, isWritable: false },
    ],
  })
  return { tx: new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }), ix), signers: [] }
}
