import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { TournamentGrid } from '@/components/TournamentGrid'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <Hero />
      <TournamentGrid />

      <footer className="border-t border-slate-800 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span className="text-pitch-400 font-semibold">Fulltime</span>
            <span>Prediction Markets & Settlement</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by Solana + TxLINE</span>
            <a href="https://github.com" className="hover:text-slate-400">GitHub</a>
            <a href="https://superteam.fun/earn" className="hover:text-slate-400">Superteam Earn</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
