'use client'

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-800">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_-10%,rgba(34,197,94,.08),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_0%_0%,rgba(90,120,255,.04),transparent_55%)]" />

      <div className="max-w-5xl mx-auto px-4 py-20 sm:py-28 relative">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pitch-950 border border-pitch-800 text-pitch-300 text-xs mb-6 font-mono">
            <span className="w-2 h-2 rounded-full bg-pitch-400 animate-pulse" />
            Live on Solana devnet · settled by TxLINE proof
          </div>

          <h2 className="font-display text-4xl sm:text-6xl font-bold tracking-[-0.035em] leading-[1.02] mb-5 text-balance">
            The market that settles itself.
          </h2>

          <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-xl text-pretty">
            Stake USDC on a World Cup result, then let <span className="text-slate-200">anyone settle it</span> — the
            winner is derived on-chain from TxLINE&apos;s cryptographic proof, not an oracle you have to trust. A
            tampered proof reverts.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a href="/bet" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pitch-600 hover:bg-pitch-500 text-white text-sm font-semibold transition-colors">
              Place a bet on devnet →
            </a>
            <a href="/verify" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-700 hover:border-slate-500 text-sm text-slate-300 transition-colors">
              Verify a settlement →
            </a>
            <a href="https://explorer.solana.com/address/37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW?cluster=devnet" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-800 hover:border-slate-600 text-sm text-slate-400 transition-colors font-mono">
              37Gjug…9vTW ↗
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {[
              ['Trustless', 'outcome from a proof, not a signer'],
              ['Permissionless', 'anyone settles, anyone verifies'],
              ['On-chain escrow', 'pro-rata payouts, drain-proof'],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <span className="font-display font-semibold text-pitch-300">{k}</span>
                <span className="text-slate-500 text-xs">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
