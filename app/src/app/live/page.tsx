import { Header } from '@/components/Header'
import { LiveMatchCenter } from '@/components/LiveMatchCenter'

export default function LivePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <div className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h2 className="text-3xl font-bold tracking-tight">Live Match Center</h2>
          <p className="text-slate-400 mt-1">Real-time World Cup scores from TxLINE — predict winners, climb the leaderboard.</p>
        </div>
      </div>
      <LiveMatchCenter />
      <footer className="border-t border-slate-800 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-xs text-slate-600 flex justify-between">
          <span className="text-pitch-400 font-semibold">Fulltime · Fan Zone</span>
          <span>Powered by Solana + TxLINE</span>
        </div>
      </footer>
    </div>
  )
}
