// @fulltime/sdk — instruction builders + a trustless settlement verifier for the
// Fulltime prediction market (TxLINE-oracle settled, trustless-only: no admin path).
import { createHash } from 'crypto'
import {
  Connection, PublicKey, TransactionInstruction, SystemProgram,
} from '@solana/web3.js'

export const FULLTIME = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
export const TXLINE = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest()
const disc = (n: string) => sha256(Buffer.from(`global:${n}`)).subarray(0, 8)
const u64 = (n: number | bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const i64 = (n: number | bigint) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b }
const i32 = (n: number) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b }
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b }
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const b32 = (a: number[] | Buffer) => Buffer.from(a as any)
const cat = (...a: Buffer[]) => Buffer.concat(a)
const vec = (arr: any[], enc: (x: any) => Buffer) => cat(u32(arr.length), ...arr.map(enc))
const proofNode = (n: any) => cat(b32(n.hash), Buffer.from([n.isRightSibling ? 1 : 0]))
const scoreStat = (s: any) => cat(u32(s.key), i32(s.value), i32(s.period))
const statTerm = (stat: any, root: number[], prf: any[]) => cat(scoreStat(stat), b32(root), vec(prf, proofNode))

// ---------- PDAs ----------
export const deriveMarketPda = (fixtureId: number | bigint) =>
  PublicKey.findProgramAddressSync([Buffer.from('market'), u64(fixtureId)], FULLTIME)[0]
export const deriveVaultAuthority = (market: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from('vault'), market.toBuffer()], FULLTIME)[0]
export const deriveDepositPda = (market: PublicKey, user: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from('deposit'), market.toBuffer(), user.toBuffer()], FULLTIME)[0]
export const deriveRootsPda = (minTimestampMs: number) => {
  const day = Math.floor(minTimestampMs / 86_400_000)
  return PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), u16(day & 0xffff)], TXLINE)[0]
}

// ---------- instruction builders ----------
export type MatchWinner = { kind: 'MatchWinner'; team1Key: number; team2Key: number }
export type OverUnder = { kind: 'OverUnder'; statKey: number; threshold: number }
export type ExactScore = { kind: 'ExactScore'; statKey: number; target: number }
export type MarketType = MatchWinner | OverUnder | ExactScore

function encodeMarketType(m: MarketType): Buffer {
  if (m.kind === 'MatchWinner') return cat(Buffer.from([0]), u16(m.team1Key), u16(m.team2Key))
  if (m.kind === 'OverUnder') return cat(Buffer.from([1]), u16(m.statKey), u64(m.threshold))
  return cat(Buffer.from([2]), u16(m.statKey), u64(m.target))
}

