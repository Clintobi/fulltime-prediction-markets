/**
 * Subscribe to TxLINE free World Cup tier on devnet.
 * Run:
 *   ANCHOR_WALLET=~/.config/solana/id.json \
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   npx ts-node scripts/subscribe.ts
 */
import * as anchor from '@coral-xyz/anchor'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import axios from 'axios'
import nacl from 'tweetnacl'

const DEVNET = {
  rpcUrl: 'https://api.devnet.solana.com',
  apiOrigin: 'https://txline-dev.txodds.com',
  programId: new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J'),
  txlTokenMint: new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG'),
}

async function main() {
  const connection = new anchor.web3.Connection(DEVNET.rpcUrl, 'confirmed')
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  console.log('Wallet:', provider.wallet.publicKey.toBase58())

  const idl = await anchor.Program.fetchIdl(DEVNET.programId, provider)
  if (!idl) throw new Error('Could not fetch IDL')
  const program = new anchor.Program(idl, provider)

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_treasury_v2')],
    program.programId
  )

  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    DEVNET.txlTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('pricing_matrix')],
    program.programId
  )

  const userTokenAccount = getAssociatedTokenAddressSync(
    DEVNET.txlTokenMint,
    provider.wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  console.log('Subscribing to free tier (serviceLevel=1, weeks=4)...')
  const txSig = await program.methods
    .subscribe(1, 4)
    .accounts({
      user: provider.wallet.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: DEVNET.txlTokenMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc()

  console.log('Subscribe tx:', txSig)

  console.log('Activating API token...')
  const authRes = await axios.post(`${DEVNET.apiOrigin}/auth/guest/start`)
  const jwt = authRes.data.token

  const messageStr = `${txSig}::${jwt}`
  const message = new TextEncoder().encode(messageStr)

  const secretKey = (provider.wallet as any).payer?.secretKey
  if (!secretKey) throw new Error('Need local wallet for signing')

  const sigBytes = nacl.sign.detached(message, secretKey)
  const walletSig = Buffer.from(sigBytes).toString('base64')

  const activateRes = await axios.post(
    `${DEVNET.apiOrigin}/api/token/activate`,
    {
      txSig,
      walletSignature: walletSig,
      leagues: [],
    },
    { headers: { Authorization: `Bearer ${jwt}` } }
  )

  const apiToken = activateRes.data.token || activateRes.data
  console.log('API Token:', apiToken)
  console.log('\n✅ Subscription active! Save these credentials:')
  console.log(`  JWT: ${jwt}`)
  console.log(`  API Token: ${apiToken}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
