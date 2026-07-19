import { NextResponse } from 'next/server'
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import cfg from '@/lib/demo-market.json'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const RPC = process.env.NEXT_PUBLIC_RPC || 'https://api.devnet.solana.com'
const MINT = new PublicKey(cfg.mint)

function faucet(): Keypair | null {
  const value = process.env.FULLTIME_FAUCET_SECRET
  if (!value) return null
  try {
    const bytes = value.trim().startsWith('[')
      ? JSON.parse(value)
      : Array.from(Buffer.from(value.trim(), 'base64'))
    return Keypair.fromSecretKey(Uint8Array.from(bytes))
  } catch {
    return null
  }
}

export async function GET() {
  const signer = faucet()
  return NextResponse.json(signer
    ? { enabled: true, faucet: signer.publicKey.toBase58(), mint: MINT.toBase58() }
    : { enabled: false })
}

export async function POST(request: Request) {
  const signer = faucet()
  if (!signer) return NextResponse.json({ error: 'devnet faucet is not configured' }, { status: 503 })

  try {
    const { user } = await request.json()
    const owner = new PublicKey(user)
    const account = getAssociatedTokenAddressSync(
      MINT, owner, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    const connection = new Connection(RPC, 'confirmed')
    const latest = await connection.getLatestBlockhash('confirmed')
    const transaction = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 300_000 }),
      createAssociatedTokenAccountIdempotentInstruction(
        signer.publicKey, account, owner, MINT, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createMintToInstruction(MINT, account, signer.publicKey, 1_000_000000, [], TOKEN_2022_PROGRAM_ID),
    )
    transaction.feePayer = signer.publicKey
    transaction.recentBlockhash = latest.blockhash
    transaction.sign(signer)

    const signature = await connection.sendRawTransaction(transaction.serialize(), { maxRetries: 3 })
    const confirmation = await connection.confirmTransaction({ signature, ...latest }, 'confirmed')
    if (confirmation.value.err) throw new Error(`faucet reverted: ${JSON.stringify(confirmation.value.err)}`)
    return NextResponse.json({ signature })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'faucet failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
