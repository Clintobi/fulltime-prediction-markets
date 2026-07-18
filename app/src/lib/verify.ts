// Client-side settlement verifier — the engine behind /verify.
// Given a settle tx signature, it reconstructs the trust chain from public on-chain
// data: did Fulltime.settle CPI into the REAL TxLINE program, did TxLINE run
// validate_stat, what verdict did it return, and did the market resolve to match?
import { Connection, PublicKey } from '@solana/web3.js'

export const FULLTIME = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
export const TXLINE = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')

export type VerifyStep = { label: string; ok: boolean; detail: string }
export type VerifyResult = {
  sig: string
  found: boolean
  error?: string
  cpiIntoTxline: boolean
  ranValidateStat: boolean
  verdictByte: number | null // 1 = predicate true (YES), 0 = false (NO)
  returnDataB64: string | null
  market: string | null
  fixtureId: number | null
  resolution: 'YES' | 'NO' | null
  settled: boolean
  yesPool: number
  noPool: number
  merkleRoots: string | null // the daily_scores_roots account the proof was checked against
  steps: VerifyStep[]
}

// Two settlements proven against the real TxLINE oracle (see VERIFY.md).
export const GENUINE = [
  { sig: '5QZzypbShX2VJzQuCpRJfUDb5F4oTx7H8v2RxrAh4NJybPnmMkG6PwVk25avgUFbZhneBxfNfE9hdYXmUEZ3Nexy', label: 'Fixture 18179549 · real 1–0 → YES' },
  { sig: '4TG9BU5XCi3hRAPq7wLKJtydFvN7XhCSo86Lp3SGbku4BqUneKBPWmnz1ZVkgY8u4dzc2jys11asrmaWRJRn3LJZ', label: 'Fixture 18193785 · real 1–4 → NO' },
]

function readMarketAccount(data: Buffer) {
  // Market: 8 disc +32 authority +8 fixture_id +5 market_type(MatchWinner) +32 settle_authority
  //         +1 state@85 +8 yes@86 +8 no@94 +1 res_tag@102 +1 outcome@103
  const fixtureId = Number(data.readBigUInt64LE(40))
  const settled = data[85] === 1
  const yes = Number(data.readBigUInt64LE(86))
  const no = Number(data.readBigUInt64LE(94))
  const resolution = data[102] === 1 ? (data[103] === 0 ? 'YES' : 'NO') : null
  return { fixtureId, settled, yes, no, resolution: resolution as 'YES' | 'NO' | null }
}

export async function verifySettle(conn: Connection, sig: string): Promise<VerifyResult> {
  const base: VerifyResult = {
    sig, found: false, cpiIntoTxline: false, ranValidateStat: false, verdictByte: null,
    returnDataB64: null, market: null, fixtureId: null, resolution: null, settled: false,
    yesPool: 0, noPool: 0, merkleRoots: null, steps: [],
  }
  let tx
  try {
    tx = await conn.getTransaction(sig.trim(), { maxSupportedTransactionVersion: 0 })
  } catch (e: any) {
    return { ...base, error: `RPC error: ${e.message || e}` }
  }
  if (!tx) return { ...base, error: 'Transaction not found on this cluster (devnet).' }
  base.found = true

  const logs = tx.meta?.logMessages || []
  const txlineStr = TXLINE.toBase58()
  const cpiIntoTxline = logs.some(l => l.includes(txlineStr) && l.includes('invoke'))
  const ranValidateStat = logs.some(l => /Instruction: ValidateStat/i.test(l))
  const retLine = logs.find(l => l.startsWith(`Program return: ${txlineStr}`))
  const returnDataB64 = retLine ? retLine.split(' ').pop()! : null
  let verdictByte: number | null = null
  if (returnDataB64) { try { verdictByte = Buffer.from(returnDataB64, 'base64')[0] ?? null } catch {} }

  // Locate the Fulltime settle instruction and its market account (accounts[0]).
  const msg: any = tx.transaction.message
  const keys: PublicKey[] = msg.staticAccountKeys || msg.accountKeys || []
  const ixs: any[] = msg.compiledInstructions || msg.instructions || []
  let marketPk: PublicKey | null = null
  let rootsPk: PublicKey | null = null
  for (const ix of ixs) {
    const pidIdx = ix.programIdIndex
    if (keys[pidIdx]?.equals(FULLTIME)) {
      const accIdx: number[] = ix.accountKeyIndexes || ix.accounts || []
      if (accIdx[0] != null) marketPk = keys[accIdx[0]] || null
      if (accIdx[3] != null) rootsPk = keys[accIdx[3]] || null // daily_scores_merkle_roots
    }
  }

  let market = null
  if (marketPk) {
    const info = await conn.getAccountInfo(marketPk)
    if (info) market = readMarketAccount(info.data as Buffer)
  }

  const steps: VerifyStep[] = [
    { label: 'Settlement transaction confirmed', ok: tx.meta?.err == null, detail: tx.meta?.err ? `reverted: ${JSON.stringify(tx.meta.err)}` : 'succeeded on devnet' },
    { label: 'Fulltime.settle called the REAL TxLINE program', ok: cpiIntoTxline, detail: cpiIntoTxline ? `CPI → ${txlineStr.slice(0, 8)}…` : 'no CPI into TxLINE found' },
    { label: 'TxLINE ran validate_stat (Merkle proof checked on-chain)', ok: ranValidateStat, detail: ranValidateStat ? 'proof verified against anchored daily_scores_roots' : 'validate_stat not observed' },
    { label: 'TxLINE returned a cryptographic verdict', ok: returnDataB64 != null, detail: returnDataB64 ? `return data ${returnDataB64} = 0x${(verdictByte ?? 0).toString(16).padStart(2, '0')} (${verdictByte === 1 ? 'predicate TRUE' : 'predicate FALSE'})` : 'no return data' },
    { label: 'Outcome was DERIVED from the verdict, not supplied by the caller', ok: market?.resolution != null, detail: market?.resolution ? `market resolved ${market.resolution}${verdictByte != null ? ` (verdict ${verdictByte === 1 ? 'TRUE→YES' : 'FALSE→NO'})` : ''}` : 'market resolution unavailable' },
  ]

  return {
    ...base,
    error: undefined,
    cpiIntoTxline,
    ranValidateStat,
    verdictByte,
    returnDataB64,
    market: marketPk?.toBase58() || null,
    fixtureId: market?.fixtureId ?? null,
    resolution: market?.resolution ?? null,
    settled: market?.settled ?? false,
    yesPool: market?.yes ?? 0,
    noPool: market?.no ?? 0,
    merkleRoots: rootsPk?.toBase58() || null,
    steps,
  }
}
