// create-demo-market.mjs — set up a persistent on-chain demo market that the web UI
// lets a judge bet on. Creates a Token-2022 "test USDC" mint whose authority is a
// throwaway FAUCET keypair (shipped to the browser so anyone can mint valueless devnet
// test tokens), then a MatchWinner market bound to a real finished fixture so the
// browser can settle it from a real TxLINE proof and pay out.
//   DEPLOYER_KEYPAIR=deployer.json FIXTURE=18179549 node create-demo-market.mjs
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, createMint } from '@solana/spl-token'
import { createHash } from 'crypto'
import fs from 'fs'

const RPC = 'https://api.devnet.solana.com'
const API = 'https://txline-dev.txodds.com'
const PROGRAM = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const FIXTURE = Number(process.env.FIXTURE || 18179549)
const conn = new Connection(RPC, 'confirmed')
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'))))
const creds = JSON.parse(fs.readFileSync(process.env.CREDS || '/Users/mac/fulltime-keys/txline-creds.json', 'utf8'))
const apiToken = typeof creds.apiToken === 'string' ? creds.apiToken : creds.apiToken.token
const TEAM = { 1144:'India',1215:'Myanmar',1225:'New Zealand',1378:'Vietnam',1489:'Argentina',1519:'Australia',1634:'Brazil',1888:'England',1999:'France',2431:'Liechtenstein',3021:'Spain',45856:'Gibraltar' }
const nm = id => TEAM[id] || `Team ${id}`

const disc = n => createHash('sha256').update(`global:${n}`).digest().subarray(0, 8)
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const cat = (...a) => Buffer.concat(a.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x)))

const jwt = (await (await fetch(`${API}/auth/guest/start`, { method: 'POST' })).json()).token
const H = { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken }
const rows = await (await fetch(`${API}/api/scores/snapshot/${FIXTURE}`, { headers: H })).json()
const fin = rows.filter(r => r.Stats && r.Stats['1'] != null && r.Stats['2'] != null && (r.Action === 'game_finalised' || r.StatusId === 100 || r.Period === 100))
  .sort((a, b) => (b.Seq || 0) - (a.Seq || 0))[0]
if (!fin) throw new Error(`fixture ${FIXTURE} is not finalised`)
const g1 = Number(fin.Stats['1']), g2 = Number(fin.Stats['2'])
const home = nm(fin.Participant1Id), away = nm(fin.Participant2Id)
console.log(`Fixture ${FIXTURE}: ${home} ${g1}-${g2} ${away} -> YES=${g1 > g2}`)

const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), u64(FIXTURE)], PROGRAM)
if (await conn.getAccountInfo(marketPda)) throw new Error(`market for fixture ${FIXTURE} already exists (${marketPda}); pick another FIXTURE`)

// faucet keypair = the test-USDC mint authority (shipped to the browser; devnet only)
const faucet = Keypair.generate()
const mint = await createMint(conn, payer, faucet.publicKey, null, 6, Keypair.generate(), { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID)
console.log(`test-USDC mint: ${mint.toBase58()} (authority = faucet ${faucet.publicKey.toBase58()})`)

// MatchWinner market with team1_key=1, team2_key=2 (the goal stat keys), so the browser
// can settle it from the real validate_stat proof.
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
  faucetSecret: Array.from(faucet.secretKey),   // devnet test-USDC mint authority
  home, away, realResult: { g1, g2, yesWon: g1 > g2 },
  txlineApiToken: apiToken,   // free read-only devnet token, used to fetch the settle proof
}
const out = new URL('./src/lib/demo-market.json', import.meta.url)
fs.writeFileSync(out, JSON.stringify(config, null, 2))
console.log(`wrote src/lib/demo-market.json`)
