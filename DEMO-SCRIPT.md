# Demo Video Script — Fulltime (recordable now)

**Duration:** ~4 min · Record at 1080p. Everything below is live and real today.

**Have ready before recording:**
- Browser tab: https://fulltime-txline.vercel.app
- Browser tab: https://explorer.solana.com/address/37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW?cluster=devnet
- Terminal in `~/fulltime`, with `DEPLOYER_KEYPAIR=~/fulltime-keys/deployer.json` and `CREDS=~/fulltime-keys/txline-creds.json`
- Editor open to `programs/fulltime/src/lib.rs` (the `settle` fn — note it takes no `outcome` arg and reads `get_return_data()`)
- **Pick fresh fixtures first.** A fixture settles only ONCE (the market goes non-Open), so before recording run `CREDS=~/fulltime-keys/txline-creds.json node app/ft-find-fixtures.mjs` and pick two that show `✅ FRESH`. Use one YES fixture for Scene 4 and one for the tamper in Scene 4b.
  - Record-now options (teams show as ids): **18179549** (1-0 → YES), **18193785** (1-4 → NO), **18185036** (0-3 → NO).
  - Best-looking option (real team names): run against **France v England (18257865)** after it finishes Jul 18, or the **final Spain v Argentina (18257739)** after Jul 19 — the finder will show them `✅ FRESH` once played.

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

## Scene 3.5 — A judge bets in the browser (INTERACTIVE) (1:20–2:00)
**Visual:** https://fulltime-txline.vercel.app/bet (reset it first — see below).
**Do:** connect a devnet wallet → "Get 1,000 test-USDC" → type an amount → "Bet YES/NO" (the pool bar moves) → "Settle from TxLINE proof" → "Claim".
**Say:** "A judge doesn't have to take our word for it — connect a devnet wallet, grab test-USDC, and place a real bet. Then anyone clicks Settle: the app fetches TxLINE's proof, and the winner is decided on-chain by the CPI, not by us. The winner claims their share. Bet to payout, entirely in the browser."
**⚠ Reset before recording:** a fixture settles once. Run
`FIXTURE=<a fresh 181xxxxx fixture, e.g. 18193785> node app/create-demo-market.mjs`
to point `/bet` at a fresh market (the 17588xxx fixtures lack full-time proofs — use 181xxxxx).

## Scene 4 — On-chain settlement, the core (1:45–2:40)
**Visual:** `programs/fulltime/src/lib.rs`, the `settle` function.
**Say:** "Here's the heart of it. `settle` takes *no* outcome argument. It builds TxLINE's real `validate_stat` instruction — discriminator and argument structs straight from their on-chain IDL — CPIs into it, and then reads the **return-data verdict**. The market resolves YES or NO based on what TxLINE's cryptographic proof says — nobody passes in the winner. We also bind the proof to this fixture, re-derive the daily-roots account, require the full-time result, and constrain the predicate to the market's question."
**Do:** run `DEPLOYER_KEYPAIR=… CREDS=… FIXTURE=<your fresh YES fixture> MODE=real node app/ft-real-settle.mjs`. Let it stream.
**Say:** "This settles a real finished fixture from TxLINE's finalised proof. Watch: the on-chain resolution comes back **YES**, derived from the verdict. The outcome was not chosen by the caller."

## Scene 4b — Settle a lie, get rejected (THE MONEY SHOT) (2:40–3:15)
**Visual:** terminal.
**Do:** run the same command with `TAMPER=1` appended.
**Say:** "Now watch what happens if someone tries to settle a *lie* — I flip one goal in the proof and submit it. TxLINE's program runs the Merkle check… and the transaction **reverts**. You cannot settle an outcome the data doesn't support. That's the whole thesis: settlement as proof, not trust."

## Scene 5 — Verify on-chain + drain-proof payouts (3:15–3:50)
**Visual:** Solana Explorer — open the `settle` txn (valid) and the reverted one.
**Say:** "Every step is a real transaction — here's the proof-settle, and here's the fraud attempt failing on-chain."
**Do (optional):** `node app/ft-claim-test.mjs` — "And payouts are pro-rata and drain-proof: a winner can't over-claim, every winner gets their fair share of the pool."

## Scene 6 — Wrap (3:50–4:15)
**Visual:** back to the app; then the program on Explorer.
**Say:** "Fulltime proves prediction markets don't need a trusted oracle. Anyone can settle, because the outcome is a cryptographic verdict from TxLINE — and anyone can verify it. Program's deployed, the app is live, settlement is real. Links in the description."

---

## Production notes
- Mute notifications; clean terminal; use a readable code font.
- The `ft-demo.mjs` run currently uses `admin_settle` (the fallback) because the showcase matches settle in the hackathon window; if a real match proof has published, swap in the genuine proof-driven `settle` txn here — it's the strongest 15 seconds in the video.
- Keep it fast; no dead air.
