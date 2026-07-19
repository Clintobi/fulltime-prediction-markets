# Product

## Register

product

## Users

Sports fans, prediction-market participants, analysts, and market operators who
need to understand a market quickly, fund a position, and verify settlement without
trusting an administrator. Their core workflow is fixture discovery → market terms →
deposit or matched position → proof settlement → claim, often under time pressure
and on a mobile screen.

## Product Purpose

Fulltime is a World Cup prediction-market protocol and interface on Solana. It
exists to make the complete market lifecycle legible and independently verifiable:
the contract escrows positions, TxLINE supplies the cryptographic match proof, and
the program settles deterministically while postponed fixtures fail closed into an
explicit void-review state. Success means a first-time user can
follow deposit → settle → claim without separate documentation, while an expert can
inspect the exact proof, transaction, and rule that produced the state.

## Brand Personality

Confident, calm, and human. Fulltime should feel technically serious without feeling
cold, and football-native without adopting casino language. Its voice is direct and
evidence-led: “Settled by proof, not by trust.”

## Anti-references

Not a neon casino, token-price dashboard, anonymous dark exchange, or overdecorated
AI landing page. Avoid degen urgency, fake live states, unsupported return claims,
glassmorphism, cold slate surfaces, purple gradients, emoji controls, and interfaces
that hide settlement or custody boundaries behind generic success badges.

## Design Principles

1. **The market lifecycle is the product.** Always show where the user is between
   deposit, proof availability, settlement, and claim—and what advances the state.
2. **Proof before promise.** Put the TxLINE root, deterministic rule, program state,
   and explorer evidence next to settlement claims.
3. **Separate product state from transport state.** Open, live, postponed, void,
   settled, claimable, and claimed must remain visibly distinct.
4. **Progressive expertise.** A newcomer gets one clear next action; an analyst can
   expand the same object for addresses, sequences, proofs, and transactions.
5. **Honest demo states.** Live, devnet, recorded replay, and simulated examples are
   labeled at the point of use.

## Accessibility & Inclusion

Target WCAG 2.2 AA. All essential state is communicated with text and shape in
addition to color. Keyboard focus is visible, numeric data remains readable at 200%
zoom, reduced-motion preferences disable decorative movement, and mobile actions
retain comfortable targets. Use plain-language explanations for wallet, escrow,
proof, settlement, void, and claim states.
