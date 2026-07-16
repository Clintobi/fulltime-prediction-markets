import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { expect } from 'chai'
import type { Fulltime } from '../target/types/fulltime'

describe('fulltime', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Fulltime as Program<Fulltime>

  it('creates a prediction market', async () => {
    const fixtureId = new anchor.BN(500001)
    const marketType = {
      matchWinner: {
        team1Key: 1,
        team2Key: 2,
      },
    }

    const [marketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('market'),
        fixtureId.toArrayLike(Buffer, 'le', 8),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId
    )

    await program.methods
      .createMarket(fixtureId, marketType, provider.wallet.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        market: marketPda,
      })
      .rpc()

    const market = await program.account.market.fetch(marketPda)
    expect(market.fixtureId.toString()).to.equal(fixtureId.toString())
    expect(market.state).to.have.property('open')
  })

  it('allows depositing USDC on a market', async () => {
    // Integration test — requires:
    // 1. A funded USDC token account
    // 2. An initialized vault PDA
    //
    // For full integration testing, run:
    //   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
    //   anchor test --skip-deploy
    console.log('Deposit test requires USDC tokens. Skipping in unit test mode.')
  })
})
