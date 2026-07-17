# Fulltime Fan Zone — Live Match Center

**Track:** Consumer and Fan Experiences (TxODDS × Solana World Cup Hackathon)
**Live:** https://fulltime-txline.vercel.app/live
**Code:** [`app/src/components/LiveMatchCenter.tsx`](app/src/components/LiveMatchCenter.tsx)

## One-liner

A fan-facing World Cup companion that turns TxLINE's live match data into an
engaging second-screen experience: **real-time scores that update the instant
they happen** (via TxLINE's SSE stream), plus a casual **predict-the-winner**
game with points and a leaderboard — no wallet, no money, pure engagement.

## What fans do

- **Follow a match live.** Pick any fixture; the match center subscribes to
  TxLINE's `scores/stream` (Server-Sent Events) and updates the score and a live
  event feed instantly during the game — goals show up the moment TxLINE
  publishes them.
- **Predict the winner.** Call Home / Draw / Away before kickoff, lock it in,
  earn points, and climb a leaderboard against other fans. Streaks and points
  persist locally.
- **Zero friction.** It's a pure consumer experience — open the page and play.
  No wallet connect required (the on-chain markets live one click away on the
  Markets page for fans who want to put stakes down).

## Why it uses TxLINE as a *primary* input

Every fixture, every score, every live event comes from TxLINE — the fixture
list from `/fixtures/snapshot`, live updates from the `scores/stream` SSE feed.
During a match the UI reacts to TxLINE's push in real time; between matches it
shows the schedule and takes predictions. It updates instantly during games,
exactly the fan-engagement loop the track calls for.

## Tech

Next.js (static export) + a thin TxLINE client (`app/src/lib/txline.ts`) that
handles the on-chain-subscription API token and the SSE reader. Same TxLINE
integration that powers the prediction markets and the trading agent — this is
the consumer surface of the suite.

## During real matches

The showcase fixtures (France v England, Spain v Argentina) play in the
hackathon window; when they kick off, the live feed and score come alive
tick-by-tick from TxLINE with no page reload.

## Roadmap

Goal/red-card animations and haptics; social predictions (see friends' picks);
a Telegram/Discord bot posting live goals + running the prediction game in-chat;
tie the leaderboard to on-chain achievements.
