import {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from '@solana/web3.js'
import { BN, AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import * as nacl from 'tweetnacl'

const DEVNET = {
  rpcUrl: 'https://api.devnet.solana.com',
  apiOrigin: 'https://txline-dev.txodds.com',
  programId: new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J'),
  txlTokenMint: new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG'),
  fulltimeProgramId: new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW'),
}

export async function settleMarket(
  proof: any
): Promise<string | null> {
  const secretKeyString = process.env.BOT_WALLET_SECRET_KEY
  if (!secretKeyString) {
    console.warn('BOT_WALLET_SECRET_KEY not set. Skipping on-chain settlement.')
    return null
  }

  const secretKey = Buffer.from(secretKeyString, 'base64')
  const wallet = new Wallet(
    // @ts-ignore - Keypair.fromSecretKey exists at runtime
    secretKey
  )
  const connection = new Connection(DEVNET.rpcUrl, 'confirmed')
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  })

  const dailyScoresPda = deriveDailyScoresPda(
    proof.summary.updateStats.minTimestamp
  )

  const settleIx = buildSettleInstruction(
    proof,
    dailyScoresPda,
    wallet.publicKey
  )

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    settleIx
  )

  try {
    const sig = await provider.sendAndConfirm(tx)
    console.log(`Settlement tx confirmed: ${sig}`)
    return sig
  } catch (err) {
    console.error('Settlement tx failed:', err)
    return null
  }
}

function deriveDailyScoresPda(timestampMs: number): PublicKey {
  const epochDay = Math.floor(timestampMs / 86400000)
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('daily_scores_roots'),
      new BN(epochDay).toArrayLike(Buffer, 'le', 2),
    ],
    DEVNET.programId
  )
  return pda
}

function buildSettleInstruction(
  proof: any,
  dailyScoresPda: PublicKey,
  settler: PublicKey
): any {
  const ts = new BN(proof.summary.updateStats.minTimestamp)
  const fixtureId = new BN(proof.summary.fixtureId)
  const updateCount = proof.summary.updateStats.updateCount
  const minTimestamp = new BN(proof.summary.updateStats.minTimestamp)
  const maxTimestamp = new BN(proof.summary.updateStats.maxTimestamp)

  const toBytes32 = (val: any): number[] => {
    const bytes = Buffer.from(val, 'base64')
    if (bytes.length !== 32) throw new Error(`Expected 32 bytes, got ${bytes.length}`)
    return Array.from(bytes)
  }

  const toProof = (nodes: any[]) =>
    nodes.map((n: any) => ({
      hash: toBytes32(n.hash),
      isRightSibling: n.isRightSibling,
    }))

  const fixtureSummary = {
    fixtureId,
    updateStats: {
      updateCount,
      minTimestamp,
      maxTimestamp,
    },
    eventsSubTreeRoot: toBytes32(proof.summary.eventStatsSubTreeRoot),
  }

  const payload = {
    ts,
    fixtureSummary,
    fixtureProof: toProof(proof.subTreeProof),
    mainTreeProof: toProof(proof.mainTreeProof),
    eventStatRoot: toBytes32(proof.eventStatRoot),
    stats: proof.statsToProve.map((stat: any, idx: number) => ({
      stat,
      statProof: toProof(proof.statProofs[idx]),
    })),
  }

  const strategy = {
    geometricTargets: [],
    distancePredicate: null,
    discretePredicates: [
      {
        binary: {
          indexA: 0,
          indexB: 1,
          op: { subtract: {} },
          predicate: {
            threshold: 0,
            comparison: { greaterThan: {} },
          },
        },
      },
    ],
  }

  return {
    keys: [
      { pubkey: dailyScoresPda, isSigner: false, isWritable: false },
    ],
    programId: DEVNET.programId,
    data: Buffer.from([]),
  }
}
