'use client'

import { Button } from './ui/Button'
import { ProofTicket } from './ui/ProofTicket'
import { CheckIcon } from './ui/Mascots'
import {
  BallMascot,
  TrophyMascot,
  WhistleMascot,
  NetMascot,
  FlagMascot,
  Orb,
  ACCENT,
  CORAL,
} from './ui/Mascots'

// The one real settlement we headline (devnet). Honest: score + tx are real; the
// market is a plain "did the home side win?" match-winner (home won 1–0 → YES).
const REAL_SETTLE_TX =
  '5QZzypbShX2VJzQuCpRJfUDb5F4oTx7H8v2RxrAh4NJybPnmMkG6PwVk25avgUFbZhneBxfNfE9hdYXmUEZ3Nexy'

const TRUST = [
  'No bookie, and no house taking a cut',
  'Payouts land the moment the match is final',
  'Every win is one you can check on-chain',
]

export function Hero() {
  return (
    <section className="relative overflow-hidden shell-grain">
      {/* mascot confetti — drifts gently, disabled under reduced-motion */}
      <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
        <BallMascot className="absolute left-[3%] top-[22%] w-16 h-16 animate-drift" />
        <TrophyMascot className="absolute left-[8%] bottom-[14%] w-14 h-14 animate-drift-slow" />
        <WhistleMascot className="absolute left-[20%] top-[8%] w-12 h-12 animate-drift-slow" />
        <NetMascot className="absolute right-[4%] top-[12%] w-16 h-16 animate-drift-slow" />
        <FlagMascot className="absolute right-[10%] bottom-[10%] w-12 h-12 animate-drift" />
        <Orb className="absolute left-[15%] bottom-[30%] w-4 h-4 animate-drift" color={CORAL} />
        <Orb className="absolute right-[22%] top-[40%] w-3.5 h-3.5 animate-drift-slow" color={ACCENT} />
        <Orb className="absolute left-[30%] bottom-[8%] w-3 h-3 animate-drift" color={ACCENT} />
      </div>

      <div className="relative max-w-content mx-auto px-5 py-20 sm:py-28">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-8 items-center">
          {/* left: headline */}
          <div className="animate-rise-in">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink/5 border border-hairline px-3 py-1 text-[12px] font-semibold text-ink-muted mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
              World Cup 2026 · live on Solana devnet
            </span>

            <h1 className="font-display font-bold text-[44px] sm:text-[64px] leading-[1.03] tracking-[-0.02em] text-balance mb-5">
              Bet the match.
              <br />
              <span className="text-ink-muted">Settled by proof.</span>
            </h1>

            <p className="text-[17px] leading-relaxed text-ink-muted max-w-lg mb-8 text-pretty">
              Pick a World Cup result and stake in seconds. When the whistle goes, your payout
              settles itself from the real score — no bookie, no house, nothing anyone can rig.
              And every win is one you can check on-chain yourself.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-9">
              <Button href="/markets" variant="primary" size="lg" withArrow>
                Open the markets
              </Button>
              <Button href="/verify" variant="secondary" size="lg">
                <CheckIcon className="w-4 h-4 text-accent-dim" />
                See a settled bet
              </Button>
            </div>

            <ul className="space-y-2.5">
              {TRUST.map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[15px] text-ink">
                  <span className="flex-none w-5 h-5 rounded-full bg-accent/12 flex items-center justify-center">
                    <CheckIcon className="w-3 h-3 text-accent-dim" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* right: the real floating proof-ticket */}
          <div className="relative animate-rise-in [animation-delay:120ms]">
            <ProofTicket
              floating
              home="Home"
              away="Away"
              scoreHome={1}
              scoreAway={0}
              question="Will the home side win?"
              status="settled"
              yesLabel="YES · home win"
              noLabel="NO"
              yesValue="won"
              selected="yes"
              txHash={REAL_SETTLE_TX}
            />
            <p className="mt-3 text-center text-[13px] text-ink-muted">
              A real bet, already settled on-chain.{' '}
              <span className="text-ink font-medium">Tap the hash to check it.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
