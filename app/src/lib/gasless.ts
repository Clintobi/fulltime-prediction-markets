// Try to send a transaction gaslessly via the relayer (fee-payer sponsorship).
// Returns the signature on success, or null if the relayer is not configured /
// declines — the caller then falls back to the normal wallet-pays flow. Any relayer
// error also returns null so gasless can never block a bet.
import { Buffer } from 'buffer'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'

export async function trySponsored(
  connection: Connection,
  tx: Transaction,
  signTransaction: (t: Transaction) => Promise<Transaction>,
): Promise<string | null> {
  try {
    const info = await (await fetch('/api/relay')).json()
    if (!info?.enabled || !info.relayer) return null
    const latest = await connection.getLatestBlockhash('confirmed')
    tx.feePayer = new PublicKey(info.relayer)
    tx.recentBlockhash = latest.blockhash
    const signed = await signTransaction(tx) // user signs; relayer sig added server-side
    const b64 = Buffer.from(signed.serialize({ requireAllSignatures: false })).toString('base64')
    const res = await (await fetch('/api/relay', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tx: b64 }),
    })).json()
    if (res?.error || !res?.sig) return null
    for (;;) {
      await new Promise(r => setTimeout(r, 2200))
      const st = await connection.getSignatureStatus(res.sig)
      if (st.value?.err) return null
      const cs = st.value?.confirmationStatus
      if (cs === 'confirmed' || cs === 'finalized') return res.sig
      if ((await connection.getBlockHeight('confirmed')) > latest.lastValidBlockHeight) return null
    }
  } catch {
    return null // any failure → caller uses the normal wallet-pays flow
  }
}
