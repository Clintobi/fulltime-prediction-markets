# Recording plan — Fulltime (redesigned UI)

**~3 min · record at 1080p.** Lead with the product now that it looks like one; keep the one
killer technical moment (proof can't be faked). Record from the live URL
(**https://fulltime-txline.vercel.app**) or `localhost:3000` — both show the new design.

**Have ready:** a devnet wallet (Phantom) with a little SOL; the app open on the hero; one tab on
Solana Explorer for the settle tx. Mute notifications.

---

### Scene 1 — Hook (0:00–0:20) · the hero
**Show:** the hero — *"Bet the match. Settled by proof."* with the floating settled ticket.
**Say:** "Every prediction market has one weak point — settlement. Someone tells the chain who
won, and you have to trust them. Fulltime is different. Bet on the World Cup, and when the whistle
goes your payout settles itself from the real result — no bookie, no house, nothing anyone can rig.
And every win is one you can check on-chain. That ticket? A real bet, already settled — I'll click
that hash in a minute."

### Scene 2 — The board (0:20–0:45) · home grid
**Show:** scroll to the match grid; tap the Live / Finished filters.
**Say:** "These are real World Cup fixtures, live from TxLINE on devnet. Every match is a market —
pick a side, the pool's on-chain, and a finished match shows 'Settled & paid.'"

### Scene 3 — Bet, end to end (0:45–1:30) · /bet
**Show:** connect wallet → **Get test-USDC** → type a stake → **Bet YES** (pool bar moves) →
**Settle it from the result** → **Claim winnings**.
**Say:** "You don't have to take my word for it. Connect a devnet wallet, grab test-USDC, back a
side — watch the pool move. Now anyone clicks settle: the app pulls the real result and the winner
is decided on-chain, not by us. Claim, and you're paid your share. Bet to payout, all in the browser."

### Scene 4 — Prove it can't be faked (1:30–2:15) · /verify — THE MONEY SHOT
**Show:** `/verify` → click a preset (e.g. *18179549 · 1-0 → YES*) → the **trust chain** +
**execution-flow** diagram render live.
**Say:** "This is the heart of it. Paste any settled bet and the whole chain rebuilds itself: our
program called TxLINE's real validate_stat, it checked the proof against the anchored match data,
got a verdict, and the outcome was *derived* from that verdict — nobody typed in the winner. No
admin button, no oracle to trust."
**Optional flex (terminal):** `… MODE=real TAMPER=1 node app/ft-real-settle.mjs` → "flip one goal
in the proof and the transaction **reverts** on-chain. You can't settle a result the data doesn't
support."
**Then:** click the hero ticket's tx hash → Solana Explorer, show the real settle tx.

### Scene 5 — Beyond win/lose (2:15–2:45) · /markets · /parlay · /exchange
**Show:** a quick pass — markets (3 types), the dark parlay betslip, the exchange order book.
**Say:** "The same engine settles more than match winners — over/under and exact-score markets,
multi-leg parlays that only pay if every leg lands, and a peer-to-peer exchange where you name your
own odds. No house on any of it."

### Scene 6 — Wrap (2:45–3:00)
**Show:** back to the hero, then the program on Explorer.
**Say:** "Fulltime proves prediction markets don't need a trusted oracle. Anyone can settle, because
the outcome is a cryptographic verdict — and anyone can verify it. The program's live on Solana, the
app's live, settlement is real. Links below."

---

**If a fresh live-settle is wanted in Scene 4:** a fixture settles only once, so before recording run
`CREDS=~/fulltime-keys/txline-creds.json node app/ft-find-fixtures.mjs` and pick one showing
`✅ FRESH`. Otherwise the two already-settled txs (18179549 → YES, 18193785 → NO) are always
showable on Explorer and via `/verify`.
