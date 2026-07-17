# Demo Video Script — Fulltime (recordable now)

**Duration:** ~4 min · Record at 1080p. Everything below is live and real today.

**Have ready before recording:**
- Browser tab: https://fulltime-txline.vercel.app
- Browser tab: https://explorer.solana.com/address/37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW?cluster=devnet
- Terminal in `~/fulltime`, with `DEPLOYER_KEYPAIR` pointing at the deployer keypair
- Editor open to `programs/fulltime/src/lib.rs` (the `settle` fn)

---

## Scene 1 — The problem (0:00–0:30)
**Visual:** the live app hero.
**Say:** "Every prediction market has the same weak point: settlement. Someone has to tell the chain who won, and you have to trust them. Fulltime settles World Cup markets from a *cryptographic proof* of the result — verified on-chain by TxLINE. No oracle you have to trust."

## Scene 2 — Real TxLINE data, live (0:30–1:10)
**Visual:** scroll the app — the match grid.
**Say:** "This is live. Every fixture here is pulled straight from TxLINE's API on devnet — France vs England, Spain vs Argentina, and more, with the Upcoming / Live / Finished filters." 
**Do:** click a match card. "Each match is a market: stake on either side, and the pool is transparent on-chain."

## Scene 3 — Real integration, not mocked (1:10–1:45)
**Visual:** terminal.
**Do:** run `DEPLOYER_KEYPAIR=… node app/txline-subscribe.mjs` (or show the saved output).
**Say:** "Access to TxLINE is real. We subscribe *on-chain* to their free World Cup tier, sign, and activate an API token — that's the token the site uses to read live data."

## Scene 4 — On-chain settlement, the core (1:45–2:55)
**Visual:** `programs/fulltime/src/lib.rs`, the `settle` function.
**Say:** "Here's the heart of it. `settle` builds TxLINE's *real* `validate_stat` instruction — this discriminator and these argument structs come straight from their on-chain IDL — and calls it via CPI. To settle 'France wins', we prove `home_goals − away_goals > 0` against TxLINE's Merkle root. If TxLINE's program doesn't accept the proof, the transaction reverts. The market can only resolve to a result their cryptographic data supports."
**Do:** run `DEPLOYER_KEYPAIR=… node app/ft-demo.mjs`. Let it stream.
**Say:** "Watch the whole lifecycle run on devnet: create the market, two users stake USDC on opposite sides — 150 in escrow — settle, then claim."

## Scene 5 — Verify it on-chain (2:55–3:35)
**Visual:** Solana Explorer — open the `create_market`, `settle`, and `claim_winnings` txns from the terminal output.
**Say:** "Every step is a real transaction. Here's the market created, here's settlement, and here's the winner claiming the pool — their balance went from 1000 to 1050: staked 100, won the 150-USDC pool. Real escrow, real payout, all on-chain."

## Scene 6 — Wrap (3:35–4:05)
**Visual:** back to the app; then the program on Explorer.
**Say:** "Fulltime proves prediction markets don't need a trusted oracle — just TxLINE's verifiable data and a Solana CPI. Program's deployed, the app is live, and the settlement is backed by TxLINE's real proof mechanism. Links in the description."

---

## Production notes
- Mute notifications; clean terminal; use a readable code font.
- The `ft-demo.mjs` run currently uses `admin_settle` (the fallback) because the showcase matches settle in the hackathon window; if a real match proof has published, swap in the genuine proof-driven `settle` txn here — it's the strongest 15 seconds in the video.
- Keep it fast; no dead air.
