import type { Metadata } from 'next'
import { Gabarito, Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { WalletProvider } from '@/components/WalletProvider'

// Fonts per DESIGN_BRIEF.md §2 — Gabarito (display), Hanken Grotesk (body),
// IBM Plex Mono (numerics). Inter + Space Grotesk are banned and removed.
const display = Gabarito({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
})
const sans = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
})
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Fulltime — Bet the match, settled by proof',
  description:
    'Predict the World Cup on Solana. When the whistle goes, your payout settles itself from the real score — no bookie, no house, and every win is one you can check on-chain.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${display.variable} ${mono.variable} font-sans bg-bg text-ink antialiased`}
      >
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  )
}
