import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { expect } from 'chai'
import { execFileSync } from 'node:child_process'
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
    // Run the compiled Fulltime program and Token-2022 in-process. This is a real
    // escrow transfer with real account layouts, but needs no wallet, USDC, RPC,
    // validator, or devnet funding.
    const output = execFileSync(process.execPath, ['--test', 'tests/hermetic/deposit.test.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(output).to.include('pass 1')
  })
})
