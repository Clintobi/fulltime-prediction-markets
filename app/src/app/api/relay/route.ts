// Gasless relayer — sponsors the network fee for Fulltime transactions so bettors
// never need SOL (Solana-native fee-payer sponsorship). SAFETY: it only co-signs
// transactions whose fee payer is the relayer AND whose every instruction targets a
// whitelisted program (this app's program + the token/ATA/system/compute programs),
// so it can never be tricked into sponsoring an arbitrary drain.
// Configure by setting RELAYER_SECRET (base64 of the 64-byte key, or a JSON array).
// If unset, GET reports { enabled:false } and the client falls back to wallet-pays.
import { NextResponse } from 'next/server'
import { Connection, Keypair, Transaction } from '@solana/web3.js'

const RPC = process.env.NEXT_PUBLIC_RPC || 'https://api.devnet.solana.com'
const ALLOWED = new Set([
  '37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW', // Fulltime program
  'ComputeBudget111111111111111111111111111111',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token
  '11111111111111111111111111111111', // System
])

function relayer(): Keypair | null {
  const s = process.env.RELAYER_SECRET
  if (!s) return null
  try {
    const bytes = s.trim().startsWith('[') ? JSON.parse(s) : Array.from(Buffer.from(s.trim(), 'base64'))
    return Keypair.fromSecretKey(Uint8Array.from(bytes))
  } catch { return null }
}

export async function GET() {
  const kp = relayer()
  return NextResponse.json(kp ? { enabled: true, relayer: kp.publicKey.toBase58() } : { enabled: false })
}

export async function POST(req: Request) {
  const kp = relayer()
  if (!kp) return NextResponse.json({ error: 'relayer not configured' }, { status: 503 })
  try {
    const { tx } = await req.json()
    const t = Transaction.from(Buffer.from(tx, 'base64'))
    if (!t.feePayer?.equals(kp.publicKey)) return NextResponse.json({ error: 'fee payer must be the relayer' }, { status: 400 })
    for (const ix of t.instructions)
      if (!ALLOWED.has(ix.programId.toBase58())) return NextResponse.json({ error: `program not allowed: ${ix.programId.toBase58()}` }, { status: 400 })
    t.partialSign(kp) // add the fee-payer signature; the user's signature is already present
    const conn = new Connection(RPC, 'confirmed')
    const sig = await conn.sendRawTransaction(t.serialize(), { maxRetries: 3 })
    return NextResponse.json({ sig })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'relay failed' }, { status: 400 })
  }
}
