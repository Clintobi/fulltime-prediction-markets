# Fulltime — from hackathon demo to a true product

This roadmap is backed by primary-source research on how the current leaders
actually work (Polymarket/UMA, Azuro, Paradigm pm-AMM, TLSNotary, Betfair, Magic).
The finding in one line: **every leader resolves outcomes by *trust* (an optimistic
oracle + human disputes + a token vote); Fulltime resolves by *proof*.** The two
places leaders are ahead — liquidity and onboarding — have known, adoptable fixes.

## Where we already lead: settlement

Polymarket routes resolution through UMA's Optimistic Oracle — a $750 bond, a ~2h
challenge window, and, if disputed, a 48–72h $UMA token-holder vote.¹ Azuro resolves
via elected Data Providers with the DAO as "arbiter of last resort."² Even the
acknowledged frontier — the UMA × Polymarket × EigenLayer "next-gen oracle" — is
still *restaking-secured economic security + token voting, not a cryptographic
proof.*³ Fulltime's `settle` derives the outcome from a Merkle proof verified inside
TxLINE's on-chain `validate_stat` — **no bond, no dispute window, no vote, no admin.**
That is structurally ahead of where the incumbent is *heading*.

## Where leaders are ahead — and the proven fix

| Gap | Leader's answer | What Fulltime adopts |
|---|---|---|
| **Liquidity / cold-start** (many thin sports markets) | Azuro: one **shared singleton LP** every market draws from — liquidity is never bootstrapped per-market² | A shared liquidity pool backing all markets, replacing isolated per-market parimutuel |
| **LP viability** | Paradigm **pm-AMM**: constant-product AMMs make LPs "essentially guaranteed to lose all value at expiration"; pm-AMM is purpose-built for expiring outcome tokens and holds LVR constant to expiry⁴ | pm-AMM pricing per market (MatchWinner/OverUnder) instead of flat parimutuel odds |
| **Onboarding** | Polymarket: **Magic embedded wallet** (email/social login, no seed), Gnosis-Safe account-abstraction, **fully gasless** relayer — users hold only USDC⁵ | Solana embedded-wallet SDK + a **fee-payer relayer** so bettors never touch a seed phrase or SOL for gas |
| **Throughput / product bar** | Betfair: non-risk-bearing pure matching exchange, ~5% commission on *winnings only*, >7M tx/day⁶ | A non-risk-bearing revenue model (commission on winnings, not spread); Solana already clears the latency bar |

## Bleeding-edge techniques, ranked (with how Fulltime uses each)

1. **Shared singleton liquidity pool** (Azuro) — kills per-market cold-start; the single highest-ROI change. *→ one vault backs every market.*
2. **pm-AMM pricing** (Paradigm, Nov 2024) — the only AMM designed for expiring prediction outcomes. *→ live odds + continuous trading instead of parimutuel-at-close.*
3. **Embedded wallet + gasless relayer** (Magic/Polymarket pattern) — the "true product" onboarding bar. *→ email login, USDC-only, zero-SOL UX.*
4. **Restaking-secured / multi-attestor oracle** (EigenLayer AVS direction) — reduces single-source trust in the *data*. *→ 1-of-N staked attestors over TxLINE data (see limits).*
5. **Non-risk-bearing exchange model** (Betfair) — commission on winnings. *→ sustainable fee model without the house taking positions.*

## The brutally honest limit

Proof-based web data (zkTLS / TLSNotary) does **not** make the data source trustless.
Per TLSNotary's own June-2026 post: *"A notary is a trusted party… zero-knowledge ≠
trustless… you cannot add that witness after the fact."*⁷ So Fulltime's settle is
**proof that the outcome matches TxLINE's anchored data — not proof that TxLINE's data
is true.** Our edge is real but bounded:

- It holds for **objective, final, on-chain-anchored stats** (scores, goals, corners). It does **not** extend to subjective or long-tail markets ("will X be sacked?"), which structurally need an optimistic-oracle/dispute layer.
- **Mitigation, not elimination:** move TxLINE-style data behind **1-of-N staked/slashable attestors** (or a restaking AVS) so a single source can't lie without losing a bond. Reserve an optimistic-oracle fallback *only* for markets that aren't objectively provable — and label which is which in the UI. Never claim "trustless data."

## Phased plan

- **Now (hackathon):** lead with the settlement moat; the trust-vs-proof framing above is the pitch. No risky mechanism changes pre-deadline.
- **Phase 1:** shared singleton LP + a fee-payer relayer (gasless) + embedded-wallet login.
- **Phase 2:** pm-AMM pricing + continuous trading + cash-out; commission-on-winnings fee model.
- **Phase 3:** multi-attestor / restaking-secured data layer; an optimistic-oracle fallback for non-objective markets, clearly separated from proof-settled ones.

---
¹ docs.polymarket.com/concepts/resolution; github.com/Polymarket/uma-ctf-adapter · ² gem.azuro.org (event resolution; singleton LP) · ³ blog.uma.xyz (UMA×Polymarket×EigenLayer next-gen oracle) · ⁴ paradigm.xyz/2024/11/pm-amm · ⁵ docs.magic.link/recipes/embedded-wallets/polymarket · ⁶ arxiv.org/pdf/2105.08310 (Cliff, betting-exchange model) · ⁷ tlsnotary.org/blog/2026/06/17/public-verifiability
