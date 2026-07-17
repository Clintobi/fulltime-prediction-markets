'use client'

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-800">
      <div className="absolute inset-0 bg-gradient-to-b from-pitch-950/40 via-transparent to-transparent" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-pitch-900/10 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24 relative">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pitch-950 border border-pitch-800 text-pitch-300 text-xs mb-6">
            <span className="w-2 h-2 rounded-full bg-pitch-400 animate-pulse" />
            Live on Solana devnet — TxLINE verified
          </div>

          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-4">
            Predict Every Match.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pitch-300 to-pitch-500">
              Settle On-Chain.
            </span>
          </h2>

          <p className="text-lg text-slate-400 leading-relaxed mb-8">
            Decentralized prediction markets for the entire World Cup tournament.
            Stake USDC, make predictions, and settle automatically via
            cryptographically verified TxLINE data — no oracle, no trust.
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs font-bold text-pitch-400">18k</div>
                Prize Pool
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs font-bold text-pitch-400">7</div>
                Live Fixtures
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs font-bold text-pitch-400">CPI</div>
                TxLINE Settlement
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
