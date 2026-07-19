# Fulltime — 4:00 Demo Script

This is a performance script, not an outline. Target **3:52–3:58** so platform processing never pushes the video over four minutes. Record 1440p or 1080p, hide bookmarks/notifications, enlarge browser text to 110%, and keep the cursor still unless the script says to move it.

## Before recording

Open these in order:

1. `https://fulltime-txline.vercel.app/bet` with a devnet wallet ready.
2. `https://fulltime-txline.vercel.app` on the fixtures view.
3. The successful settlement transaction from `VERIFY.md` in Solana Explorer, already scrolled to inner instructions/logs.
4. A terminal at the repo root with `npm run judge:verify` typed but not executed.
5. `programs/fulltime/src/lib.rs`, positioned at `pub fn settle` and zoomed until `invoke`, `get_return_data`, and the absence of an outcome parameter are legible.

Run the faucet and one browser deposit before the real take if devnet is slow. Keep that successful state available. Do not promise automated void refunds; say postponed events fail closed into review.

## 0:00–0:18 — Cold open: the settlement problem

**Visual:** `/bet`, framed so the lifecycle and market card are both visible. Begin on motion—move the cursor once across the lifecycle.

**Say, measured but urgent:**

> “Prediction markets are easy to open and hard to trust at settlement. Who tells the contract which team won—and what stops them lying? Fulltime removes that decision. TxLINE proves the final score on Solana, and the proof itself decides who gets paid.”

**Editorial note:** Put a small lower-third on “THE PROOF DECIDES.” No intro animation longer than one second.

## 0:18–0:48 — Product lifecycle in one screen

**Visual:** Point through the five lifecycle steps. Connect wallet if it is reliable; otherwise show the already-connected state. Click **Get test-USDC**, enter a modest stake, choose a side, and show the confirmation or existing position.

**Say:**

> “The user flow is five steps: connect, fund, deposit, proof-settle, claim. This faucet is a server-sponsored devnet tool, so the demo key never reaches the browser. Deposits are real Token-2022 escrow transactions. The pools, my position, and the next valid action all come from on-chain state—not a pretend database.”

**On-screen callouts:** `SERVER-SIGNED TEST FAUCET`, then `TOKEN-2022 ESCROW`.

## 0:48–1:15 — TxLINE visibly powers the product

**Visual:** Switch to the home fixture grid. Show the live-data indicator, scan 2–3 cards, use a status filter, then briefly reveal DevTools Network filtered to `txline` or show the `/api/txline/fixtures/snapshot` request returning normalized JSON.

**Say:**

> “Every fixture and score here comes through TxLINE’s normalized feed. Live score updates arrive over SSE. Credentials remain behind an allow-listed server proxy, while the persistent keeper monitors final states independently. Recorded data exists only for judge replay after the matches end—it does not replace this live input.”

**Editorial note:** Highlight one TxLINE response for two seconds; do not linger on JSON.

## 1:15–1:52 — The trustless core

**Visual:** Hard cut to `settle` in Rust. Slowly trace the function signature, the canonical TxLINE address constraint, `invoke`, and `get_return_data`.

**Say:**

> “Here is the core. Notice: settle takes no outcome argument. It binds the proof to this fixture, re-derives TxLINE’s daily-roots account, requires full-time period one hundred, and constrains the exact market predicate. Then it CPIs into the canonical TxLINE validate-stat program and reads TxLINE’s return verdict. There is no admin-settle function and no substitute oracle.”

**On-screen callouts, sequential:** `NO OUTCOME ARGUMENT` · `CANONICAL TXLINE CPI` · `NO ADMIN OVERRIDE`.

## 1:52–2:28 — On-chain proof, not a claim

**Visual:** Cut to the successful transaction in Explorer. Expand logs/inner instructions. Stop where Fulltime invokes TxLINE and TxLINE returns success.

**Say:**

> “This is a real devnet settlement for fixture 18179549. Inside the Fulltime transaction, you can see TxLINE’s ValidateStat invocation, fixture-level validation, the two-stat predicate, and a true return value. The one–nil result derives YES. We also proved the opposite branch on a one–four fixture, deriving NO. Two scorelines, two outcomes, zero operator choices.”

**On-screen callout:** `FULLTIME → TXLINE VALIDATE_STAT → VERDICT TRUE`.

## 2:28–2:52 — Fraud and edge cases fail closed

**Visual:** Show the test names or a pre-captured terminal crop: tampered goal, wrong fixture, fake oracle, non-final period, malformed feed, postponed event.

**Say:**

> “Change one goal or Merkle node and TxLINE rejects the proof atomically. A fake oracle, wrong roots account, wrong fixture, wrong predicate, or in-play period also reverts. The keeper refuses malformed feeds, and postponed matches enter explicit void-review. It never guesses a winner.”

**Editorial note:** Rapid six-line highlight, roughly half a second each.

## 2:52–3:29 — The reproducibility money shot

**Visual:** Terminal. Execute `npm run judge:verify`. While it runs, show the real binary filenames and proof artifacts in a split view if possible. End on the passing summary.

**Say:**

> “And judges do not have to trust this video. One command runs the compiled Fulltime and genuine TxLINE SBF binaries in-process against recorded roots and proofs. It includes a real Token-2022 deposit, both settlement branches, the adversarial matrix, deterministic replay, and postponed handling. No wallet. No SOL. No validator. No API key. No third-party account.”

Pause for **one beat** on `PASS — Fulltime is independently reproducible.`

**On-screen callout:** `19 PROGRAM TESTS + 4 POLICY TESTS + 6 EVIDENCE CHECKS`.

## 3:29–3:55 — Close on the product, not the terminal

**Visual:** Return to `/bet`, scroll just enough to show the proof-accepted/claim state and canonical oracle link. Finish with app + GitHub URLs in a clean end card.

**Say:**

> “Fulltime gives fans a simple deposit-to-claim experience, while the chain gets something stronger: settlement as proof, not trust. The app is live, the program is deployed, the verifier is credential-free, and every winner is decided by TxLINE. Fulltime.”

Hold the end card for **three seconds**. No spoken request to vote.

## Edit and audio specification

- Use clean cuts or 4–6 frame dissolves; no flashy template transitions.
- Keep background music near −28 LUFS under speech; voice should peak around −3 dB and average roughly −16 LUFS.
- Accelerate loading/waiting only; never accelerate spoken proof claims.
- Use exactly one accent color for captions and callouts.
- Burn in concise captions. Correct technical capitalization: `TxLINE`, `Solana`, `Token-2022`, `ValidateStat`, `SSE`.
- Show explorer addresses only long enough to establish authenticity; favor readable logs and product state.
- If any live operation stalls for more than two seconds, cut to the pre-recorded successful state and say “Here is the confirmed transaction.” Never fake a success.
