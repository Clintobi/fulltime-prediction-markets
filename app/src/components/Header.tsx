'use client'

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Wordmark } from './ui/Wordmark'
import { Button } from './ui/Button'

const NAV = [
  ['Markets', '/markets'],
  ['Parlays', '/parlay'],
  ['Exchange', '/exchange'],
  ['Verify', '/verify'],
]

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-bg/95">
      <div className="max-w-wide mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-6">
            {NAV.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-sm font-medium text-ink-muted hover:text-ink transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Button href="/bet" variant="primary" size="md" withArrow className="hidden sm:inline-flex">
            Place a bet
          </Button>
          <WalletMultiButton className="!bg-ink hover:!bg-black !text-white !text-sm !font-semibold !h-10 !rounded-full !px-4" />
        </div>
      </div>
    </header>
  )
}
