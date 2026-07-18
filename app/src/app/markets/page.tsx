'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { ComputeBudgetProgram, Transaction, PublicKey } from '@solana/web3.js'
import { Header } from '@/components/Header'
import { listMarkets, createMarketTx, betTx, type MarketRow, type NewMarket } from '@/lib/markets'
import { sendFaucet } from '@/lib/market'

const EX = (s: string) => `https://explorer.solana.com/address/${s}?cluster=devnet`
const fmt = (n: number) => (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })

const KIND_STYLE: Record<string, string> = {
  MatchWinner: 'border-pitch-800 text-pitch-300 bg-pitch-950/40',
  OverUnder: 'border-indigo-800 text-indigo-300 bg-indigo-950/30',
  ExactScore: 'border-amber-800 text-amber-300 bg-amber-950/30',
}

export default function MarketsPage() {
  const { connection } = useConnection()
  const { publicKey, signTransaction } = useWallet()
  const [rows, setRows] = useState<MarketRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)

  const refresh = useCallback(async () => {
    try { setRows(await listMarkets(connection)) } catch (e: any) { setMsg({ text: 'load failed: ' + e.message, err: true }) }
  }, [connection])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { const t = setInterval(refresh, 12000); return () => clearInterval(t) }, [refresh])

  async function send(label: string, tx: Transaction) {
    if (!publicKey || !signTransaction) { setMsg({ text: 'connect a wallet first', err: true }); return }
    setBusy(label); setMsg(null)
    try {
      tx.instructions.unshift(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 300_000 }))
      const latest = await connection.getLatestBlockhash('confirmed')
      tx.feePayer = publicKey; tx.recentBlockhash = latest.blockhash
      const raw = (await signTransaction(tx)).serialize()
      const sig = await connection.sendRawTransaction(raw, { maxRetries: 3 })
      for (;;) {
        await new Promise(r => setTimeout(r, 2200))
        const st = await connection.getSignatureStatus(sig)
        if (st.value?.err) throw new Error('reverted: ' + JSON.stringify(st.value.err))
        const cs = st.value?.confirmationStatus
        if (cs === 'confirmed' || cs === 'finalized') break
        if ((await connection.getBlockHeight('confirmed')) > latest.lastValidBlockHeight) throw new Error('devnet RPC dropped the tx — retry')
        try { await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 2 }) } catch {}
      }
      setMsg({ text: `${label} confirmed` }); await refresh()
    } catch (e: any) { setMsg({ text: e.message, err: true }) } finally { setBusy(null) }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="text-xs font-mono text-pitch-400 mb-2">ONE ENGINE · THREE MARKET TYPES</div>
            <h1 className="text-3xl font-bold tracking-tight">Markets</h1>
            <p className="text-slate-400 mt-2 max-w-xl">Every market — match winner, over/under, exact score — settles the same trustless way: a TxLINE proof, verified on-chain. Spin one up on any fixture.</p>
          </div>
          <WalletMultiButton className="!bg-pitch-600 hover:!bg-pitch-700 !text-xs !h-9 !rounded-lg !px-4" />
        </div>

        {msg && <div className={`mb-6 rounded-lg px-4 py-2.5 text-sm border ${msg.err ? 'border-red-900 bg-red-950/40 text-red-300' : 'border-pitch-800 bg-pitch-950/40 text-pitch-200'}`}>{msg.text}</div>}

        <CreatePanel onCreate={(fx, m, label) => send(label, createMarketTx(publicKey!, fx, m))} busy={busy} connected={!!publicKey}
          onFaucet={() => publicKey && sendFaucet(connection, publicKey).then(() => setMsg({ text: 'minted 1000 test-USDC' })).catch(e => setMsg({ text: e.message, err: true }))} />

        <div className="mt-8">
          <div className="text-xs font-mono text-slate-500 mb-3">{rows ? `${rows.length} MARKET${rows.length === 1 ? '' : 'S'} ON-CHAIN` : 'LOADING…'}</div>
          <div className="grid sm:grid-cols-2 gap-4">
            {rows?.map(m => (
              <MarketCard key={m.pubkey} m={m} busy={busy} connected={!!publicKey}
                onBet={(side, amt) => send(`bet ${side}`, betTx(new PublicKey(m.pubkey), publicKey!, side, amt))} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function CreatePanel({ onCreate, onFaucet, busy, connected }: { onCreate: (fx: number, m: NewMarket, label: string) => void; onFaucet: () => void; busy: string | null; connected: boolean }) {
  const [fixture, setFixture] = useState('')
  const [kind, setKind] = useState<NewMarket['kind']>('MatchWinner')
  const [threshold, setThreshold] = useState('2')
  const [statKey, setStatKey] = useState('3') // total goals
  const build = (): NewMarket =>
    kind === 'MatchWinner' ? { kind, team1Key: 1, team2Key: 2 } :
    kind === 'OverUnder' ? { kind, statKey: Number(statKey), threshold: Number(threshold) } :
    { kind, statKey: Number(statKey), target: Number(threshold) }
  const fx = Number(fixture)
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-slate-200">Create a market</div>
        {connected && <button onClick={onFaucet} className="text-xs text-pitch-400 hover:text-pitch-300">Get test-USDC →</button>}
      </div>
      <div className="grid sm:grid-cols-4 gap-3 items-end">
        <label className="text-xs text-slate-400">Fixture id
          <input value={fixture} onChange={e => setFixture(e.target.value)} placeholder="18257865" className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm font-mono text-slate-200 outline-none focus:border-pitch-500" />
        </label>
        <label className="text-xs text-slate-400">Type
          <select value={kind} onChange={e => setKind(e.target.value as any)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-200 outline-none focus:border-pitch-500">
            <option value="MatchWinner">Match winner</option>
            <option value="OverUnder">Over / under</option>
            <option value="ExactScore">Exact score</option>
          </select>
        </label>
        {kind !== 'MatchWinner' && (
          <>
            <label className="text-xs text-slate-400">Stat
              <select value={statKey} onChange={e => setStatKey(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-200 outline-none focus:border-pitch-500">
                <option value="3">Total goals</option>
                <option value="1">Home goals</option>
                <option value="2">Away goals</option>
                <option value="4">Corners</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">{kind === 'OverUnder' ? 'Over' : 'Exactly'}
              <input value={threshold} onChange={e => setThreshold(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm font-mono text-slate-200 outline-none focus:border-pitch-500" />
            </label>
          </>
        )}
      </div>
      <button disabled={!connected || !fx || !!busy} onClick={() => onCreate(fx, build(), 'create market')}
        className="mt-4 bg-pitch-600 hover:bg-pitch-700 disabled:opacity-40 text-sm font-semibold rounded-lg px-5 py-2">
        {busy === 'create market' ? 'Creating…' : connected ? 'Create market' : 'Connect wallet to create'}
      </button>
      <p className="text-xs text-slate-600 mt-3">Anyone can create a market. It stays open until TxLINE finalizes the fixture; then anyone (or the keeper) settles it from the proof.</p>
    </div>
  )
}

function MarketCard({ m, onBet, busy, connected }: { m: MarketRow; onBet: (side: 'YES' | 'NO', amt: number) => void; busy: string | null; connected: boolean }) {
  const [amt, setAmt] = useState('100')
  const total = m.yes + m.no
  const yesPct = total ? Math.round((m.yes / total) * 100) : 50
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-md border px-2 py-0.5 ${KIND_STYLE[m.kind]}`}>{m.kind}</span>
        <span className="text-[10px] font-mono text-slate-500">fixture {m.fixtureId}</span>
      </div>
      <div className="text-sm font-medium text-slate-100 mb-3">{m.question}</div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-1">
        <div className="h-full bg-pitch-500" style={{ width: `${yesPct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-slate-500 mb-3">
        <span>YES {fmt(m.yes)}</span><span>NO {fmt(m.no)}</span>
      </div>
      {m.state === 'Settled' ? (
        <div className={`text-sm font-semibold ${m.resolution === 'YES' ? 'text-pitch-300' : 'text-slate-300'}`}>Settled → {m.resolution}</div>
      ) : (
        <div className="mt-auto flex items-center gap-2">
          <input value={amt} onChange={e => setAmt(e.target.value)} className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 outline-none" />
          <button disabled={!connected || !!busy} onClick={() => onBet('YES', Math.round(Number(amt) * 1e6))} className="flex-1 bg-pitch-600/90 hover:bg-pitch-600 disabled:opacity-40 text-xs font-semibold rounded-lg py-1.5">YES</button>
          <button disabled={!connected || !!busy} onClick={() => onBet('NO', Math.round(Number(amt) * 1e6))} className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-xs font-semibold rounded-lg py-1.5">NO</button>
        </div>
      )}
      <a href={`/verify`} className="text-[11px] text-slate-600 hover:text-slate-400 mt-3">verify settlement →</a>
    </div>
  )
}
