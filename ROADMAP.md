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

## The real ceiling nobody markets: regulation

The binding constraint on a real-money prediction market is **not tech — it's US
law.** The CFTC treats event-market binary contracts as **swaps that can only be
offered on a registered exchange (DCM/SEF)**; Polymarket was fined **$1.4M**, ordered
to wind down non-compliant markets, and made to **geoblock the US**.⁸ Kalshi thrives
for exactly one reason: it is a **CFTC-Designated Contract Market** — the same
category as CME.⁹ **That regulatory legitimacy, not any DeFi feature, is the biggest
actual threat to this whole category** — and an unregistered on-chain market cannot
replicate it.

Caveat (fast-moving): the CFTC's 2023 disapproval of Kalshi contracts was **vacated**
(2024) and the appeal **dismissed** (2025); Kalshi has been rolling out sports
contracts nationally amid state-by-state fights.¹⁰ So "the CFTC bans sports contracts"
is *not* a safe claim — but the swap/DCM classification and the Polymarket precedent
(unregistered markets can't serve US users) are undisturbed.

**What this means for Fulltime — the three honest paths:**
1. **Play-money / points** (what it is today) — fully legal, global, zero KYC. Best for growth + the hackathon story.
2. **Geoblock the US, real-money elsewhere** — Polymarket's post-2022 model.
3. **CFTC-registered wrapper** (the DCM/QCEX route Polymarket itself pursued for US re-entry) — the only lawful US real-money path, and a heavy lift.

Pick the path *before* building real-money rails — it dictates KYC, geofencing, and entity structure.

## Where leaders are ahead — and the proven fix

| Gap | Leader's answer | What Fulltime adopts |
|---|---|---|
| **Liquidity / cold-start** (many thin sports markets) | Azuro: one **shared singleton LP** every market draws from — liquidity is never bootstrapped per-market² | A shared liquidity pool backing all markets, replacing isolated per-market parimutuel |
| **LP viability** | Paradigm **pm-AMM**: constant-product AMMs make LPs "essentially guaranteed to lose all value at expiration"; pm-AMM is purpose-built for expiring outcome tokens and holds LVR constant to expiry⁴ | pm-AMM pricing per market (MatchWinner/OverUnder) instead of flat parimutuel odds |
| **Onboarding** | Polymarket: **Magic embedded wallet** (email/social login, no seed), Gnosis-Safe account-abstraction, **fully gasless** relayer — users hold only USDC⁵ | Solana embedded-wallet SDK + a **fee-payer relayer** so bettors never touch a seed phrase or SOL for gas |
| **Throughput / product bar** | Betfair: non-risk-bearing pure matching exchange, ~5% commission on *winnings only*, >7M tx/day⁶ | A non-risk-bearing revenue model (commission on winnings, not spread); Solana already clears the latency bar |

## Liquidity mechanism — the choice, revised

The second research pass sharpened this: **serious betting products (Betfair, SX Bet,
BetDEX) converge on peer-to-peer order books, not AMMs** — because outcome-share
prices snap to $0/$1 the instant a match finalizes, and arbitrageurs drain an AMM
pool faster than LPs can pull out.¹¹ For a *fast-settling* World Cup market that's the
core liquidity risk. And the objection "on-chain order books are too costly at scale"
did **not** survive verification — an on-chain/hybrid CLOB is genuinely viable on
Solana. So the two honest paths are:

- **P2P back/lay order book** (Betfair/BetDEX/SX model) — no LPs to drain, non-custodial, USDC-settled; needs matched counterparties (bootstrap with market-maker bots). **Best fit for fast-settling sports.** Notably, **BetDEX (Solana-native) has no oracle — it settles by a manual ops team**, so Fulltime's proof-settlement would *uniquely* beat the only Solana-native exchange on the exact axis it's weakest.
- **Shared singleton LP + pm-AMM** (Azuro/Paradigm) — kills per-market cold-start and is proven for sports, *but* must actively de-risk the finalization drain (Azuro runs risk management; pm-AMM schedules liquidity down to expiry). Simpler UX, riskier economics.

**Recommendation:** a P2P order book with proof-settlement is the differentiated "true product" — it beats Polymarket (trust oracle) *and* BetDEX (no oracle) at once. Keep pm-AMM as the fallback if matching liquidity proves hard.

## Other techniques, ranked

1. **Embedded wallet + Solana-native gasless** — Solana supports fee-payer sponsorship + dual-signature co-sign *natively*, no paymaster stack.¹² *→ email login, USDC-only, zero-SOL UX.*
2. **Chainlink Data Streams for data-source diversity** — a multi-provider DON that signs an aggregated report verified on-chain; turns "trust one TxLINE feed" into "trust an aggregate + signature."¹³ *→ later, settle against a multi-provider signed report, not a single root.*
3. **Non-risk-bearing exchange model** (Betfair) — ~5% commission on winnings only. *→ sustainable fees, house never takes a position.*
4. **Skip ZK coprocessors for this.** Lagrange/Axiom/Brevis prove facts about *on-chain* data only — they **cannot** attest to an off-chain sports score.¹⁴ Don't waste effort here.

## The brutally honest limit

Proof-based web data (zkTLS / TLSNotary) does **not** make the data source trustless.
Per TLSNotary's own June-2026 post: *"A notary is a trusted party… zero-knowledge ≠
trustless… you cannot add that witness after the fact."*⁷ So Fulltime's settle is
**proof that the outcome matches TxLINE's anchored data — not proof that TxLINE's data
is true.** Our edge is real but bounded:

- It holds for **objective, final, on-chain-anchored stats** (scores, goals, corners). It does **not** extend to subjective or long-tail markets ("will X be sacked?"), which structurally need an optimistic-oracle/dispute layer.
- **Mitigation, not elimination:** move TxLINE-style data behind **multi-provider aggregation + signatures** (Chainlink Data Streams style) or **1-of-N staked/slashable attestors**, so a single source can't lie without detection or losing a bond. **The hard ceiling, confirmed:** *no cited technology can cryptographically prove a real-world score is correct — only that the data wasn't tampered with or was correctly aggregated.* Ground truth is irreducibly trusted. Reserve an optimistic-oracle fallback *only* for non-objective markets, and label which is which in the UI. Never claim "trustless data."

## Phased plan

- **Now (hackathon):** lead with the settlement moat; the trust-vs-proof framing is the pitch. Play-money, no risky changes.
- **Phase 0 — decide the legal path FIRST:** play-money-global vs geoblocked-real-money vs CFTC-registered wrapper. It dictates everything downstream (KYC, geofencing, entity).
- **Phase 1 — UX:** Solana-native fee-payer (gasless) + embedded-wallet (email) login. Highest ROI, lowest risk.
- **Phase 2 — liquidity:** a P2P back/lay order book with proof-settlement (beats Polymarket *and* BetDEX simultaneously); market-maker bots to bootstrap matching. pm-AMM + singleton LP as fallback.
- **Phase 3 — trust-minimize the data:** multi-provider signed reports (Chainlink Data Streams) or a Solana-native multi-attestor layer; an optimistic-oracle fallback for non-objective markets, clearly separated from proof-settled ones. (Skip ZK coprocessors — they can't attest off-chain scores.)

---
¹ docs.polymarket.com/concepts/resolution; github.com/Polymarket/uma-ctf-adapter · ² gem.azuro.org (event resolution; singleton LP) · ³ blog.uma.xyz (UMA×Polymarket×EigenLayer next-gen oracle) · ⁴ paradigm.xyz/2024/11/pm-amm · ⁵ docs.magic.link/recipes/embedded-wallets/polymarket · ⁶ arxiv.org/pdf/2105.08310 (Cliff, betting-exchange model) · ⁷ tlsnotary.org/blog/2026/06/17/public-verifiability · ⁸ cftc.gov/PressRoom/PressReleases/8478-22 (Polymarket $1.4M order) · ⁹ help.kalshi.com + cftc.gov/PressRoom/PressReleases/8302-20 (Kalshi DCM designation) · ¹⁰ cftc.gov/PressRoom/PressReleases/8780-23 + D.C. Circuit dismissal 2025 (moving target) · ¹¹ arxiv.org/pdf/2510.15612 (AMM finalization drain) + learn.betdex.com (Monaco Protocol P2P book, manual settlement) · ¹² solana.com/developers/cookbook/transactions/fee-sponsorship; circle.com Gas Station · ¹³ docs.chain.link/data-streams/architecture · ¹⁴ docs.lagrange.dev (ZK coprocessor scope = on-chain data only)
