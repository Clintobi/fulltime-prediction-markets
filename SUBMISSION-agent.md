# EdgeBot — Autonomous Odds-Driven Trading Agent

**Track:** Trading Tools and Agents (TxODDS × Solana World Cup Hackathon)
**Code:** [`app/ft-agent.mjs`](app/ft-agent.mjs) · runs against the deployed Fulltime program

## One-liner

EdgeBot ingests TxODDS/TxLINE live odds, computes each side's fair win
probability, compares it to the **on-chain market's pool-implied price**, and
**autonomously stakes USDC on the mispriced (+EV) side** — no manual input.
It re-evaluates in a loop and stops when the market has converged to fair value.

## Signal → decision → execution

1. **Ingest:** pull TxLINE odds (`/api/odds/stream` live, `/odds/snapshot`
   fallback) — the `TXLineStablePriceDemargined` book gives fair implied
   probabilities directly (`Pct`).
2. **Fair price:** renormalize the 1X2 to a two-way, e.g. `P(Spain) = 61.5%`.
3. **Market price:** read the on-chain market account; `YES price = yes /
   (yes + no)`.
4. **Edge:** `edge = fair − marketPrice`. If `|edge| > 3%`, stake on the
   underpriced side, sized ∝ edge (capped). Otherwise **HOLD** (market efficient).
5. **Execute:** submit a `deposit_yes`/`deposit_no` transaction. Repeat.

Fully autonomous — the only inputs are the live odds and on-chain state.

## Live demo (devnet)

A noise trader mispriced a Spain-vs-Argentina market to **YES=20%** while TxLINE's
fair price was **61.5%**. EdgeBot corrected it over 6 rounds, sizing each bet to
the shrinking edge:

| round | fair | market YES | edge | action |
|---|---|---|---|---|
| 1 | 61.5% | 20.0% | +41.5% | BUY Spain 40 USDC |
| 2 | 61.5% | 42.9% | +18.7% | BUY 18.7 |
| 3 | 61.5% | 49.6% | +11.9% | BUY 11.9 |
| 4 | 61.5% | 53.1% | +8.4% | BUY 8.4 |
| 5 | 61.5% | 55.3% | +6.2% | BUY 6.2 |
| 6 | 61.5% | 56.8% | +4.7% | BUY 4.7 → 57.9% |

Market: [`EEkYJFPHgRUPRYH6Z6BwDwZkLwffRiMnTckTPXRp4bGT`](https://explorer.solana.com/address/EEkYJFPHgRUPRYH6Z6BwDwZkLwffRiMnTckTPXRp4bGT?cluster=devnet) · a sample execution: [`3rZoUE…`](https://explorer.solana.com/tx/3rZoUEU3r7GDjYjvzC737fxWVmbS22r8H8oYrcuTVJuhLSKc11GhAYoXjsha7HZQTGpXgTCj1q4rTZ59RQBYB8Lz?cluster=devnet)

## Run it

```bash
DEPLOYER_KEYPAIR=deployer.json CREDS=txline-creds.json node app/ft-agent.mjs
```

## During real matches

Pre-match odds are sparse; **during a live match the agent consumes TxLINE's
continuous odds stream** and re-prices every tick — reacting to goals in
real time. The `LIVE` tag in the logs shows when odds are pulled live vs. the
last-observed cache.

## Roadmap

Two-sided market making (quote both sides, capture spread); exit logic
(sell before settlement on edge reversal); Kelly sizing from bankroll; run as a
persistent service; integrate TxLINE's native on-chain trading instructions
(`create_trade` / `validate_odds` / `settle_trade`).
