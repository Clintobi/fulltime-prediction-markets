import type { Metadata } from 'next'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { WalletProvider } from '@/components/WalletProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Fulltime — World Cup Prediction Markets',
  description: 'Decentralized prediction markets for the 2026 World Cup, powered by TxLINE',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${display.variable} ${mono.variable} font-sans bg-slate-950 text-slate-100`}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  )
}
