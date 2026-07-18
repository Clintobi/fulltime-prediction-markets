'use client'

import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Public devnet RPC by default; set NEXT_PUBLIC_RPC in Vercel to a dedicated
  // devnet endpoint (Helius/QuickNode/Alchemy) for materially more reliable inclusion.
  const endpoint = useMemo(() => process.env.NEXT_PUBLIC_RPC || 'https://api.devnet.solana.com', [])
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}
