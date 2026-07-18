# @fulltime/sdk

TypeScript SDK + a trustless-settlement **verifier** for the Fulltime prediction
market (settled by a CPI into TxLINE's on-chain `validate_stat`; trustless-only —
no admin path).

```ts
import { Connection } from '@solana/web3.js'
import { FulltimeClient, verifySettlement, verifyProofMerkle } from '@fulltime/sdk'

const client = new FulltimeClient(new Connection('https://api.devnet.solana.com'))

// Independently verify that a settlement was proof-derived, not admin-chosen:
const r = await verifySettlement(client.conn, settleTxSig)
// -> { verified, cpiIntoTxline, ranValidateStat, verdict, resolution, reasons }

// Re-fold a TxLINE proof off-chain (the same Merkle the oracle checks on-chain):
verifyProofMerkle(rawProof) // -> { ok, stats: [{ key, value, foldsToEventRoot }] }
```

Also exports `buildCreateMarketIx`, `buildSettleIx` (from a raw TxLINE proof),
`fetchMarket`/`decodeMarket`, and the PDA derivations.

`npm run example:verify` verifies the two genuine on-chain settlements
(`GENUINE_SETTLEMENTS`) against devnet.
