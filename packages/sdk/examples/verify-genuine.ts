// Verify the two genuine on-chain settlements + re-fold the proof off-chain.
import { Connection } from '@solana/web3.js'
import { verifySettlement, verifyProofMerkle, GENUINE_SETTLEMENTS } from '../src/index'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const conn = new Connection(process.env.RPC || 'https://api.devnet.solana.com', 'confirmed')
  let allOk = true
  for (const g of GENUINE_SETTLEMENTS) {
    const r = await verifySettlement(conn, g.sig)
    const ok = r.verified && r.resolution === g.outcome
    allOk = allOk && ok
    console.log(`\nfixture ${g.fixture} (${g.score} -> ${g.outcome}): ${ok ? 'VERIFIED ✅' : 'FAILED ❌'}`)
    console.log(`  cpiIntoTxline=${r.cpiIntoTxline} ranValidateStat=${r.ranValidateStat} verdict=${r.verdict} resolution=${r.resolution}`)
    if (r.reasons.length) console.log('  reasons:', r.reasons.join('; '))
  }
  // off-chain Merkle re-fold of a captured proof
  const proofPath = path.join(__dirname, '..', 'proof-18179549.json')
  if (fs.existsSync(proofPath)) {
    const raw = JSON.parse(fs.readFileSync(proofPath, 'utf8'))
    const m = verifyProofMerkle(raw.raw || raw)
    console.log(`\noff-chain Merkle re-fold: ${m.ok ? 'scoring stats re-fold to the event root ✅' : 'inclusion check failed ❌'}`)
    m.stats.forEach(s => console.log(`  stat key=${s.key} value=${s.value} -> ${s.sentinel ? 'zero/sentinel (validated on-chain)' : 'foldsToEventRoot=' + s.foldsToEventRoot}`))
  }
  console.log(`\n${allOk ? '✅ ALL GENUINE SETTLEMENTS VERIFIED' : '❌ verification failed'}`)
  process.exit(allOk ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
