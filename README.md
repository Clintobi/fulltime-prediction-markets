# Fulltime — World Cup Prediction Markets

**Full-Tournament Auto-Market with On-Chain Settlement**

A decentralized prediction market platform for the **2026 World Cup** (104 matches), powered by **TxLINE** data streams and cryptographically verified on-chain settlement via **Solana**.

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
| `create_market` | Initialize a prediction market for a fixture |
| `deposit_yes` | Stake USDC on "Yes" outcome (e.g., Team A wins) |
| `deposit_no` | Stake USDC on "No" outcome (e.g., Team B wins) |
| `settle_market` | Resolve market via CPI to TxLINE's `validateStatV2` |
| `claim_winnings` | Withdraw USDC after settlement |

### CPI Integration

The core innovation is the CPI call to TxLINE's `validateStatV2` instruction:

```rust
invoke(
    &build_validate_stat_v2_ix(
        &txline_program.key(),
        &daily_scores.key(),
        &proof,
    ),
    &[daily_scores.to_account_info()],
)?;
```

This proves the match outcome cryptographically — no oracle, no trusted third party.

## Keeper Bot

The `bot/` directory contains an autonomous keeper that:

1. Connects to TxLINE's SSE scores stream
2. Detects `action=game_finalised` events (statusId=100, period=100)
3. Fetches the Merkle proof from `/api/scores/stat-validation`
4. Calls `settle_market` on-chain

Run it:

```bash
BOT_WALLET_SECRET_KEY=<base64-encoded-key> \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
npm start
```

## Submission

### Demo Video

See `demo/` for screen recording assets. The demo covers:

1. **App walkthrough** — browsing 104 World Cup matches with real-time scores
2. **Making predictions** — connecting wallet, staking USDC on match outcomes
3. **TxLINE integration** — SSE score streaming, proof fetching
4. **On-chain settlement** — CPI validation, Merkle proof verification, payout

### Deployed Build

- **Frontend**: `https://fulltime-txline.vercel.app`
- **Devnet Program**: `37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW`
- **TxLINE Program**: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`

### Technical Highlights

- **Full 104-match tournament coverage** with auto-generated markets
- **Real-time SSE score streaming** from TxLINE
- **Cryptographically verified settlement** via Solana CPI to `validateStatV2`
- **USDC-based** staking (no TxL token required for users)
- **Permissionless keeper** — anyone can trigger settlement
- **Merkle proof receipts** — every settlement is auditable

## License

Apache-2.0
