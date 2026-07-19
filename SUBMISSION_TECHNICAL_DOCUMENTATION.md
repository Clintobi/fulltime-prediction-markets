# Fulltime — Submission Technical Documentation

## 1. Product and technical thesis

Fulltime is a devnet prediction-market tool for World Cup outcomes. Participants deposit Token-2022 test-USDC into a program-owned vault; after a match, any actor may submit TxLINE’s finalized `stat-validation` proof. Fulltime invokes TxLINE’s canonical on-chain program and derives the outcome from its return value. No operator account, admin instruction, or caller-supplied boolean can decide the winner.

The system separates three concerns:

1. **Data availability:** TxLINE REST snapshots and SSE power the live product and keeper.
2. **Truth verification:** TxLINE’s daily-score Merkle root and `validate_stat` program prove the asserted statistic.
3. **Economic execution:** Fulltime escrows deposits, records resolution, and distributes the vault pro rata.

## 2. User journey

1. A user connects a Solana devnet wallet.
2. The server-side demo faucet supplies valueless test-USDC without requiring the user to hold SOL for that step.
3. The user chooses YES or NO and deposits; the vault and both pool totals are visible on-chain.
4. Once TxLINE publishes a final period-100 proof, the user or keeper submits `settle`.
5. Fulltime binds the proof to the market, CPIs into TxLINE, and records the returned verdict.
6. A winning depositor calls `claim_winnings`; payout is calculated from their share of the winning pool and total vault.

The UI exposes this as one five-step lifecycle and shows the next valid action rather than presenting unrelated transaction buttons.

## 3. On-chain settlement invariants

The public Fulltime devnet program is `37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW`. Its `settle` path enforces:

- the market is open;
- the proof fixture equals the market fixture;
- the top-level timestamp equals the proven snapshot timestamp;
- both statistics are full-time (`period == 100`);
- stat keys, operation, comparison, and threshold equal the market’s stored question;
- the daily roots PDA is derived from the proof timestamp;
- the roots account is owned by TxLINE;
- the invoked program equals the canonical public TxLINE address `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`;
- return data was produced by that same program and contains a valid boolean verdict.

There is no `admin_settle`. A failed CPI atomically reverts, leaving the market open.

## 4. TxLINE integration

The live application uses:

- `POST /auth/guest/start` for a short-lived JWT;
- `GET /api/fixtures/snapshot` for normalized fixtures;
- `GET /api/scores/snapshot/{fixtureId}` for current and final score records;
- `GET /api/scores/stream` for live SSE updates;
- `GET /api/scores/historical/{fixtureId}` for match timelines;
- `GET /api/scores/stat-validation?fixtureId=…&seq=…&statKeys=…` for settlement proofs;
- the TxLINE `validate_stat` instruction by Solana CPI for the authoritative verdict.

The Next.js route `/api/txline/[...path]` is an allow-listed server proxy. It performs the guest handshake and attaches `TXLINE_API_TOKEN`; neither credential is serialized into client JavaScript. Streams are forwarded as `text/event-stream` without transformation.

## 5. Persistent keeper and exception policy

`keeper/keeper.mjs` scans open program accounts, polls the relevant TxLINE score data, classifies each result, and submits settlement when a valid final proof is available. It is permissionless: its key pays fees but has no settlement privilege.

`keeper/policy.mjs` is pure and replayable. It fails closed:

- **pending:** no finalized period-100 result, so no transaction;
- **malformed:** missing/invalid fields or fixture mismatch, logged and rejected;
- **void-review:** postponed/cancelled/abandoned status, explicitly withheld for a future governed refund path;
- **final:** only this state proceeds to proof retrieval and transaction construction.

This submission does not claim automatic refunds for postponed events. The current program correctly refuses unsafe settlement; a dedicated on-chain void/refund instruction is future work.

## 6. Reproducibility and tests

Run from the repository root:

```bash
npm run judge:verify
```

The command requires Node.js 20+ and network access only for the one-time npm dependency install. The verification itself is local and credential-free. It runs the actual compiled SBF programs inside LiteSVM rather than mocking their success:

- genuine TxLINE YES and NO proofs;
- real Token-2022 mint/account/vault setup and deposit execution;
- tampered goal/stat/Merkle-node rejection;
- wrong fixture, roots owner/PDA, period, predicate, and fake oracle rejection;
- payout and replay determinism;
- postponed, malformed, and wrong-fixture keeper classification.

For a fully isolated execution after image build:

```bash
docker compose build
docker compose run --rm judge
```

Compose disables runtime networking. No private key, wallet, SOL, token, RPC, validator, or TxLINE account is used.

## 7. Security controls

- TxLINE token and faucet authority exist only as Vercel Sensitive server variables.
- The former disposable devnet mint authority was rotated on-chain; the historic key no longer controls the mint.
- The faucet route can only create the configured Token-2022 ATA and mint a fixed amount of valueless demo tokens.
- The gas relayer, when enabled, checks the fee payer and allow-lists every instruction program before signing.
- `.env*`, credential/keypair JSON, JSONL ledgers, build artifacts, and OS metadata are excluded from git.
- All program, market, mint, and oracle strings documented in the README are intentionally public devnet addresses.

## 8. Production posture and limitations

The strict Next.js production build includes TypeScript and lint checking. The UI, proxy, proof verifier, on-chain program, and keeper are separate deterministic boundaries. Structured keeper logs identify why a market was or was not settled.

Before mainnet use, a professional operator should add authenticated/rate-limited faucet access, dedicated RPCs with failover, metrics/alerts for SSE and keeper lag, a formally specified void/refund instruction, external program audit, geographic/legal controls, and real stablecoin risk limits. This hackathon build deliberately uses valueless devnet assets.

## 9. Public access

- App: https://fulltime-txline.vercel.app
- Repo: https://github.com/Clintobi/fulltime-prediction-markets
- Program: https://explorer.solana.com/address/37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW?cluster=devnet
- On-chain proof evidence: [`VERIFY.md`](./VERIFY.md)
