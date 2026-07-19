// create-open-market.mjs — point the /bet page at an UPCOMING fixture so the
// connect -> faucet -> bet flow is live immediately. Unlike create-demo-market.mjs
// this does NOT require the fixture to be finalised (no score yet); settle/claim
// light up on the same market once the match is played and TxLINE has the proof.
//   DEPLOYER_KEYPAIR=deployer.json FIXTURE=18263783 node create-open-market.mjs
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, createMint } from '@solana/spl-token'
import { createHash } from 'crypto'
import fs from 'fs'

const RPC = 'https://api.devnet.solana.com'
const API = 'https://txline-dev.txodds.com'
const PROGRAM = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const FIXTURE = Number(process.env.FIXTURE)
if (!FIXTURE) throw new Error('set FIXTURE')
const conn = new Connection(RPC, 'confirmed')
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'))))
const creds = JSON.parse(fs.readFileSync(process.env.CREDS || process.env.HOME + '/fulltime-keys/txline-creds.json', 'utf8'))
const apiToken = typeof creds.apiToken === 'string' ? creds.apiToken : creds.apiToken.token

const disc = n => createHash('sha256').update(`global:${n}`).digest().subarray(0, 8)
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const cat = (...a) => Buffer.concat(a.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x)))

const jwt = (await (await fetch(`${API}/auth/guest/start`, { method: 'POST' })).json()).token
const H = { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken }
const raw = await (await fetch(`${API}/api/fixtures/snapshot`, { headers: H })).json()
const f = (Array.isArray(raw) ? raw : raw.fixtures || []).find(x => (x.FixtureId || x.Id) === FIXTURE)
if (!f) throw new Error(`fixture ${FIXTURE} not in snapshot`)
// YES = the physical home side (goal stat key 1) wins.
const home = f.Participant1IsHome ? f.Participant1 : f.Participant2
const away = f.Participant1IsHome ? f.Participant2 : f.Participant1
const kickoff = Number(f.StartTime) || Date.parse(f.StartTime)
console.log(`Fixture ${FIXTURE}: ${home} v ${away} (home wins = YES), kickoff ${new Date(kickoff).toISOString()}`)

const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), u64(FIXTURE)], PROGRAM)
if (await conn.getAccountInfo(marketPda)) throw new Error(`market for fixture ${FIXTURE} already exists (${marketPda}); pick another FIXTURE`)

// fresh faucet keypair = test-USDC mint authority (shipped to the browser; devnet only)
const faucet = Keypair.generate()
const mint = await createMint(conn, payer, faucet.publicKey, null, 6, Keypair.generate(), { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID)
console.log(`test-USDC mint: ${mint.toBase58()}`)

const sig = await sendAndConfirmTransaction(conn, new Transaction().add(new TransactionInstruction({
  programId: PROGRAM, data: cat(disc('create_market'), u64(FIXTURE), cat(Buffer.from([0]), u16(1), u16(2)), payer.publicKey.toBuffer()),
  keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }, { pubkey: marketPda, isSigner: false, isWritable: true }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }],
})), [payer], { commitment: 'confirmed' })
console.log(`market created: ${marketPda.toBase58()}  tx ${sig}`)

const config = {
  program: PROGRAM.toBase58(),
  fixtureId: FIXTURE,
  market: marketPda.toBase58(),
  mint: mint.toBase58(),
  faucetSecret: Array.from(faucet.secretKey),
  home, away,
  realResult: { g1: null, g2: null, yesWon: null },   // not played yet
  kickoff,
  txlineApiToken: apiToken,
}
fs.writeFileSync(new URL('./src/lib/demo-market.json', import.meta.url), JSON.stringify(config, null, 2))
console.log(`wrote src/lib/demo-market.json -> ${home} v ${away} (OPEN)`)
