# Fulltime — World Cup Prediction Markets

**Full-Tournament Auto-Market with On-Chain Settlement**

A decentralized prediction market platform for the **2026 World Cup**, powered by **TxLINE** data streams and cryptographically verified on-chain settlement via **Solana**.

_Submission for the **Prediction Markets and Settlement** track._

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
| `settle` | Resolve the market by CPI to TxLINE's real `validate_stat` (oracle pinned on-chain) — reverts unless the Merkle proof + predicate are cryptographically valid. **No admin override exists.** |
| `claim_winnings` | Pro-rata payout to the winning side from the escrow vault |
| `create_parlay` / `prove_leg` / `claim_parlay` | Multi-leg tickets: each leg proven through the same pinned `validate_stat` CPI; all legs must hit to win |
| `create_offer` / `fill_offer` / `settle_offer` / `claim_offer` | P2P back/lay exchange: maker backs at fixed odds, taker lays, winner decided by the same proof CPI (no house, no AMM) |

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

Two markets **settled from genuine finalized TxLINE proofs** — the outcome is
derived on-chain from TxLINE's `validate_stat` verdict, not supplied by the caller
(`settle` takes no `outcome` argument). See [`VERIFY.md`](./VERIFY.md) for the
inner-CPI logs and full reproduction (including the tamper-reverts path).

| Fixture | Real score | Derived outcome | `settle` tx |
|---|---|---|---|
| 18179549 | 1–0 | **YES** | [`5QZzyp…3Nexy`](https://explorer.solana.com/tx/5QZzypbShX2VJzQuCpRJfUDb5F4oTx7H8v2RxrAh4NJybPnmMkG6PwVk25avgUFbZhneBxfNfE9hdYXmUEZ3Nexy?cluster=devnet) |
| 18193785 | 1–4 | **NO** | [`4TG9BU…n3LJZ`](https://explorer.solana.com/tx/4TG9BU5XCi3hRAPq7wLKJtydFvN7XhCSo86Lp3SGbku4BqUneKBPWmnz1ZVkgY8u4dzc2jys11asrmaWRJRn3LJZ?cluster=devnet) |

A full stake→claim lifecycle (create → deposit → claim) is exercised end-to-end in
`app/ft-demo.mjs`; the trustless `settle` above is the resolution path that matters
for this track.

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
