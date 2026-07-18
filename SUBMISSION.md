# Fulltime — Trustless World Cup Prediction Markets on Solana

**Track:** Prediction Markets & Settlement (TxODDS × Solana World Cup Hackathon)

## One-liner

Fulltime is a decentralized prediction market where every match settles from a
**cryptographic TxLINE proof via CPI** — not a trusted oracle, not an admin. Stake
USDC on a match outcome; when TxLINE publishes the finalized scores, **anyone** can
settle the market by proving the result against TxLINE's on-chain Merkle root, and
winners claim their pro-rata share of the pool.

## Why it fits the "Settlement" track

Most prediction markets trust an oracle (or an admin) to *tell* the chain who won.
Fulltime makes the chain **verify** it. Our `settle` instruction:

1. **Binds the proof to this market's fixture** — you can't settle with another match's proof.
2. **Re-derives TxLINE's `daily_scores_roots` PDA from the proof's own timestamp** and requires the passed account to match — a caller can't substitute a fake roots account.
3. **Requires full-time finality** (`period == 100`) — no settling on an in-play score.
4. **Constrains the proven predicate to the market's canonical question** — for a MatchWinner market the proof *must* prove `team1_goals − team2_goals > 0`; you can only prove the thing this market actually asks.
5. **CPIs into TxLINE's real `validate_stat`**, which reverts if the Merkle proof is invalid.
6. **Reads the returned verdict** (`get_return_data`, with a `ret_program == TxLINE` check) and **derives** the outcome — `settle` takes **no `outcome` argument**.

That is settlement as *proof*, not settlement as *trust*. (Program: `programs/fulltime/src/lib.rs`.)

## Proven on-chain — real TxLINE-derived settlement (devnet)

Two markets settled from **genuine finalized TxLINE proofs**. The scoreline came
from TxLINE's own on-chain `validate_stat`; our program only read the verdict.

