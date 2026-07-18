// Multi-market client: list, create, and bet across ALL market types the program
// supports (MatchWinner, OverUnder, ExactScore) — not just the single demo market.
// The deployed program already supports these; this exposes them.
import { Buffer } from 'buffer'
import {
  Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram,
} from '@solana/web3.js'
import {
  TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import cfg from './demo-market.json'

export const PROGRAM = new PublicKey(cfg.program)
export const MINT = new PublicKey(cfg.mint) // shared test-USDC across markets

const DISC: Record<string, number[]> = {
  create_market: [103, 226, 97, 235, 200, 188, 251, 254],
  deposit_yes: [5, 45, 244, 138, 207, 34, 60, 183],
  deposit_no: [138, 190, 175, 5, 102, 204, 112, 202],
}
const disc = (n: string) => Buffer.from(DISC[n])
const u64 = (n: number | bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const cat = (...a: Buffer[]) => Buffer.concat(a)

export type MarketKind = 'MatchWinner' | 'OverUnder' | 'ExactScore'
export type MarketRow = {
  pubkey: string
  fixtureId: number
  kind: MarketKind
  // human question params
  team1Key?: number; team2Key?: number
  statKey?: number; threshold?: number; target?: number
  state: 'Open' | 'Settled'
  yes: number; no: number
  resolution: 'YES' | 'NO' | null
  question: string
}

const STAT_LABEL: Record<number, string> = { 1: 'home goals', 2: 'away goals', 3: 'total goals', 4: 'corners', 5: 'shots on target' }

// Variant-aware decode: market_type is variable-length, so field offsets after it
// depend on the variant.  layout: 8 disc | 32 authority | 8 fixture | TYPE | 32 settle_auth | 1 state | 8 yes | 8 no | 2 res | 1 bump
export function decodeMarket(pubkey: PublicKey, data: Buffer): MarketRow | null {
  if (data.length < 90) return null
  const fixtureId = Number(data.readBigUInt64LE(40))
  const tag = data[48]
  let typeLen: number, row: Partial<MarketRow> = {}
  if (tag === 0) { typeLen = 5; row = { kind: 'MatchWinner', team1Key: data.readUInt16LE(49), team2Key: data.readUInt16LE(51) } }
  else if (tag === 1) { typeLen = 11; row = { kind: 'OverUnder', statKey: data.readUInt16LE(49), threshold: Number(data.readBigUInt64LE(51)) } }
  else if (tag === 2) { typeLen = 11; row = { kind: 'ExactScore', statKey: data.readUInt16LE(49), target: Number(data.readBigUInt64LE(51)) } }
  else return null
  const base = 48 + typeLen
  const state = data[base + 32] === 1 ? 'Settled' : 'Open'
  const yes = Number(data.readBigUInt64LE(base + 33))
  const no = Number(data.readBigUInt64LE(base + 41))
  const resTag = data[base + 49]
  const resolution = resTag === 1 ? (data[base + 50] === 0 ? 'YES' : 'NO') : null
  const q =
    row.kind === 'MatchWinner' ? `Does ${STAT_LABEL[row.team1Key!] || 'team 1'} beat ${STAT_LABEL[row.team2Key!] || 'team 2'}?` :
    row.kind === 'OverUnder' ? `Is ${STAT_LABEL[row.statKey!] || `stat ${row.statKey}`} over ${row.threshold}?` :
    `Is ${STAT_LABEL[row.statKey!] || `stat ${row.statKey}`} exactly ${row.target}?`
  return { pubkey: pubkey.toBase58(), fixtureId, state, yes, no, resolution, question: q, ...(row as any) }
}

export async function listMarkets(conn: Connection): Promise<MarketRow[]> {
  const accts = await conn.getProgramAccounts(PROGRAM, { filters: [{ dataSize: 8 + 32 + 8 + 11 + 32 + 1 + 8 + 8 + 2 + 1 }] })
  // dataSize filter uses the max (InitSpace) size; decode tolerates all variants.
  const rows: MarketRow[] = []
  for (const a of accts) {
    const r = decodeMarket(a.pubkey, a.account.data as Buffer)
    // real World Cup fixture ids are ~8 digits; drop nonce-id scratch markets from old test scripts
    if (r && r.fixtureId < 1_000_000_000) rows.push(r)
  }
  // newest-ish first: Settled last, higher pools first
  return rows.sort((x, y) => (x.state === y.state ? (y.yes + y.no) - (x.yes + x.no) : x.state === 'Open' ? -1 : 1))
}

const marketPda = (fixtureId: number) => PublicKey.findProgramAddressSync([Buffer.from('market'), u64(fixtureId)], PROGRAM)[0]
const vaultAuth = (market: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from('vault'), market.toBuffer()], PROGRAM)[0]
const vaultAta = (market: PublicKey) => getAssociatedTokenAddressSync(MINT, vaultAuth(market), true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
const depositPda = (market: PublicKey, user: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from('deposit'), market.toBuffer(), user.toBuffer()], PROGRAM)[0]
export const userAta = (user: PublicKey) => getAssociatedTokenAddressSync(MINT, user, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

export type NewMarket =
  | { kind: 'MatchWinner'; team1Key: number; team2Key: number }
  | { kind: 'OverUnder'; statKey: number; threshold: number }
  | { kind: 'ExactScore'; statKey: number; target: number }

function encodeType(m: NewMarket): Buffer {
  if (m.kind === 'MatchWinner') return cat(Buffer.from([0]), u16(m.team1Key), u16(m.team2Key))
  if (m.kind === 'OverUnder') return cat(Buffer.from([1]), u16(m.statKey), u64(m.threshold))
  return cat(Buffer.from([2]), u16(m.statKey), u64(m.target))
}

export function createMarketTx(authority: PublicKey, fixtureId: number, m: NewMarket): Transaction {
  const ix = new TransactionInstruction({
    programId: PROGRAM,
    data: cat(disc('create_market'), u64(fixtureId), encodeType(m), authority.toBuffer()),
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: marketPda(fixtureId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  })
  return new Transaction().add(ix)
}

export function betTx(market: PublicKey, user: PublicKey, side: 'YES' | 'NO', amount: number): Transaction {
  const ix = new TransactionInstruction({
    programId: PROGRAM,
    data: cat(disc(side === 'YES' ? 'deposit_yes' : 'deposit_no'), u64(amount)),
    keys: [
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: depositPda(market, user), isSigner: false, isWritable: true },
      { pubkey: userAta(user), isSigner: false, isWritable: true },
      { pubkey: vaultAta(market), isSigner: false, isWritable: true },
      { pubkey: vaultAuth(market), isSigner: false, isWritable: false },
      { pubkey: MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  })
  return new Transaction().add(ix)
}

export { marketPda }
