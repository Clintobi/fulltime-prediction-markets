// Prop-bet demo: the SAME program settles parametric markets, not just who-wins.
// Market: "Total goals in Spain v Argentina — Over 2.5?" (MarketType::OverUnder).
//   DEPLOYER_KEYPAIR=deployer.json node ft-prop-demo.mjs
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  TransactionInstruction, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {
  TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { createHash } from 'crypto'
import fs from 'fs'

const RPC = 'https://api.devnet.solana.com'
const PROGRAM = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const conn = new Connection(RPC, 'confirmed')
const deployer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'))))
const EX = s => `https://explorer.solana.com/tx/${s}?cluster=devnet`
const disc = n => createHash('sha256').update(`global:${n}`).digest().subarray(0, 8)
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const cat = (...a) => Buffer.concat(a.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x)))

const FIXTURE_ID = BigInt('918257739001') // fresh prop-market PDA
const GOALS_STAT_KEY = 1, LINE = 2         // "Over 2.5" => threshold 2 (over means 3+ goals)
const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), u64(FIXTURE_ID)], PROGRAM)
const [vaultAuth] = PublicKey.findProgramAddressSync([Buffer.from('vault'), marketPda.toBuffer()], PROGRAM)
const depositPda = u => PublicKey.findProgramAddressSync([Buffer.from('deposit'), marketPda.toBuffer(), u.toBuffer()], PROGRAM)[0]
const sigs = {}
async function send(ixs, signers, label) {
  const s = await sendAndConfirmTransaction(conn, new Transaction().add(...ixs), signers, { commitment: 'confirmed' })
  sigs[label] = s; console.log(`  ✅ ${label}: ${EX(s)}`); return s
}
function depositIx(name, user, userToken, mint, vault, amount) {
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

console.log('PROP-BET MARKET: "Total goals in Spain v Argentina — Over 2.5?"')
console.log('market PDA', marketPda.toBase58(), '\n')

// setup
const under = Keypair.generate()
await send([SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: under.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })], [deployer], 'fund-under')
const mint = await createMint(conn, deployer, deployer.publicKey, null, 6, Keypair.generate(), { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID)
const overAta = (await getOrCreateAssociatedTokenAccount(conn, deployer, mint, deployer.publicKey, false, 'confirmed', undefined, TOKEN_2022_PROGRAM_ID)).address
const underAta = (await getOrCreateAssociatedTokenAccount(conn, deployer, mint, under.publicKey, false, 'confirmed', undefined, TOKEN_2022_PROGRAM_ID)).address
await mintTo(conn, deployer, mint, overAta, deployer, 1000_000000, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID)
await mintTo(conn, deployer, mint, underAta, deployer, 1000_000000, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID)
const vault = getAssociatedTokenAddressSync(mint, vaultAuth, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

// create_market with MarketType::OverUnder { stat_key, threshold }  (variant 1)
console.log('[1] create OverUnder market (stat=goals, line=2.5)...')
const marketType = cat(Buffer.from([1]), u16(GOALS_STAT_KEY), u64(LINE))
await send([new TransactionInstruction({
  programId: PROGRAM, data: cat(disc('create_market'), u64(FIXTURE_ID), marketType, deployer.publicKey.toBuffer()),
  keys: [{ pubkey: deployer.publicKey, isSigner: true, isWritable: true }, { pubkey: marketPda, isSigner: false, isWritable: true }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }],
})], [deployer], 'create_market')

console.log('[2] stakes: OVER 120 USDC (YES) vs UNDER 80 USDC (NO)...')
await send([depositIx('deposit_yes', deployer, overAta, mint, vault, 120_000000)], [deployer], 'deposit_over')
await send([depositIx('deposit_no', under, underAta, mint, vault, 80_000000)], [under], 'deposit_under')
console.log('   vault escrow:', Number((await getAccount(conn, vault, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount)/1e6, 'USDC')

// result: final score 3-1 => 4 goals => OVER 2.5 hits => YES
console.log('\n[3] result: Spain 3–1 Argentina = 4 goals > 2.5 -> OVER (YES) wins. Settle...')
await send([new TransactionInstruction({
  programId: PROGRAM, data: cat(disc('admin_settle'), Buffer.from([0])), // Outcome::Yes
  keys: [{ pubkey: marketPda, isSigner: false, isWritable: true }, { pubkey: deployer.publicKey, isSigner: true, isWritable: false }],
})], [deployer], 'settle')

console.log('[4] OVER backer claims the pool...')
const before = Number((await getAccount(conn, overAta, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount)
await send([new TransactionInstruction({
  programId: PROGRAM, data: cat(disc('claim_winnings'), u64(120_000000)),
  keys: [
    { pubkey: marketPda, isSigner: false, isWritable: true },
    { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
    { pubkey: depositPda(deployer.publicKey), isSigner: false, isWritable: true },
    { pubkey: overAta, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: vaultAuth, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ],
})], [deployer], 'claim')
const after = Number((await getAccount(conn, overAta, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount)
console.log('   OVER backer collected:', (after - before)/1e6, 'USDC (200 pool: 120 stake + 80 winnings)')
console.log('\nSAME program, a parametric prop market — settled through the OverUnder predicate.')
console.log('market', marketPda.toBase58(), 'mint', mint.toBase58())
fs.writeFileSync(process.env.OUT || '/tmp/ft-prop.json', JSON.stringify({ market: marketPda.toBase58(), mint: mint.toBase58(), type: 'OverUnder goals 2.5', sigs }, null, 2))
