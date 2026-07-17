// ft-claim-test.mjs — prove claim_winnings is no longer drainable and pays pro-rata.
//
// Scenario: YES pool = A(100) + B(50) = 150; NO pool = C(100). total = 250.
// After settle YES, A tries to claim with an INFLATED amount (the whole winning pool).
// Correct behaviour: A gets 100*250/150 = 166.6, B gets 50*250/150 = 83.3, sum = 250.
// The old bug let A pass amount=150 and drain the full 250 vault, leaving B nothing.
//   DEPLOYER_KEYPAIR=deployer.json node ft-claim-test.mjs
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
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'))))
const FIXTURE = BigInt(process.env.MARKET_NONCE || Date.now())

const disc = n => createHash('sha256').update(`global:${n}`).digest().subarray(0, 8)
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const cat = (...a) => Buffer.concat(a.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x)))

const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), u64(FIXTURE)], PROGRAM)
const [vaultAuth] = PublicKey.findProgramAddressSync([Buffer.from('vault'), marketPda.toBuffer()], PROGRAM)
const depositPda = u => PublicKey.findProgramAddressSync([Buffer.from('deposit'), marketPda.toBuffer(), u.toBuffer()], PROGRAM)[0]

async function send(ixs, signers, label) {
  const s = await sendAndConfirmTransaction(conn, new Transaction().add(...ixs), signers, { commitment: 'confirmed' })
  console.log(`  ${label}: ok`); return s
}
async function bal(ata) { try { return Number((await getAccount(conn, ata, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount) } catch { return 0 } }

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
function claimIx(user, userToken, mint, vault, inflatedAmount) {
  return new TransactionInstruction({
    programId: PROGRAM, data: cat(disc('claim_winnings'), u64(inflatedAmount)), // inflated -> must be IGNORED
    keys: [
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: user.publicKey, isSigner: true, isWritable: true },
      { pubkey: depositPda(user.publicKey), isSigner: false, isWritable: true },
      { pubkey: userToken, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
  })
}

const A = Keypair.generate(), B = Keypair.generate(), C = Keypair.generate()
for (const k of [A, B, C]) await send([SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: k.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })], [payer], `fund ${k.publicKey.toBase58().slice(0, 4)}`)
const mint = await createMint(conn, payer, payer.publicKey, null, 6, Keypair.generate(), { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID)
const ata = async o => (await getOrCreateAssociatedTokenAccount(conn, payer, mint, o, false, 'confirmed', undefined, TOKEN_2022_PROGRAM_ID)).address
const [aA, aB, aC] = [await ata(A.publicKey), await ata(B.publicKey), await ata(C.publicKey)]
for (const t of [aA, aB, aC]) await mintTo(conn, payer, mint, t, payer, 500_000000, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID)
const vault = getAssociatedTokenAddressSync(mint, vaultAuth, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

console.log(`market ${marketPda.toBase58()}`)
await send([new TransactionInstruction({
  programId: PROGRAM, data: cat(disc('create_market'), u64(FIXTURE), cat(Buffer.from([0]), u16(1), u16(2)), payer.publicKey.toBuffer()),
  keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }, { pubkey: marketPda, isSigner: false, isWritable: true }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }],
})], [payer], 'create_market')
await send([depositIx('deposit_yes', A, aA, mint, vault, 100_000000)], [A], 'A deposit_yes 100')
await send([depositIx('deposit_yes', B, aB, mint, vault, 50_000000)], [B], 'B deposit_yes 50')
await send([depositIx('deposit_no', C, aC, mint, vault, 100_000000)], [C], 'C deposit_no 100')
console.log(`vault after deposits: ${(await bal(vault)) / 1e6} USDC (expect 250)`)

await send([new TransactionInstruction({
  programId: PROGRAM, data: cat(disc('admin_settle'), Buffer.from([0])), // YES wins
  keys: [{ pubkey: marketPda, isSigner: false, isWritable: true }, { pubkey: payer.publicKey, isSigner: true, isWritable: false }],
})], [payer], 'admin_settle YES')

// A claims with a GROSSLY inflated amount — the fix must ignore it and pay pro-rata.
const aA0 = await bal(aA)
await send([claimIx(A, aA, mint, vault, 100_000_000_000n)], [A], 'A claim (inflated amount 100000!)')
const aGain = (await bal(aA) - aA0) / 1e6
console.log(`A received: ${aGain} USDC (fair = 100*250/150 = 166.7; drain would be 250)`)
const bB0 = await bal(aB)
await send([claimIx(B, aB, mint, vault, 50_000000)], [B], 'B claim')
const bGain = (await bal(aB) - bB0) / 1e6
console.log(`B received: ${bGain} USDC (fair = 50*250/150 = 83.3)`)
console.log(`vault remaining: ${(await bal(vault)) / 1e6} USDC (dust only)`)

const drainBlocked = aGain < 200          // a drain would give A ~250
const bPaid = bGain > 80                    // B still got paid (would be 0 if A drained)
console.log(`\n${drainBlocked && bPaid ? '✅ PASS' : '❌ FAIL'}: drain ${drainBlocked ? 'blocked' : 'NOT blocked'}, second winner ${bPaid ? 'paid' : 'STARVED'}`)
process.exit(drainBlocked && bPaid ? 0 : 1)
