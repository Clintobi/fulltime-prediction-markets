// Real deposit coverage with LiteSVM. This executes the compiled Fulltime SBF
// program plus Token-2022 against real account layouts—no RPC, wallet, mint, or
// validator setup required.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import { LiteSVM } from 'litesvm'
import { Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js'
import {
  ACCOUNT_SIZE,
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  MintLayout,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FULLTIME = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const ZERO = new PublicKey(new Uint8Array(32))
const fixtureId = 700_001n
const amount = 125_000_000n

const disc = (name) => createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
const u64 = (value) => { const out = Buffer.alloc(8); out.writeBigUInt64LE(BigInt(value)); return out }
const failed = (result) => typeof result?.err === 'function' ? result.err() != null : result?.constructor?.name?.includes('Failed')

function send(svm, payer, instructions) {
  const tx = new Transaction().add(...instructions)
  tx.recentBlockhash = svm.latestBlockhash()
  tx.feePayer = payer.publicKey
  tx.sign(payer)
  return svm.sendTransaction(tx)
}

function marketPda() {
  return PublicKey.findProgramAddressSync([Buffer.from('market'), u64(fixtureId)], FULLTIME)[0]
}

function createMarketIx(payer) {
  const data = Buffer.concat([
    disc('create_market'),
    u64(fixtureId),
    Buffer.from([0]), // MarketType::MatchWinner
    Buffer.from([1, 0, 2, 0]),
    payer.publicKey.toBuffer(),
  ])
  return new TransactionInstruction({
    programId: FULLTIME,
    data,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: marketPda(), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  })
}

function encodeMint(authority) {
  const data = Buffer.alloc(MINT_SIZE)
  MintLayout.encode({
    mintAuthorityOption: 1,
    mintAuthority: authority,
    supply: 1_000_000_000n,
    decimals: 6,
    isInitialized: true,
    freezeAuthorityOption: 0,
    freezeAuthority: ZERO,
  }, data)
  return data
}

function encodeTokenAccount(mint, owner, balance) {
  const data = Buffer.alloc(ACCOUNT_SIZE)
  AccountLayout.encode({
    mint,
    owner,
    amount: balance,
    delegateOption: 0,
    delegate: ZERO,
    state: 1,
    isNativeOption: 0,
    isNative: 0n,
    delegatedAmount: 0n,
    closeAuthorityOption: 0,
    closeAuthority: ZERO,
  }, data)
  return data
}

test('deposit_yes transfers real Token-2022 units into escrow and records the position', () => {
  const svm = new LiteSVM()
  svm.addProgramFromFile(FULLTIME, path.join(HERE, 'artifacts', 'fulltime.so'))
  const payer = Keypair.generate()
  const mint = Keypair.generate().publicKey
  svm.airdrop(payer.publicKey, 10_000_000_000n)

  const market = marketPda()
  const [deposit] = PublicKey.findProgramAddressSync(
    [Buffer.from('deposit'), market.toBuffer(), payer.publicKey.toBuffer()], FULLTIME)
  const [vaultAuthority] = PublicKey.findProgramAddressSync([Buffer.from('vault'), market.toBuffer()], FULLTIME)
  const userToken = getAssociatedTokenAddressSync(mint, payer.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
  const vault = getAssociatedTokenAddressSync(mint, vaultAuthority, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

  svm.setAccount(mint, { lamports: 10_000_000, data: encodeMint(payer.publicKey), owner: TOKEN_2022_PROGRAM_ID, executable: false, rentEpoch: 0 })
  svm.setAccount(userToken, { lamports: 10_000_000, data: encodeTokenAccount(mint, payer.publicKey, 500_000_000n), owner: TOKEN_2022_PROGRAM_ID, executable: false, rentEpoch: 0 })
  svm.setAccount(vault, { lamports: 10_000_000, data: encodeTokenAccount(mint, vaultAuthority, 0n), owner: TOKEN_2022_PROGRAM_ID, executable: false, rentEpoch: 0 })

  assert.ok(!failed(send(svm, payer, [createMarketIx(payer)])), 'market creation succeeds')
  const depositIx = new TransactionInstruction({
    programId: FULLTIME,
    data: Buffer.concat([disc('deposit_yes'), u64(amount)]),
    keys: [
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: deposit, isSigner: false, isWritable: true },
      { pubkey: userToken, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  })
  const result = send(svm, payer, [depositIx])
  assert.ok(!failed(result), 'deposit instruction succeeds')

  const marketData = Buffer.from(svm.getAccount(market).data)
  const depositData = Buffer.from(svm.getAccount(deposit).data)
  const userAfter = AccountLayout.decode(Buffer.from(svm.getAccount(userToken).data))
  const vaultAfter = AccountLayout.decode(Buffer.from(svm.getAccount(vault).data))

  assert.equal(marketData.readBigUInt64LE(86), amount, 'YES pool increases by the deposited amount')
  assert.equal(depositData.readBigUInt64LE(72), amount, 'position account records the amount')
  assert.equal(depositData[80], 1, 'position records YES')
  assert.equal(depositData[81], 0, 'position starts unclaimed')
  assert.equal(userAfter.amount, 375_000_000n, 'user Token-2022 balance decreases')
  assert.equal(vaultAfter.amount, amount, 'vault receives exactly the stake')
})
