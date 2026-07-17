// End-to-end on-chain demo of the Fulltime program:
// create test USDC -> create_market -> deposit_yes/deposit_no -> admin_settle -> claim.
// Run: DEPLOYER_KEYPAIR=/path/deployer.json node ft-demo.mjs
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  TransactionInstruction, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {
  TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { createHash } from 'crypto'
import fs from 'fs'

const RPC = 'https://api.devnet.solana.com'
const PROGRAM = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const conn = new Connection(RPC, 'confirmed')
const deployer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'))))
const EX = s => `https://explorer.solana.com/tx/${s}?cluster=devnet`

const disc = name => createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const cat = (...a) => Buffer.concat(a.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x)))

const FIXTURE_ID = 18257865 // France v England (demo fixture)
const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), u64(FIXTURE_ID)], PROGRAM)
const [vaultAuth] = PublicKey.findProgramAddressSync([Buffer.from('vault'), marketPda.toBuffer()], PROGRAM)
const depositPda = (user) => PublicKey.findProgramAddressSync([Buffer.from('deposit'), marketPda.toBuffer(), user.toBuffer()], PROGRAM)[0]

const sigs = {}
async function send(ixs, signers, label) {
  const tx = new Transaction().add(...ixs)
  const s = await sendAndConfirmTransaction(conn, tx, signers, { commitment: 'confirmed' })
  sigs[label] = s; console.log(`  ✅ ${label}: ${EX(s)}`)
  return s
}

console.log('Deployer:', deployer.publicKey.toBase58(), '| market PDA:', marketPda.toBase58())

// 0) second bettor
const user2 = Keypair.generate()
console.log('\n[0] Funding a second bettor', user2.publicKey.toBase58().slice(0, 8), '...')
await send([SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: user2.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })], [deployer], 'fund_user2')

// 1) test USDC (Token-2022, 6 decimals)
console.log('\n[1] Creating test USDC mint (Token-2022)...')
const mint = await createMint(conn, deployer, deployer.publicKey, null, 6, Keypair.generate(), { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID)
console.log('  mint:', mint.toBase58())
const a1 = await getOrCreateAssociatedTokenAccount(conn, deployer, mint, deployer.publicKey, false, 'confirmed', undefined, TOKEN_2022_PROGRAM_ID)
const a2 = await getOrCreateAssociatedTokenAccount(conn, deployer, mint, user2.publicKey, false, 'confirmed', undefined, TOKEN_2022_PROGRAM_ID)
await mintTo(conn, deployer, mint, a1.address, deployer, 1000_000000, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID)
await mintTo(conn, deployer, mint, a2.address, deployer, 1000_000000, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID)
console.log('  minted 1000 test USDC to each bettor')

const vault = getAssociatedTokenAddressSync(mint, vaultAuth, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

// 2) create_market(fixture_id, MatchWinner{0,1}, settle_authority=deployer)
console.log('\n[2] create_market (MatchWinner: France=YES vs England=NO)...')
const marketType = cat(Buffer.from([0]), u16(0), u16(1)) // variant 0 = MatchWinner{team1_key,team2_key}
const cmData = cat(disc('create_market'), u64(FIXTURE_ID), marketType, deployer.publicKey.toBuffer())
await send([new TransactionInstruction({
  programId: PROGRAM, data: cmData,
  keys: [
    { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
    { pubkey: marketPda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
})], [deployer], 'create_market')

// 3) deposits
function depositIx(name, user, userToken, amount) {
  return new TransactionInstruction({
    programId: PROGRAM, data: cat(disc(name), u64(amount)),
    keys: [
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: user.publicKey, isSigner: true, isWritable: true },
      { pubkey: depositPda(user.publicKey), isSigner: false, isWritable: true },
      { pubkey: userToken, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  })
}
console.log('\n[3] deposit_yes 100 (user1) + deposit_no 50 (user2)...')
await send([depositIx('deposit_yes', deployer, a1.address, 100_000000)], [deployer], 'deposit_yes')
await send([depositIx('deposit_no', user2, a2.address, 50_000000)], [user2], 'deposit_no')
console.log('  vault balance:', (await getAccount(conn, vault, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount.toString(), '(150 USDC escrowed)')

// 4) admin_settle(Yes)  — France wins (demo fallback; settle() uses the real TxLINE proof when available)
console.log('\n[4] admin_settle -> YES (France wins)...')
await send([new TransactionInstruction({
  programId: PROGRAM, data: cat(disc('admin_settle'), Buffer.from([0])), // Outcome::Yes = 0
  keys: [
    { pubkey: marketPda, isSigner: false, isWritable: true },
    { pubkey: deployer.publicKey, isSigner: true, isWritable: false },
  ],
})], [deployer], 'admin_settle')

// 5) claim (winner = user1/YES)
console.log('\n[5] claim_winnings (user1, YES) -> should receive the 150 USDC pool...')
await send([new TransactionInstruction({
  programId: PROGRAM, data: cat(disc('claim_winnings'), u64(100_000000)),
  keys: [
    { pubkey: marketPda, isSigner: false, isWritable: true },
    { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
    { pubkey: depositPda(deployer.publicKey), isSigner: false, isWritable: true },
    { pubkey: a1.address, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: vaultAuth, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ],
})], [deployer], 'claim_winnings')
const finalBal = (await getAccount(conn, a1.address, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount
console.log('  user1 USDC after claim:', finalBal.toString(), '(started 1000, staked 100, won pool)')

console.log('\n===== SUMMARY (all on devnet) =====')
console.log('market:', marketPda.toBase58())
console.log('mint:', mint.toBase58())
for (const [k, v] of Object.entries(sigs)) console.log(`${k}: ${EX(v)}`)
fs.writeFileSync(process.env.OUT || '/tmp/ft-demo.json', JSON.stringify({ market: marketPda.toBase58(), mint: mint.toBase58(), fixtureId: FIXTURE_ID, sigs }, null, 2))
console.log('\nsaved ->', process.env.OUT || '/tmp/ft-demo.json')