export function buildCreateMarketIx(authority: PublicKey, fixtureId: number | bigint, market: MarketType, settleAuthority = authority): TransactionInstruction {
  return new TransactionInstruction({
    programId: FULLTIME,
    data: cat(disc('create_market'), u64(fixtureId), encodeMarketType(market), settleAuthority.toBuffer()),
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveMarketPda(fixtureId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  })
}

// Encode ValidateStatArgs for a MatchWinner proof (team1 - team2 > 0) from a raw
// TxLINE stat-validation payload (same shape as /api/scores/stat-validation).
export function encodeMatchWinnerProof(raw: any): Buffer {
  const summary = cat(
    i64(raw.summary.fixtureId),
    cat(i32(raw.summary.updateStats.updateCount), i64(raw.summary.updateStats.minTimestamp), i64(raw.summary.updateStats.maxTimestamp)),
    b32(raw.summary.eventStatsSubTreeRoot),
  )
  const predicate = cat(i32(0), Buffer.from([0]))
  const statA = statTerm(raw.statsToProve[0], raw.eventStatRoot, raw.statProofs[0])
  const statB = cat(Buffer.from([1]), statTerm(raw.statsToProve[1], raw.eventStatRoot, raw.statProofs[1]))
  const op = cat(Buffer.from([1]), Buffer.from([1]))
  return cat(i64(raw.summary.updateStats.minTimestamp), summary, vec(raw.subTreeProof, proofNode), vec(raw.mainTreeProof, proofNode), predicate, statA, statB, op)
}

export function buildSettleIx(fixtureId: number | bigint, settler: PublicKey, rawProof: any): TransactionInstruction {
  return new TransactionInstruction({
    programId: FULLTIME,
    data: cat(disc('settle'), encodeMatchWinnerProof(rawProof)),
    keys: [
      { pubkey: deriveMarketPda(fixtureId), isSigner: false, isWritable: true },
      { pubkey: settler, isSigner: true, isWritable: false },
      { pubkey: TXLINE, isSigner: false, isWritable: false },
      { pubkey: deriveRootsPda(rawProof.summary.updateStats.minTimestamp), isSigner: false, isWritable: false },
    ],
  })
}

// ---------- account decoder ----------
export type Market = { fixtureId: number; state: 'Open' | 'Settled'; yesPool: number; noPool: number; resolution: 'YES' | 'NO' | null }
export function decodeMarket(data: Buffer): Market {
  return {
    fixtureId: Number(data.readBigUInt64LE(40)),
    state: data[85] === 1 ? 'Settled' : 'Open',
    yesPool: Number(data.readBigUInt64LE(86)),
    noPool: Number(data.readBigUInt64LE(94)),
    resolution: data[102] === 1 ? (data[103] === 0 ? 'YES' : 'NO') : null,
  }
}
export async function fetchMarket(conn: Connection, fixtureId: number | bigint): Promise<Market | null> {
  const info = await conn.getAccountInfo(deriveMarketPda(fixtureId))
  return info ? decodeMarket(info.data as Buffer) : null
}

// ---------- off-chain Merkle re-verification ----------
const foldPath = (start: Buffer, path: any[]) => path.reduce((cur, node) => {
  const sib = b32(node.hash)
  return sha256(node.isRightSibling ? cat(cur, sib) : cat(sib, cur))
}, start)
const leafHash = (stat: any) => sha256(cat(u32(stat.key), i32(stat.value), i32(stat.period)))

// Re-fold each proven stat's Merkle path off-chain and confirm it reaches the
// proof's event stat root — the off-chain half of what validate_stat enforces on
// chain. NOTE: TxLINE encodes zero-value stats (e.g. "0 goals") with a sentinel
// leaf rather than a scoring leaf; those are validated on-chain but don't re-fold
// with the scoring-leaf hash here. `ok` reflects the scoring stats' inclusion.
export function verifyProofMerkle(raw: any): { ok: boolean; stats: { key: number; value: number; foldsToEventRoot: boolean; sentinel: boolean }[] } {
  const eventRoot = b32(raw.eventStatRoot)
  const stats = raw.statsToProve.map((s: any, i: number) => {
    const first = raw.statProofs[i]?.[0]?.hash
    const sentinel = Array.isArray(first) && first[0] === 1 && first[1] === 255 // TxLINE zero/absence marker
    return {
      key: s.key, value: s.value, sentinel,
      foldsToEventRoot: Buffer.compare(foldPath(leafHash(s), raw.statProofs[i]), eventRoot) === 0,
    }
  })
  return { ok: stats.filter((s: any) => !s.sentinel).every((s: any) => s.foldsToEventRoot), stats }
}

// ---------- settlement verifier ----------
export type VerifyResult = {
  verified: boolean
  cpiIntoTxline: boolean
  ranValidateStat: boolean
  verdict: 0 | 1 | null
  resolution: 'YES' | 'NO' | null
  fixtureId: number | null
  reasons: string[]
}

// Fetch a settle tx and confirm it CPI'd the real TxLINE program, that validate_stat
// ran and returned a verdict, and that the market resolved consistently.
export async function verifySettlement(conn: Connection, settleTxSig: string): Promise<VerifyResult> {
  const reasons: string[] = []
  const tx = await conn.getTransaction(settleTxSig, { maxSupportedTransactionVersion: 0 })
  if (!tx) return { verified: false, cpiIntoTxline: false, ranValidateStat: false, verdict: null, resolution: null, fixtureId: null, reasons: ['transaction not found'] }
  const logs = tx.meta?.logMessages || []
  const txlineStr = TXLINE.toBase58()
  const cpiIntoTxline = logs.some(l => l.includes(txlineStr) && l.includes('invoke'))
  const ranValidateStat = logs.some(l => /Instruction: ValidateStat/i.test(l))
  const retLine = logs.find(l => l.startsWith(`Program return: ${txlineStr}`))
  let verdict: 0 | 1 | null = null
  if (retLine) { const byte = Buffer.from(retLine.split(' ').pop()!, 'base64')[0]; verdict = byte === 1 ? 1 : 0 }

  const msg: any = tx.transaction.message
  const keys: PublicKey[] = msg.staticAccountKeys || msg.accountKeys || []
  const ixs: any[] = msg.compiledInstructions || msg.instructions || []
  let marketPk: PublicKey | null = null
  for (const ix of ixs) {
    if (keys[ix.programIdIndex]?.equals(FULLTIME)) {
      const a = ix.accountKeyIndexes || ix.accounts || []
      if (a[0] != null) marketPk = keys[a[0]] || null
    }
  }
  let market: Market | null = null
  if (marketPk) { const info = await conn.getAccountInfo(marketPk); if (info) market = decodeMarket(info.data as Buffer) }

  if (tx.meta?.err) reasons.push('transaction reverted')
  if (!cpiIntoTxline) reasons.push('no CPI into the TxLINE program')
  if (!ranValidateStat) reasons.push('validate_stat did not run')
  if (verdict == null) reasons.push('no verdict returned by TxLINE')
  if (!market?.resolution) reasons.push('market did not resolve')
  if (verdict != null && market?.resolution && ((verdict === 1) !== (market.resolution === 'YES')))
    reasons.push('resolution inconsistent with verdict')

  return {
    verified: reasons.length === 0,
    cpiIntoTxline, ranValidateStat, verdict,
    resolution: market?.resolution ?? null,
    fixtureId: market?.fixtureId ?? null,
    reasons,
  }
}

// ---------- high-level client ----------
export class FulltimeClient {
  constructor(public conn: Connection) {}
  market(fixtureId: number | bigint) { return fetchMarket(this.conn, fixtureId) }
  verify(sig: string) { return verifySettlement(this.conn, sig) }
  createMarketIx = buildCreateMarketIx
  settleIx = buildSettleIx
}

export const GENUINE_SETTLEMENTS = [
  { sig: '5QZzypbShX2VJzQuCpRJfUDb5F4oTx7H8v2RxrAh4NJybPnmMkG6PwVk25avgUFbZhneBxfNfE9hdYXmUEZ3Nexy', fixture: 18179549, score: '1-0', outcome: 'YES' },
  { sig: '4TG9BU5XCi3hRAPq7wLKJtydFvN7XhCSo86Lp3SGbku4BqUneKBPWmnz1ZVkgY8u4dzc2jys11asrmaWRJRn3LJZ', fixture: 18193785, score: '1-4', outcome: 'NO' },
]
