import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { WalletProvider } from '@/components/WalletProvider'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={`${inter.className} bg-slate-950 text-slate-100`}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  )
}
