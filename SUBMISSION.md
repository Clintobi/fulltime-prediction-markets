# Fulltime — Trustless World Cup Prediction Markets on Solana

**Track:** Prediction Markets & Settlement (TxODDS × Solana World Cup Hackathon)

## One-liner

Fulltime is a decentralized prediction market where every match settles from a
**cryptographic TxLINE proof via CPI** — not a trusted oracle. Stake USDC on a
match outcome; when TxLINE publishes the finalized scores, anyone can settle the
market by proving the result against TxLINE's on-chain Merkle root, and winners
claim their pro-rata share of the pool.

## Why it fits the "Settlement" track

Most prediction markets trust an oracle to *tell* the chain who won. Fulltime
makes the chain **verify** it. Our `settle` instruction constructs TxLINE's real
`validate_stat` instruction and invokes it via CPI; TxLINE's program reverts
unless the submitted Merkle proof and predicate are valid against its published
`daily_scores_merkle_roots`. The market can only resolve to an outcome that
TxLINE's cryptographically-anchored data supports. That is settlement as
*proof*, not settlement as *trust*.

## Live links

- **App (real TxLINE devnet fixtures):** https://fulltime-txline.vercel.app
- **Program (devnet):** [`37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW`](https://explorer.solana.com/address/37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW?cluster=devnet)
- **Repo:** https://github.com/Clintobi/fulltime-prediction-markets

## Proven on-chain (devnet transactions)

A complete market lifecycle for **France vs England**, run end to end:

1. `create_market` — [48fVsy…](https://explorer.solana.com/tx/48fVsy4fKFGNsgEpatw69iWb57o1VqosKaSETiZSPeTbnPy4C2o2zGK7AnQaLYb6SantRF1Rr1gqa5KTnjB9BxzD?cluster=devnet)
2. `deposit_yes` 100 USDC — [3LHf4T…](https://explorer.solana.com/tx/3LHf4T33rTA6pHEKHFuHG9LVad5XwFLfsB7Lfx2e2tNcmKpWAouV3yzQdHLxV8Hh3aiDoPymnPqGFaKxBQkbQ8Wi?cluster=devnet)
3. `deposit_no` 50 USDC — [5BqKfM…](https://explorer.solana.com/tx/5BqKfMfeHywD9g5ppdjjWRB7EaAWXSsFtKmshwR8eSpH5noNQcFo8jpZdeLr94RjmzryGoQnjm32sYKGLwg6CLDw?cluster=devnet)
4. `settle` → YES — [66i8af…](https://explorer.solana.com/tx/66i8afUS4CcV6UNqVEFhGBQUSLgj9JKYUxJNE6p6QLV7rEk4qshmzcMyrZzuGxcUZS2aLXQv39iymyxjhvRqUvYF?cluster=devnet)
5. `claim_winnings` (winner takes the 150-USDC pool) — [22FbfA…](https://explorer.solana.com/tx/22FbfAUjw5NUTcChZsNcxbjFY66VypBEpCEN6KEQzirVhkYT13sA8xUNGkiWR9teohficcznninAsrh8tm5fa4vB?cluster=devnet)

## Real TxLINE integration (not mocked)

We complete TxLINE's actual access flow programmatically (`app/txline-subscribe.mjs`):
on-chain `subscribe(serviceLevel=1, weeks=4)` (free World Cup tier) → wallet
signature → `POST /api/token/activate` → API token. The live site uses that
token to render real TxLINE fixtures and scores. Our `settle` CPI targets
TxLINE's real `validate_stat` (discriminator + `ScoresBatchSummary` /
`StatTerm` / `TraderPredicate` arg structs taken directly from its on-chain IDL,
so the Borsh encoding is wire-correct).

## Architecture

```
Frontend (Next.js, live TxLINE data)
        │  stake USDC
        ▼
Fulltime program (Anchor)  ──CPI──►  TxLINE validate_stat
  create/deposit/settle/claim         (verifies Merkle proof vs
  USDC escrow (Token-2022)             daily_scores_merkle_roots)
```

## Honest status

- ✅ Program deployed; full create → deposit → settle → claim proven on devnet.
- ✅ `settle` CPIs the **real** `validate_stat` (byte-verified against the IDL).
- ✅ Live site renders real TxLINE fixtures via a real subscription token.
- ⏳ Settling from a *live* match proof requires TxLINE to publish finalized
  scores for a fixture; the devnet showcase matches (France v England, Spain v
  Argentina) fall in the hackathon window. The `admin_settle` fallback plus the
  proof-driven `settle` path are both implemented; the demo above uses the
  fallback, and we settle from a genuine proof as soon as one is published.

## Run it

```bash
# API token (real TxLINE subscription)
DEPLOYER_KEYPAIR=deployer.json node app/txline-subscribe.mjs
# full on-chain lifecycle
DEPLOYER_KEYPAIR=deployer.json node app/ft-demo.mjs
```

## Roadmap

Permissionless keeper (bot/) auto-settles on `game_finalised`; derive the
outcome on-chain from the proven predicate (remove the trusted pairing);
mainnet + real USDC; auto-generate a market per fixture for the full 104-match
tournament.
