# Fulltime — World Cup Prediction Markets

**Full-Tournament Auto-Market with On-Chain Settlement**

A decentralized prediction market platform for the **2026 World Cup**, powered by **TxLINE** data streams and cryptographically verified on-chain settlement via **Solana**.

## Three products, one TxLINE core

All three share the same TxLINE integration (on-chain subscribe → API token → fixtures / scores / odds / proofs):

| Track | Product | Where |
|---|---|---|
| **Prediction Markets & Settlement** | On-chain markets settling via a real `validate_stat` CPI | [`SUBMISSION.md`](SUBMISSION.md) · [live](https://fulltime-txline.vercel.app) |
| **Trading Tools & Agents** | **EdgeBot** — autonomous odds-driven trading agent | [`SUBMISSION-agent.md`](SUBMISSION-agent.md) · [`app/ft-agent.mjs`](app/ft-agent.mjs) |
| **Consumer & Fan Experiences** | **Fan Zone** — live match center + prediction game | [`SUBMISSION-fan.md`](SUBMISSION-fan.md) · [live](https://fulltime-txline.vercel.app/live) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Fixtures  │  │ Markets  │  │ Wallet   │  │ Live       │ │
│  │ & Scores  │  │ & Bets   │  │ Connect  │  │ Scores     │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │ (SSE)      │ │
│       │              │             │        └────────────┘ │
└───────┼──────────────┼─────────────┼────────────────────────┘
        │              │             │
        ▼              ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                    TxLINE API Layer                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Fixtures │  │ Scores +     │  │ Stat Validation       │ │
│  │ REST     │  │ SSE Stream   │  │ Proofs (REST)         │ │
│  └──────────┘  └──────────────┘  └───────────┬───────────┘ │
└───────────────────────────────────────────────┼─────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Solana On-Chain                           │
│  ┌────────────────┐  ┌───────────────────────────────────┐  │
│  │ Fulltime       │  │ TxLINE Oracle Program             │  │
│  │ Market Escrow  │──▶ validateStatV2 (CPI)              │  │
│  │ USDC Vaults    │  │ Merkle Proof Verification         │  │
│  └────────────────┘  └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- Solana CLI + Anchor Framework
- A devnet wallet with SOL

### 1. Clone & Install

```bash
git clone <repo-url> fulltime
cd fulltime

# Frontend
cd app
npm install
cp .env.example .env.local
npm run dev

# Bot (separate terminal)
cd bot
npm install
BOT_WALLET_SECRET_KEY=<base64-key> npm start
```

### 2. Deploy the Anchor Program

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### 3. Subscribe to TxLINE Free Tier

```bash
anchor run subscribe
```

## TxLINE Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /api/fixtures/snapshot` | Fetch World Cup match schedule (104 fixtures) |
| `GET /api/scores/snapshot/{fixtureId}` | Latest score state for a match |
| `GET /api/scores/historical/{fixtureId}` | Full score timeline for settled matches |
| `GET /api/scores/stream` | Real-time SSE stream of score updates |
| `GET /api/odds/stream` | Real-time SSE stream of odds updates |
| `GET /api/scores/stat-validation` | Cryptographically signed Merkle proof for settlement |

## Smart Contract

The `fulltime` Anchor program (`programs/fulltime/src/lib.rs`) implements:

### Instructions

| Instruction | Description |
|---|---|
| `create_market` | Initialize a prediction market (PDA) for a fixture + market type |
| `deposit_yes` / `deposit_no` | Stake USDC (Token-2022) into the market's escrow vault |
| `settle` | Resolve the market by CPI to TxLINE's real `validate_stat` — reverts unless the Merkle proof + predicate are cryptographically valid |
| `admin_settle` | Authority-only fallback resolution (used before a fixture has a finalized proof) |
| `claim_winnings` | Pro-rata payout to the winning side from the escrow vault |

### CPI Integration — the core

`settle` builds TxLINE's actual `validate_stat` instruction (discriminator
`[107,197,232,90,191,136,105,185]` from its on-chain IDL) and invokes it. The
`ValidateStatArgs` Rust structs mirror TxLINE's IDL exactly, so the Borsh bytes
are wire-compatible:

```rust
let mut data = Vec::with_capacity(1024);
data.extend_from_slice(&VALIDATE_STAT_DISCRIMINATOR);
args.serialize(&mut data)?;            // ScoresBatchSummary, StatTerm, TraderPredicate…
invoke(&Instruction { program_id: txline_program.key(), accounts, data }, &account_infos)?;
// TxLINE reverts here if the proof is invalid or the predicate is false.
```

A market for "France wins" is settled by proving `home_goals - away_goals > 0`
against TxLINE's daily-scores Merkle root — no oracle, no trusted third party.
If TxLINE accepts the proof, the outcome is cryptographically true.

## Live Demo (all on Solana devnet)

Full market lifecycle, executed on-chain (`app/ft-demo.mjs`):

| Step | Transaction |
|---|---|
| create_market (France YES / England NO) | [`48fVsy…`](https://explorer.solana.com/tx/48fVsy4fKFGNsgEpatw69iWb57o1VqosKaSETiZSPeTbnPy4C2o2zGK7AnQaLYb6SantRF1Rr1gqa5KTnjB9BxzD?cluster=devnet) |
| deposit_yes (100 USDC) | [`3LHf4T…`](https://explorer.solana.com/tx/3LHf4T33rTA6pHEKHFuHG9LVad5XwFLfsB7Lfx2e2tNcmKpWAouV3yzQdHLxV8Hh3aiDoPymnPqGFaKxBQkbQ8Wi?cluster=devnet) |
| deposit_no (50 USDC) | [`5BqKfM…`](https://explorer.solana.com/tx/5BqKfMfeHywD9g5ppdjjWRB7EaAWXSsFtKmshwR8eSpH5noNQcFo8jpZdeLr94RjmzryGoQnjm32sYKGLwg6CLDw?cluster=devnet) |
| settle → YES | [`66i8af…`](https://explorer.solana.com/tx/66i8afUS4CcV6UNqVEFhGBQUSLgj9JKYUxJNE6p6QLV7rEk4qshmzcMyrZzuGxcUZS2aLXQv39iymyxjhvRqUvYF?cluster=devnet) |
| claim_winnings (winner takes the 150 pool) | [`22FbfA…`](https://explorer.solana.com/tx/22FbfAUjw5NUTcChZsNcxbjFY66VypBEpCEN6KEQzirVhkYT13sA8xUNGkiWR9teohficcznninAsrh8tm5fa4vB?cluster=devnet) |

Market PDA `23XyHTV3FWKqVCYptp18jCcZNW3rHdkUvTpN5HJY2SvH` · test USDC mint `8NkH4t1TCXft5m5bvjNHGfjV1N7aG2BfWG6vzKKP8BjD`.

## TxLINE data integration

`app/txline-subscribe.mjs` performs the real access flow: on-chain
`subscribe(serviceLevel=1, weeks=4)` to TxLINE (free World Cup tier) → sign →
`POST /api/token/activate` → API token. The live frontend uses that token to
render real TxLINE fixtures and scores (`app/src/lib/txline.ts`).

## Deployed Build

- **Frontend**: https://fulltime-txline.vercel.app
- **Devnet Program**: `37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW`
- **TxLINE Program**: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`

### Redeploy

CI (`.github/workflows/deploy-devnet.yml`, manual dispatch) builds with
`cargo build-sbf` and deploys with a pre-funded devnet wallet — no CI airdrop
dependency. Pinned to Rust 1.75 / lockfile v3 to match Solana 1.18.26
platform-tools.

## License

Apache-2.0
