// P2P exchange client: list open back/lay offers, create an offer (BACK), fill one (LAY).
import { Buffer } from 'buffer'
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token'
import cfg from './demo-market.json'

export const PROGRAM = new PublicKey(cfg.program)
export const MINT = new PublicKey(cfg.mint)
const CREATE_OFFER = Buffer.from([237, 233, 192, 168, 248, 7, 249, 241])
const FILL_OFFER = Buffer.from([83, 15, 200, 85, 160, 80, 164, 61])
const u64 = (n: number | bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b }
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const cat = (...a: Buffer[]) => Buffer.concat(a)

const STAT: Record<number, string> = { 1: 'home goals', 2: 'away goals', 3: 'total goals', 4: 'corners' }

export type OfferKind = 'MatchWinner' | 'OverUnder' | 'ExactScore'
export type OfferRow = {
  pubkey: string; maker: string; fixtureId: number; kind: OfferKind
  k1: number; k2: number; threshold: number; oddsBps: number
  makerStake: number; taker: string | null; takerLiability: number
  status: 'Open' | 'Filled' | 'Settled' | 'Claimed'; outcomeYes: boolean; question: string
}
const KIND: Record<number, OfferKind> = { 0: 'MatchWinner', 1: 'OverUnder', 2: 'ExactScore' }
const STATUS: OfferRow['status'][] = ['Open', 'Filled', 'Settled', 'Claimed']
const DEFAULT_PK = '11111111111111111111111111111111'

// Offer: 8 disc | 32 maker | 8 nonce | 8 fixture | 1 kind | 2 k1 | 2 k2 | 8 thr | 4 odds | 8 stake | 32 taker | 8 liab | 1 status | 1 outcome | 1 bump
export function decodeOffer(pk: PublicKey, d: Buffer): OfferRow | null {
  if (d.length < 124) return null
  const maker = new PublicKey(d.subarray(8, 40)).toBase58()
  const fixtureId = Number(d.readBigUInt64LE(48))
  const kind = KIND[d[56]]
  const k1 = d.readUInt16LE(57), k2 = d.readUInt16LE(59)
  const threshold = Number(d.readBigUInt64LE(61))
  const oddsBps = d.readUInt32LE(69)
  const makerStake = Number(d.readBigUInt64LE(73))
  const takerPk = new PublicKey(d.subarray(81, 113)).toBase58()
  const takerLiability = Number(d.readBigUInt64LE(113))
  const status = STATUS[d[121]] || 'Open'
  const outcomeYes = d[122] === 1
  const q = kind === 'MatchWinner' ? `${STAT[k1] || 'home'} beats ${STAT[k2] || 'away'}`
    : kind === 'OverUnder' ? `${STAT[k1] || `stat ${k1}`} over ${threshold}`
    : `${STAT[k1] || `stat ${k1}`} exactly ${threshold}`
  return { pubkey: pk.toBase58(), maker, fixtureId, kind, k1, k2, threshold, oddsBps, makerStake, taker: takerPk === DEFAULT_PK ? null : takerPk, takerLiability, status, outcomeYes, question: q }
}

export async function listOffers(conn: Connection): Promise<OfferRow[]> {
  const accts = await conn.getProgramAccounts(PROGRAM, { filters: [{ dataSize: 124 }] })
  return accts.map(a => decodeOffer(a.pubkey, a.account.data as Buffer)).filter((r): r is OfferRow => !!r && r.fixtureId < 1_000_000_000)
    .sort((a, b) => (a.status === 'Open' ? -1 : 1) - (b.status === 'Open' ? -1 : 1))
}

const offerPda = (maker: PublicKey, nonce: number) => PublicKey.findProgramAddressSync([Buffer.from('offer'), maker.toBuffer(), u64(nonce)], PROGRAM)[0]
const vaultOf = (offer: PublicKey) => getAssociatedTokenAddressSync(MINT, offer, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
const ataOf = (u: PublicKey) => getAssociatedTokenAddressSync(MINT, u, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

export type NewOffer = { fixtureId: number; kind: OfferKind; k1: number; k2: number; threshold: number; oddsBps: number; stake: number }

export function createOfferTx(maker: PublicKey, nonce: number, o: NewOffer): Transaction {
  const kind = o.kind === 'MatchWinner' ? 0 : o.kind === 'OverUnder' ? 1 : 2
  const offer = offerPda(maker, nonce)
  const data = cat(CREATE_OFFER, u64(nonce), u64(o.fixtureId), Buffer.from([kind]), u16(o.k1), u16(o.k2), u64(o.threshold), u32(o.oddsBps), u64(o.stake))
  const ix = new TransactionInstruction({
    programId: PROGRAM, data,
    keys: [
      { pubkey: maker, isSigner: true, isWritable: true },
      { pubkey: offer, isSigner: false, isWritable: true },
      { pubkey: ataOf(maker), isSigner: false, isWritable: true },
      { pubkey: vaultOf(offer), isSigner: false, isWritable: true },
      { pubkey: MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  })
  return new Transaction().add(ix)
}

export function fillOfferTx(offerPubkey: PublicKey, taker: PublicKey): Transaction {
  const ix = new TransactionInstruction({
    programId: PROGRAM, data: FILL_OFFER,
    keys: [
      { pubkey: offerPubkey, isSigner: false, isWritable: true },
      { pubkey: taker, isSigner: true, isWritable: true },
      { pubkey: ataOf(taker), isSigner: false, isWritable: true },
      { pubkey: vaultOf(offerPubkey), isSigner: false, isWritable: true },
      { pubkey: MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
  })
  return new Transaction().add(ix)
}

export const layLiability = (stake: number, oddsBps: number) => Math.floor((stake * (oddsBps - 10000)) / 10000)
