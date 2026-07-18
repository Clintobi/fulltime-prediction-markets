import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { TournamentGrid } from '@/components/TournamentGrid'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <Hero />
      <ProofBand />
      <TournamentGrid />

      <footer className="border-t border-slate-800 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span className="text-pitch-400 font-semibold">Fulltime</span>
            <span>Prediction Markets & Settlement</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by Solana + TxLINE</span>
            <a href="https://github.com/Clintobi/fulltime-prediction-markets" className="hover:text-slate-400">GitHub</a>
            <a href="/verify" className="hover:text-slate-400">Verify</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function ProofBand() {
  const items = [
    { k: 'Settlement, verified', v: 'Two markets settled from real TxLINE proofs — outcome derived on-chain from validate_stat, not a signer.', href: '/verify', cta: 'Watch the trust chain →' },
    { k: '16 hermetic tests', v: 'The real TxLINE oracle binary run in-process against its real anchored roots. Every tamper reverts.', href: 'https://github.com/Clintobi/fulltime-prediction-markets/tree/main/tests/hermetic', cta: 'See the suite →' },
    { k: 'Permissionless keeper', v: 'Anyone can auto-settle the moment TxLINE finalizes a fixture. No admin key — funds never sit behind an operator.', href: 'https://github.com/Clintobi/fulltime-prediction-markets/tree/main/keeper', cta: 'Read the keeper →' },
    { k: 'Trustless by construction', v: 'No admin_settle, no oracle to trust. A market reaches Settled only through a valid proof; a tampered one reverts inside the CPI.', href: '/verify', cta: 'Verify it yourself →' },
  ]
  return (
    <section className="border-b border-slate-800 bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-xs font-mono text-pitch-400 mb-6">SETTLEMENT AS PROOF, NOT TRUST — AND YOU CAN CHECK EVERY WORD</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map(it => (
            <a key={it.k} href={it.href} target={it.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
              className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-5 hover:border-pitch-800 transition-colors">
              <div className="font-display font-semibold text-slate-100 mb-2">{it.k}</div>
              <div className="text-xs text-slate-500 leading-relaxed mb-4">{it.v}</div>
              <div className="text-xs font-semibold text-pitch-400 group-hover:text-pitch-300">{it.cta}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
