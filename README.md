# Fulltime — settled by proof, not trust

**A permissionless World Cup prediction market where TxLINE’s cryptographic result—not an admin—decides who gets paid.**

[Live devnet app](https://fulltime-txline.vercel.app) · [Independent verification guide](./VERIFY.md) · [Technical documentation](./SUBMISSION_TECHNICAL_DOCUMENTATION.md) · [4-minute demo script](./DEMO_SCRIPT_4_MINUTES.md)

Fulltime turns a TxLINE result into an enforceable Solana settlement. A participant deposits test-USDC into a Token-2022 escrow, anyone submits the final TxLINE Merkle proof, the program CPIs into TxLINE’s canonical `validate_stat`, and the winner claims a pro-rata payout. The `settle` instruction accepts **no outcome argument** and there is **no admin-settle escape hatch**.

## What is genuinely different

- **Proof chooses the winner.** The market pins TxLINE’s public program address, verifies the daily-roots PDA and fixture, requires full-time period `100`, constrains the exact predicate, then reads TxLINE’s CPI return value.
- **Credential-free binary verification.** One command executes the compiled Fulltime and genuine TxLINE programs in-process against recorded roots and proofs. A judge needs no wallet, SOL, validator, API account, or environment variables.
- **Permissionless, fail-closed operations.** The keeper may submit settlement, but cannot choose it. Malformed, wrong-fixture, non-final, and postponed feeds are logged and refused; postponed events enter explicit `void-review` rather than being guessed.
- **Trustless surfaces share one proof engine.** Pooled YES/NO markets, multi-leg parlays, and P2P back/lay offers all settle through the same pinned validation path.
- **Zero-SOL judge UX without exposed keys.** The public devnet faucet is signed by a narrowly scoped server route. TxLINE credentials and the rotated disposable mint authority never enter the browser bundle.

## For judges — zero setup

From a clean checkout:

```bash
npm run judge:verify
```

This installs only the hermetic verifier dependencies, then runs:

- **19 program tests** against the compiled Fulltime and TxLINE SBF binaries, including a real Token-2022 deposit, genuine YES and NO proofs, tampered data, fake oracle, wrong roots/fixture/predicate, and non-final-period rejection;
- **4 keeper policy tests** covering deterministic replay, postponed/void-review, malformed feeds, and wrong fixtures;
- **6 evidence checks** confirming the canonical public IDs and recorded proof artifacts.

Expected final line: `PASS — Fulltime is independently reproducible.` The command does not contact TxLINE or Solana and uses no wallet, fees, tokens, RPC, validator, or third-party account.

Containerized equivalent:

```bash
docker compose build
docker compose run --rm judge
```

The container is deliberately run with `network_mode: none`; verification still passes from the proof bundle embedded in the image.

## Product flow

```text
Connect wallet → Get test-USDC → Deposit YES/NO
       → TxLINE publishes a final proof → Anyone settles
       → TxLINE CPI returns the verdict → Winner claims
```

The `/bet` page makes this lifecycle explicit, shows the current next action, links the canonical oracle, and explains what the program rejects. Test-USDC is a valueless devnet asset; a personal wallet balance is not required for the verifier.

## Proven on devnet

Two markets were settled from genuine finalized TxLINE proofs. The caller could not supply the outcome.

| Fixture | TxLINE score | Derived outcome | Proof-settle transaction |
|---|---:|---:|---|
| `18179549` | 1–0 | YES | [5QZzyp…3Nexy](https://explorer.solana.com/tx/5QZzypbShX2VJzQuCpRJfUDb5F4oTx7H8v2RxrAh4NJybPnmMkG6PwVk25avgUFbZhneBxfNfE9hdYXmUEZ3Nexy?cluster=devnet) |
| `18193785` | 1–4 | NO | [4TG9BU…n3LJZ](https://explorer.solana.com/tx/4TG9BU5XCi3hRAPq7wLKJtydFvN7XhCSo86Lp3SGbku4BqUneKBPWmnz1ZVkgY8u4dzc2jys11asrmaWRJRn3LJZ?cluster=devnet) |

The first transaction’s inner logs show Fulltime invoking TxLINE `ValidateStat`, TxLINE validating the fixture and two-stat predicate, and returning `0x01`. Altering a goal or Merkle node causes the CPI to revert and leaves the market open.

## TxLINE is a live input

The deployed app reads fixtures and scores through a server-side credential boundary and exposes TxLINE’s score SSE to the UI. The permissionless keeper independently monitors final score snapshots and fetches `stat-validation` proofs before submitting settlement.

| TxLINE integration | Use |
|---|---|
| `POST /auth/guest/start` | Short-lived server-side guest session |
| `GET /api/fixtures/snapshot` | Normalized World Cup fixture surface |
| `GET /api/scores/snapshot/{fixtureId}` | Current/final score state |
| `GET /api/scores/stream` | Live SSE score updates |
| `GET /api/scores/historical/{fixtureId}` | Recorded match timeline |
| `GET /api/scores/stat-validation` | Merkle proof consumed by settlement |
| TxLINE `validate_stat` CPI | On-chain proof verification and verdict |

TxLINE credentials remain server-side. Recorded proofs exist only so reviewers can reproduce the verification after matches and hackathon access end; they do not replace the live ingestion path.

## Architecture

```text
TxLINE fixtures / scores / SSE ──► Next.js credential proxy ──► live UI
                    │
                    └── final stat proof ──► permissionless keeper/user
                                                    │
Wallet ── deposit ──► Fulltime escrow program ◄──── settle
                              │ CPI
                              ▼
                   canonical TxLINE validate_stat
                              │ verdict
                              ▼
                        pro-rata claim
```

The program is deterministic Anchor/Rust; clients are Next.js/TypeScript; the keeper policy is a pure, replay-tested module. See [technical documentation](./SUBMISSION_TECHNICAL_DOCUMENTATION.md) for account layout, threat model, failure handling, commands, and known limitations.

## Public devnet identifiers

These are intentionally public addresses, not credentials:

- Fulltime program: [`37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW`](https://explorer.solana.com/address/37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW?cluster=devnet)
- Canonical TxLINE program: [`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`](https://explorer.solana.com/address/6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J?cluster=devnet)
- Demo market: [`BSXueEwJmmvbK8YSgiHGRiGvpg2sQN1LdGnHE7nDbgDo`](https://explorer.solana.com/address/BSXueEwJmmvbK8YSgiHGRiGvpg2sQN1LdGnHE7nDbgDo?cluster=devnet)
- Demo Token-2022 mint: [`AyHtMS7AfSTPpEV9gtiGrzigPZXKXLSm9piVF48ETttQ`](https://explorer.solana.com/address/AyHtMS7AfSTPpEV9gtiGrzigPZXKXLSm9piVF48ETttQ?cluster=devnet)

## TxLINE developer feedback

The normalized fixture/score schema made it unusually easy to reuse the same market logic across competitions. The standout primitive is `validate_stat`: an application can enforce the result through CPI instead of trusting a conventional oracle callback. The main friction was the subscription→activation→guest-JWT sequence and reconstructing the precise `ValidateStatArgs` Borsh layout from the IDL. A maintained TypeScript/Rust CPI example, explicit final-period constants, and documented postponed/void semantics would shorten integration time considerably.

## Repository map

- `programs/fulltime/` — deployed Anchor program and settlement constraints
- `app/` — public Next.js product and server credential boundary
- `keeper/` — permissionless final-score monitor and fail-closed policy
- `tests/hermetic/` — SBF binaries, proof fixtures, and adversarial replay suite
- `packages/sdk/` — independent settlement verification helpers
- `VERIFY.md` — explorer-backed proof reproduction

Apache-2.0. Fulltime is a tool operated and submitted by Clinton; it is not an autonomous entrant or legal entity.
