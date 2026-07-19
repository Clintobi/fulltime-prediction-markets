'use client'

import { useState, useEffect } from 'react'
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
  // The wallet-adapter button renders a different tree once a wallet auto-connects
  // (address + icon) than the server's disconnected markup, which trips a hydration
  // mismatch. Render it only after mount to avoid SSR of the connected state.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
          {mounted ? (
            <WalletMultiButton className="!bg-ink hover:!bg-black !text-white !text-sm !font-semibold !h-10 !rounded-full !px-4" />
          ) : (
            <div className="h-10 w-[132px] rounded-full bg-ink/5" aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  )
}
