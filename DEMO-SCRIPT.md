# Demo Video Script

**Duration**: ~4 minutes (max 5)

## Scene 1: Problem & Intro (0:00-0:45)

**Visual**: Screen recording — landing page of Fulltime
**Audio**:

"World Cup 2026 has 104 matches. Every match has winners, losers, goals — and somewhere, someone is making a bet. But traditional sports betting is a black box: you trust the house, you can't verify the outcome, and payouts take days."

"Fulltime changes that. It's a decentralized prediction market for the entire World Cup, powered by TxLINE's cryptographically verified sports data. Every match outcome is proved on-chain — no oracle, no trust required."

---

## Scene 2: Tournament Overview (0:45-1:30)

**Visual**: Scroll through matches, show the grid of 48 group-stage cards
**Audio**:

"Here's the full tournament — all 48 group matches plus knockout rounds. Each card shows the matchup, kickoff time, and live score if the match is in progress."

"Click on any match to see the prediction options. You can stake USDC on either team to win. The pool is transparent — you can see exactly how much is staked on each side."

---

## Scene 3: Live TxLINE Data (1:30-2:15)

**Visual**: Open browser DevTools Network tab, show the SSE stream connection. Then switch to showing a match "in play" with scores updating live.
**Audio**:

"Under the hood, Fulltime connects to TxLINE's SSE stream — Server-Sent Events. Here you can see the connection to `api/scores/stream`, delivering real-time score updates as they happen."

"Every score update includes a sequence number. When a match finishes — `action=game_finalised`, `statusId=100` — the stream tells us immediately, and our keeper bot picks it up for settlement."

---

## Scene 4: On-Chain Settlement (2:15-3:00)

**Visual**: Show the Solana Explorer with a settlement transaction. Then show code: the CPI call to `validateStatV2`.
**Audio**:

"This is where TxLINE's crypto magic comes in. When a match ends, our keeper fetches a Merkle proof from TxLINE's stat-validation endpoint — a cryptographic receipt signed by data anchored on Solana."

"Our smart contract calls `validateStatV2` via CPI — Cross-Program Invocation. TxLINE's program verifies the Merkle proof against its on-chain root. If the proof is valid, our program knows the real score, and winners are paid out automatically."

"Here's the proof on Solana Explorer — you can see the Merkle root match, the stats validated, and the predicate that decided the outcome."

---

## Scene 5: Claiming (3:00-3:30)

**Visual**: Show the UI after settlement — the "Settled ✓" badge, then click "View Proof" to show the on-chain record.
**Audio**:

"After settlement, every market shows as settled. Users can claim their winnings with one click — the USDC is released from the escrow vault directly to their wallet."

"And because everything is on-chain, you can click 'View Proof' to see the exact Merkle proof that settled your market. Full transparency."

---

## Scene 6: Keeper Bot (3:30-4:00)

**Visual**: Show terminal running the keeper bot — logs of stream connection, game_finalised detection, proof fetch, settlement tx.
**Audio**:

"Our keeper bot runs autonomously. It connects to TxLINE's stream, listens for finalised matches, fetches proofs, and settles on-chain. It's permissionless — anyone can run it."

"This is the feedback loop: TxLINE SSE → game_finalised event → proof fetch → CPI settlement → users claim. All automated, all verifiable."

---

## Scene 7: Wrap (4:00-4:30)

**Visual**: Back to the Fulltime landing page
**Audio**:

"Fulltime proves that prediction markets don't need trusted oracles. With TxLINE's cryptographic proofs and Solana's fast settlement, we can build trustless, transparent sports markets at scale."

"18k USDT prize pool, 104 matches, 4 days left. Get in."

"Links in description: GitHub repo, deployed app, and TxLINE docs."

---

## Production Notes

- Use clean screen recordings with no background noise
- For the Solana Explorer, zoom into relevant parts
- Code snippets should use a nice code font (e.g., Fira Code)
- Keep the demo fast-paced — no dead air
- Mute browser notifications during recording
- Record at 1080p, 30fps minimum
