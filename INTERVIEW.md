# Fulltime — interview brief (Prediction Markets & Settlement)

The winners interview live with TxODDS engineers. This is where entries that *look*
similar on paper get separated: the ones with hidden holes get exposed, and the one
with the most rigorous, most verifiable settlement wins. Play to that.

## 30-second pitch

> "Every prediction market has one weak point: settlement — someone has to tell the
> chain who won, and you trust them. Fulltime removes the trust. Our `settle` derives
> the outcome on-chain from TxLINE's own `validate_stat` verdict via CPI. There's no
> admin override — I deleted it. A tampered proof reverts inside the oracle. And you
> don't have to take my word for it: here are two real settlements you can verify, a
> proof-visualizer, and a test suite that runs TxLINE's actual binary."

## The core, in one breath (what `settle` enforces — programs/fulltime/src/lib.rs)

1. **Fixture-bound** — the proof must be for *this* market's fixture.
2. **Roots PDA re-derived in-program** from the proof's own timestamp — you can't pass a fake roots account.
3. **Finality gate** — only full-time (`period == 100`) settles.
4. **Predicate bound to the market's question** — for a MatchWinner market the proof *must* prove `team1 − team2 > 0`, with the stats in that exact order (so you can't swap or smuggle a different proposition).
5. **CPI into the real `validate_stat`**, which reverts on an invalid Merkle proof.
6. **Verdict read from return data** (with a `ret_program == TxLINE` check) → outcome **derived**, not supplied. `settle` takes no `outcome` argument.

## Show, don't tell (have these open)

- **Two genuine settlements** — [`5QZzyp…`](https://explorer.solana.com/tx/5QZzypbShX2VJzQuCpRJfUDb5F4oTx7H8v2RxrAh4NJybPnmMkG6PwVk25avgUFbZhneBxfNfE9hdYXmUEZ3Nexy?cluster=devnet) (1‑0→YES) and [`4TG9BU…`](https://explorer.solana.com/tx/4TG9BU5XCi3hRAPq7wLKJtydFvN7XhCSo86Lp3SGbku4BqUneKBPWmnz1ZVkgY8u4dzc2jys11asrmaWRJRn3LJZ?cluster=devnet) (1‑4→NO). Open the inner instructions: our program → CPI → TxLINE `ValidateStat` → `Program return … AQ==`.
- **/verify** on the live app — reconstructs that trust chain from public state for any settle tx.
- **Hermetic tests** (`tests/hermetic`, `npm test`) — 16 tests running TxLINE's **real** binary in-process; every tamper reverts. Offer to run it on the call.
- **Keeper** (`keeper/`) — permissionless auto-settle. **SDK** (`packages/sdk`) — `verifySettlement()` reproduces the check independently.
- **Live tamper** — `MODE=real TAMPER=1 node app/ft-real-settle.mjs` → reverts inside `validate_stat`.

## Hard questions → crisp answers

- **"Can the owner override settlement?"** No — I removed `admin_settle`; calling its discriminator now returns `InstructionFallbackNotFound`. A market reaches `Settled` only through a valid proof.
- **"What stops me settling with a valid proof for a *different* stat/question?"** The predicate is bound to the market's stored question, including stat *position*. Mismatch → `PredicateMismatch`, before the CPI.
- **"What stops a fake oracle returning `true`?"** The `txline_program` account is **pinned to the canonical oracle address on-chain** (`#[account(address = TXLINE_PROGRAM)]`) — you can't even pass a rubber-stamp program into the slot. The roots account is both re-derived in-program from the proof's timestamp **and** owner-pinned to the real oracle. And as a belt-and-suspenders, the return data's producing program must equal TxLINE (`ret_program` check) or it's `ProofRejected`. Hermetic tests prove a fake oracle and a wrongly-owned roots account both revert.
- **"Do parlays weaken any of that?"** No — a parlay leg is proven through the exact same pinned CPI + gates (a shared `derive_outcome_from_proof` helper). Every leg is settled trustlessly; one miss kills the ticket. Payout is `stake × odds^legs` from a reward vault that losing tickets replenish. Verified on devnet: a winning 2-leg ticket paid exactly `100 × 1.9² = 361`, a wrong prediction went `Lost`.
- **"Is the demo real or mock?"** Real. The txs above CPI the canonical TxLINE program `6pW64…` on devnet; the hermetic suite loads TxLINE's actual on-chain ELF — no mock oracle anywhere.
- **"Who settles in production?"** Anyone. It's permissionless; the keeper automates it but a bettor can self-settle. Funds never sit behind an operator.
- **"Payout safety?"** Pro-rata from frozen pools; the claim ignores any caller-supplied amount (an earlier drain bug — fixed and regression-tested).

## Where rivals are weaker (only if asked to compare — stay factual, name the mechanism, not the team)

- Some entries CPI `validate_stat` but **never read the verdict** — they gate only on the CPI not erroring, and take the winning outcome as an **admin argument**. That's a proof-of-existence, not proof-of-outcome.
- Some read the verdict but **don't bind the proven predicate to the market's question**, so a settler can prove a different-but-true proposition and force the outcome.
- Some prove **fixture membership** but let the **scoreline be an unverified caller input**.
- Some settle against a **mock oracle** on devnet, or bind the score↔proof only **off-chain**.
- Fulltime closes all of these: verdict-read **and** question-bound **and** real-oracle **and** in-program roots derivation. That's the point of the /verify page and the hermetic suite — every claim here is checkable.

## Product surface (open these too)

- **/markets** — browse, create, and bet across all three market types (MatchWinner, OverUnder, ExactScore) on any fixture. All settle through the same proof engine.
- **/parlay** — build a multi-leg ticket; each leg proves trustlessly via `validate_stat`. Two real tickets already on-chain (a win that paid 361, a loss).

## Don't oversell

We went deep on settlement rather than wide on a trading surface. If asked about an
AMM / order book: "Out of scope on purpose — the track is *settlement*, and I made that
unfakeable, pinned, hermetically tested, and extended it to prop markets and parlays.
An AMM is a pricing layer on top; it wouldn't change the settlement guarantees."
