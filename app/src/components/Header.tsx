'use client'

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pitch-400 to-pitch-600 flex items-center justify-center text-sm font-bold text-white">
            FT
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Fulltime</h1>
            <p className="text-xs text-slate-500 -mt-0.5">Prediction Markets</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-500 hidden sm:block">
            <span className="text-pitch-400 font-mono">TxLINE</span> powered
          </div>
          <WalletMultiButton className="!bg-pitch-600 hover:!bg-pitch-700 !text-xs !h-9 !rounded-lg !px-4" />
        </div>
      </div>
    </header>
  )
}
