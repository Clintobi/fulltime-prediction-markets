import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { TournamentGrid } from '@/components/TournamentGrid'
import { Wordmark } from '@/components/ui/Wordmark'
import { CheckIcon, ArrowRight, ArrowUpRight } from '@/components/ui/Mascots'

export default function Home() {
  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <Hero />
      <ProofBand />
      <TournamentGrid />
      <Footer />
    </div>
  )
}

function ProofBand() {
  const items = [
    {
      k: 'Real payouts, already proven',
      v: 'Two bets have already settled on devnet — decided by the real match result, not by us. Open the transactions and check them yourself.',
      href: '/verify',
      cta: 'See one settle',
      external: false,
    },
    {
      k: 'Nobody can fake a result',
      v: 'Settlement runs against the real match data, and we test every way to game it — a doctored score, a forged proof. They all get rejected.',
      href: 'https://github.com/Clintobi/fulltime-prediction-markets/tree/main/tests/hermetic',
      cta: 'See the tests',
      external: true,
    },
    {
      k: 'Your winnings never wait',
      v: 'The moment a match is final, anyone — or our bot — can settle it and pay out. Your money never sits behind an operator.',
      href: 'https://github.com/Clintobi/fulltime-prediction-markets/tree/main/keeper',
      cta: 'How payouts work',
      external: true,
    },
    {
      k: 'No admin, no override',
      v: 'There is no button we can press to change an outcome. A bet only pays when the real result proves it — and you can watch it happen.',
      href: '/verify',
      cta: 'Verify it yourself',
      external: false,
    },
  ]
  return (
    <section className="border-y border-hairline bg-surface">
      <div className="max-w-content mx-auto px-5 py-16 sm:py-20">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-dim mb-3">
          <CheckIcon className="w-4 h-4" />
          Proof you can check, not promises
        </div>
        <h2 className="font-display font-bold text-[28px] sm:text-[36px] tracking-[-0.015em] mb-10 max-w-xl text-balance">
          Don&apos;t take our word for it. Check every claim yourself.
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((it) => (
            <a
              key={it.k}
              href={it.href}
              target={it.external ? '_blank' : undefined}
              rel={it.external ? 'noreferrer' : undefined}
              className="group rounded-card border border-hairline bg-bg p-5 hover:border-ink/20 hover:shadow-card-sm transition-all"
            >
              <div className="font-display font-semibold text-[17px] text-ink mb-2">{it.k}</div>
              <p className="text-[13px] text-ink-muted leading-relaxed mb-4">{it.v}</p>
              <div className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-dim">
                {it.cta}
                {it.external ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div className="max-w-wide mx-auto px-5 py-10 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Wordmark />
          <span className="text-[13px] text-ink-muted">Prediction Markets &amp; Settlement</span>
        </div>
        <div className="flex items-center gap-5 text-[13px] text-ink-muted">
          <span>Powered by Solana + TxLINE</span>
          <a href="https://github.com/Clintobi/fulltime-prediction-markets" className="hover:text-ink transition-colors">
            GitHub
          </a>
          <a href="/verify" className="hover:text-ink transition-colors">
            Verify
          </a>
        </div>
      </div>
    </footer>
  )
}
