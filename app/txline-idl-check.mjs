import * as anchor from '@coral-xyz/anchor'
import { PublicKey, Connection, Keypair } from '@solana/web3.js'
import fs from 'fs'
const TXLINE_PROGRAM = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')
const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.DEPLOYER_KEYPAIR, 'utf8'))))
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(kp), {})
const idl = await anchor.Program.fetchIdl(TXLINE_PROGRAM, provider)
fs.writeFileSync(process.env.IDL_OUT, JSON.stringify(idl, null, 2))
console.log('saved full IDL ->', process.env.IDL_OUT, '(', idl.instructions.length, 'instructions )')

for (const name of ['validate_stat', 'validate_stat_v2', 'validateStat', 'validateStatV2']) {
  const ix = idl.instructions.find(i => i.name === name)
  if (ix) {
    console.log(`\n=== ${name} ===`)
    console.log('discriminator:', JSON.stringify(ix.discriminator))
    console.log('args:', JSON.stringify(ix.args, null, 1))
    console.log('accounts:', ix.accounts.map(a => a.name).join(', '))
  }
}
// my program hardcodes disc [208,215,194,214,241,71,246,178]
console.log('\nMy program hardcoded disc: [208,215,194,214,241,71,246,178]')
// show all validate* instruction discriminators
console.log('\nAll validate* / stat* instructions:')
for (const i of idl.instructions) if (/valid|stat|score/i.test(i.name)) console.log('  ', i.name, JSON.stringify(i.discriminator))
