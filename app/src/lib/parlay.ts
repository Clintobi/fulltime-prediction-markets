// Parlay client: list on-chain tickets, read config, and build create_parlay txs.
import { Buffer } from 'buffer'
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getAccount } from '@solana/spl-token'
import cfg from './demo-market.json'

export const PROGRAM = new PublicKey(cfg.program)
export const MINT = new PublicKey(cfg.mint)

const CREATE_PARLAY_DISC = Buffer.from([127, 36, 125, 173, 162, 128, 246, 207]) // sha256("global:create_parlay")[..8]
const u64 = (n: number | bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }
const cat = (...a: Buffer[]) => Buffer.concat(a)

export const CONFIG_PDA = PublicKey.findProgramAddressSync([Buffer.from('parlay_config')], PROGRAM)[0]
export const VAULT_AUTH = PublicKey.findProgramAddressSync([Buffer.from('parlay_vault')], PROGRAM)[0]
export const REWARD_VAULT = getAssociatedTokenAddressSync(MINT, VAULT_AUTH, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
const parlayPda = (owner: PublicKey, nonce: number) => PublicKey.findProgramAddressSync([Buffer.from('parlay'), owner.toBuffer(), u64(nonce)], PROGRAM)[0]
const userAta = (u: PublicKey) => getAssociatedTokenAddressSync(MINT, u, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

export type LegKind = 'MatchWinner' | 'OverUnder' | 'ExactScore'
export type Leg = { fixtureId: number; kind: LegKind; k1: number; k2: number; threshold: number; predictedYes: boolean }
export type ParlayRow = {
  pubkey: string; owner: string; nonce: number; stake: number; numLegs: number
  legs: Leg[]; provenMask: number; status: 'Pending' | 'Won' | 'Lost' | 'Claimed'
}

const KIND_N: Record<number, LegKind> = { 0: 'MatchWinner', 1: 'OverUnder', 2: 'ExactScore' }
const STATUS: ParlayRow['status'][] = ['Pending', 'Won', 'Lost', 'Claimed']

export function decodeParlay(pk: PublicKey, d: Buffer): ParlayRow | null {
  if (d.length < 63) return null
  const owner = new PublicKey(d.subarray(8, 40)).toBase58()
  const nonce = Number(d.readBigUInt64LE(40))
  const stake = Number(d.readBigUInt64LE(48))
  const numLegs = d[56]
  const legs: Leg[] = []
  let o = 61 // 57 (after num_legs) + 4 (vec len)
  for (let i = 0; i < numLegs; i++) {
    legs.push({
      fixtureId: Number(d.readBigUInt64LE(o)), kind: KIND_N[d[o + 8]], k1: d.readUInt16LE(o + 9), k2: d.readUInt16LE(o + 11),
      threshold: Number(d.readBigUInt64LE(o + 13)), predictedYes: d[o + 21] === 1,
    })
    o += 22
  }
  const provenMask = d.readUInt16LE(o)
  const status = STATUS[d[o + 2]] || 'Pending'
  return { pubkey: pk.toBase58(), owner, nonce, stake, numLegs, legs, provenMask, status }
}

export async function listParlays(conn: Connection): Promise<ParlayRow[]> {
  const accts = await conn.getProgramAccounts(PROGRAM, { filters: [{ dataSize: 8 + 32 + 8 + 8 + 1 + 4 + 5 * 22 + 2 + 1 + 1 }] })
  return accts.map(a => decodeParlay(a.pubkey, a.account.data as Buffer)).filter((r): r is ParlayRow => !!r)
    .sort((x, y) => (x.status === 'Pending' ? -1 : 1) - (y.status === 'Pending' ? -1 : 1))
}

export async function readConfig(conn: Connection): Promise<{ oddsBps: number; vault: number } | null> {
  const info = await conn.getAccountInfo(CONFIG_PDA)
  if (!info) return null
  const oddsBps = (info.data as Buffer).readUInt16LE(8 + 32 + 32)
  let vault = 0
  try { vault = Number((await getAccount(conn, REWARD_VAULT, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount) } catch {}
  return { oddsBps, vault }
}

function encodeLeg(l: Leg): Buffer {
  const kind = l.kind === 'MatchWinner' ? 0 : l.kind === 'OverUnder' ? 1 : 2
  return cat(u64(l.fixtureId), Buffer.from([kind]), u16(l.k1), u16(l.k2), u64(l.threshold), Buffer.from([l.predictedYes ? 1 : 0]))
}

export function createParlayTx(owner: PublicKey, nonce: number, legs: Leg[], stake: number): Transaction {
  const data = cat(CREATE_PARLAY_DISC, u64(nonce), u32(legs.length), ...legs.map(encodeLeg), u64(stake))
  const ix = new TransactionInstruction({
    programId: PROGRAM, data,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: CONFIG_PDA, isSigner: false, isWritable: false },
      { pubkey: parlayPda(owner, nonce), isSigner: false, isWritable: true },
      { pubkey: userAta(owner), isSigner: false, isWritable: true },
      { pubkey: VAULT_AUTH, isSigner: false, isWritable: false },
      { pubkey: REWARD_VAULT, isSigner: false, isWritable: true },
      { pubkey: MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  })
  return new Transaction().add(ix)
}

export function payoutIfWon(stake: number, numLegs: number, oddsBps: number): number {
  let p = stake
  for (let i = 0; i < numLegs; i++) p = Math.floor((p * oddsBps) / 10000)
  return p
}
