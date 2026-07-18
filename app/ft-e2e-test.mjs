// ft-e2e-test.mjs — settlement + tamper test for the Fulltime program.
//
// Part A (always runs, deterministic): re-verifies the two recorded proof-settle
//   txs on devnet — asserts each one actually CPI'd TxLINE's validate_stat and that
//   the market's on-chain resolution matches the real scoreline. This proves the
//   settle path is proof-derived, not admin/mock — reproducibly, from public state.
// Part B (runs when CREDS + FIXTURE are set): live settle from a fresh finalized
//   proof + the tamper-reverts (fraud) path, by driving app/ft-real-settle.mjs.
//
//   node app/ft-e2e-test.mjs
//   CREDS=~/fulltime-keys/txline-creds.json DEPLOYER_KEYPAIR=~/fulltime-keys/deployer.json \
//     FIXTURE=<fresh-finished-id> node app/ft-e2e-test.mjs   # also runs Part B
import { Connection, PublicKey } from '@solana/web3.js'
import { execFileSync } from 'child_process'

const conn = new Connection('https://api.devnet.solana.com', 'confirmed')
const PROGRAM = new PublicKey('37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW')
const TXLINE = '6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J'
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b }
const marketPda = fx => PublicKey.findProgramAddressSync([Buffer.from('market'), u64(fx)], PROGRAM)[0]

let failed = 0
const ok = (cond, msg) => { console.log(`  ${cond ? '✅' : '❌'} ${msg}`); if (!cond) failed++ }

// Market account (MatchWinner layout): state@85, resolution Option tag@102, Outcome@103.
function readResolution(data) {
  const settled = data[85] === 1
  const res = data[102] === 1 ? (data[103] === 0 ? 'YES' : 'NO') : null
  return { settled, res }
}

// The recorded genuine proof-settles (see VERIFY.md / SUBMISSION.md).
const RECORDED = [
  { fixture: 18179549, score: '1-0', expect: 'YES', sig: '5QZzypbShX2VJzQuCpRJfUDb5F4oTx7H8v2RxrAh4NJybPnmMkG6PwVk25avgUFbZhneBxfNfE9hdYXmUEZ3Nexy' },
  { fixture: 18193785, score: '1-4', expect: 'NO',  sig: '4TG9BU5XCi3hRAPq7wLKJtydFvN7XhCSo86Lp3SGbku4BqUneKBPWmnz1ZVkgY8u4dzc2jys11asrmaWRJRn3LJZ' },
]

console.log('Part A — verify recorded proof-settles on devnet (deterministic)\n')
for (const r of RECORDED) {
  console.log(`fixture ${r.fixture} (real ${r.score} -> expect ${r.expect}):`)
  const tx = await conn.getTransaction(r.sig, { maxSupportedTransactionVersion: 0 })
  const logs = tx?.meta?.logMessages || []
  ok(!!tx && tx.meta?.err == null, `settle tx ${r.sig.slice(0, 10)}… confirmed, no error`)
  ok(logs.some(l => l.includes(TXLINE) && l.includes('invoke')), 'inner CPI into real TxLINE program (6pW64…)')
  ok(logs.some(l => /Instruction: ValidateStat/i.test(l)), 'TxLINE ran ValidateStat (proof checked on-chain)')
  ok(logs.some(l => l.startsWith(`Program return: ${TXLINE}`)), 'TxLINE returned a verdict (return-data read by settle)')
  const acct = await conn.getAccountInfo(marketPda(r.fixture))
  const { settled, res } = acct ? readResolution(acct.data) : { settled: false, res: null }
  ok(settled, 'market state == Settled')
  ok(res === r.expect, `derived resolution == ${r.expect} (on-chain: ${res}) — matches real ${r.score}, not caller-chosen`)
  console.log('')
}

// Part B — live settle + tamper (only if creds + a fresh finished fixture are given).
if (process.env.CREDS && process.env.DEPLOYER_KEYPAIR && process.env.FIXTURE) {
  console.log('Part B — live settle + tamper-reverts on a fresh fixture\n')
  const run = env => {
    try {
      return execFileSync('node', ['app/ft-real-settle.mjs'], {
        cwd: new URL('..', import.meta.url).pathname,
        env: { ...process.env, ...env }, encoding: 'utf8', stdio: 'pipe',
      })
    } catch (e) { return (e.stdout || '') + (e.stderr || '') }
  }
  const settleOut = run({ MODE: 'real' })
  ok(/DERIVED OUTCOME MATCHES THE REAL RESULT/.test(settleOut), 'live settle: derived outcome matches the real result')
  const tamperOut = run({ MODE: 'real', TAMPER: '1' })
  ok(/tampered proof reverted/i.test(tamperOut), 'tamper: a corrupted proof reverts inside validate_stat')
} else {
  console.log('Part B skipped (set CREDS + DEPLOYER_KEYPAIR + FIXTURE=<fresh finished id> to run the live settle + tamper).')
}

console.log(`\n${failed === 0 ? '✅ ALL PASSED' : `❌ ${failed} CHECK(S) FAILED`}`)
process.exit(failed === 0 ? 0 : 1)