| Fixture | Real score | Derived outcome | Settle tx |
|---|---|---|---|
| 18179549 | 1–0 | **YES** | [`5QZzyp…3Nexy`](https://explorer.solana.com/tx/5QZzypbShX2VJzQuCpRJfUDb5F4oTx7H8v2RxrAh4NJybPnmMkG6PwVk25avgUFbZhneBxfNfE9hdYXmUEZ3Nexy?cluster=devnet) |
| 18193785 | 1–4 | **NO** | [`4TG9BU…n3LJZ`](https://explorer.solana.com/tx/4TG9BU5XCi3hRAPq7wLKJtydFvN7XhCSo86Lp3SGbku4BqUneKBPWmnz1ZVkgY8u4dzc2jys11asrmaWRJRn3LJZ?cluster=devnet) |

The inner-CPI logs of the first tx (abridged) — TxLINE, not us, decides:

```
Program 37Gju…9vTW invoke [1]   Instruction: Settle
  Program 6pW64…wyP2J invoke [2]   Instruction: ValidateStat
    Find valid on-chain root for interval 43
    Perform fixture-level validation … Pass fixture-level validation
    Perform two-stat predicate validation
    Evaluate predicate to: true
  Program return: 6pW64…wyP2J AQ==     # 0x01 = true
Program 37Gju…9vTW success
```

Two different real scorelines → two different **derived** outcomes, from a settle
instruction that can't be told the answer. Full reproduction steps and the
tamper-reverts (fraud) path are in [`VERIFY.md`](./VERIFY.md).

- **App (real TxLINE devnet fixtures):** https://fulltime-txline.vercel.app
- **Program (devnet):** [`37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW`](https://explorer.solana.com/address/37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW?cluster=devnet)
- **Repo:** https://github.com/Clintobi/fulltime-prediction-markets

## The fraud path reverts

Corrupt any goal value in the proof and the tampered leaf no longer hashes to
TxLINE's anchored root, so `validate_stat` reverts **inside the CPI** and the
market stays open (`MODE=real TAMPER=1 node app/ft-real-settle.mjs`). You cannot
settle to a result TxLINE's data doesn't support.

## Beyond win/lose: parametric prop markets

The same predicate engine settles props, not just match winners — `MarketType`
includes `OverUnder` (e.g. *total goals over 2.5*) and `ExactScore`. Because
`validate_stat` proves an arbitrary `stat_a [op stat_b] comparison threshold`,
markets like "corners > 10" or "shots on target ≥ 5" settle the same trustless
way, with the predicate bound on-chain to the market's stored question.

## Real TxLINE integration (not mocked)

We complete TxLINE's actual access flow programmatically
(`app/txline-subscribe.mjs`): on-chain `subscribe(serviceLevel=1, weeks=4)` (free
World Cup tier) → wallet signature → `POST /api/token/activate` → API token. The
live site uses that token to render real TxLINE fixtures and scores. The
`ValidateStatArgs` / `ScoresBatchSummary` / `StatTerm` / `TraderPredicate` structs
mirror TxLINE's on-chain IDL exactly, so the Borsh encoding is wire-correct — as
the passing devnet CPIs above prove.

## Architecture

```
Frontend (Next.js, live TxLINE data)
        │  stake USDC (Token-2022 escrow)
        ▼
Fulltime program (Anchor)  ──CPI──►  TxLINE validate_stat
  create / deposit / settle / claim    (verifies Merkle proof vs
  pro-rata pooled payout                daily_scores_merkle_roots,
                                        returns the verdict)
```

## Honest status

- ✅ Program deployed on devnet; two markets **settled from genuine TxLINE proofs**, outcome derived on-chain (txs above).
- ✅ `settle` CPIs the **real** `validate_stat` (byte-verified against the IDL) and **binds the proven predicate to each market's question** on-chain — the proof settles the exact thing the market asks, not merely "a" valid proof.
- ✅ Live site renders real TxLINE fixtures via a real subscription token.
- ⚠️ The program also ships an `admin_settle` **emergency fallback** (market-authority only, usable only while a market is still Open, and it can never override a proof-settled market). It exists for the contingency where TxLINE has not yet finalized a proof for a fixture. **It is not used in any settlement shown here** — every result above is a genuine `validate_stat` CPI. For mainnet it would be removed or placed behind a timelock that only activates if no proof appears within a set window.

## Run it

```bash
# real TxLINE subscription token
DEPLOYER_KEYPAIR=~/fulltime-keys/deployer.json node app/txline-subscribe.mjs
# settle a finished fixture from a REAL proof (verifies derived outcome == real result)
CREDS=~/fulltime-keys/txline-creds.json DEPLOYER_KEYPAIR=~/fulltime-keys/deployer.json \
  MODE=real FIXTURE=<finished-fixture-id> node app/ft-real-settle.mjs
```

## TxLINE endpoints used

- `POST /auth/guest/start` — guest JWT.
- On-chain `subscribe(serviceLevel=1, weeks=4)` + `POST /api/token/activate` — API token (`app/txline-subscribe.mjs`).
- `GET /api/fixtures/snapshot` — World Cup fixtures.
- `GET /api/scores/snapshot/{id}` · `GET /api/scores/stat-validation` — scores + the Merkle settlement proof consumed by the on-chain `validate_stat` CPI.
- CPI into TxLINE's on-chain `validate_stat` for trustless settlement.

## TxLINE API feedback

**Liked:** one normalised JSON schema across fixtures/scores/odds made integration
fast; the on-chain `validate_stat` primitive is a genuinely novel settlement
mechanism — being able to CPI into it and have the runtime reject an invalid proof
is exactly what a trustless market needs; the demargined odds book returns clean
implied probabilities. **Friction:** data access requires an on-chain subscribe +
`/api/token/activate` handshake before the API returns anything (403 "Missing API
token" until then — not obvious from a first read); the `validate_stat` argument
layout had to be reverse-engineered from the on-chain IDL — a copy-pasteable CPI
example in the docs would have saved hours; pre-match snapshots are transient, so
clients must cache and lean on the SSE stream.

## Roadmap

Permissionless keeper auto-settles every market on `game_finalised`; remove the
`admin_settle` fallback for mainnet; auto-generate a market per fixture for all 104
matches; mainnet + real USDC.
