'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { ComputeBudgetProgram, Transaction, PublicKey } from '@solana/web3.js'
import { Header } from '@/components/Header'
import { Chip } from '@/components/ui/Chip'
import { ButtonAction } from '@/components/ui/Button'
import { CheckIcon, ArrowRight } from '@/components/ui/Mascots'
import { listMarkets, createMarketTx, betTx, type MarketRow, type NewMarket } from '@/lib/markets'
import { sendFaucet } from '@/lib/market'

const EX = (s: string) => `https://explorer.solana.com/address/${s}?cluster=devnet`
const fmt = (n: number) => (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })

const KIND_STYLE: Record<string, string> = {
  MatchWinner: 'border-hairline bg-bg text-ink-muted',
  OverUnder: 'border-hairline bg-bg text-ink-muted',
  ExactScore: 'border-hairline bg-bg text-ink-muted',
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
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-wide mx-auto px-5 py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-dim mb-2">Three ways to call a match</div>
            <h1 className="font-display font-bold text-[32px] sm:text-[40px] tracking-[-0.02em] text-ink">Markets</h1>
            <p className="text-ink-muted mt-3 max-w-xl text-[15px] leading-relaxed">Back a winner, an over/under, or an exact score. However you call it, your payout settles from the real result — and you can check it on-chain. Open a market on any fixture in seconds.</p>
          </div>        </div>

        {msg && <div className={`mb-6 rounded-input px-4 py-2.5 text-sm border ${msg.err ? 'border-negative/30 bg-negative/10 text-negative' : 'border-accent/40 bg-accent/10 text-accent-dim'}`}>{msg.text}</div>}

        <CreatePanel onCreate={(fx, m, label) => send(label, createMarketTx(publicKey!, fx, m))} busy={busy} connected={!!publicKey}
          onFaucet={() => publicKey && sendFaucet(connection, publicKey).then(() => setMsg({ text: 'minted 1000 test-USDC' })).catch(e => setMsg({ text: e.message, err: true }))} />

        <div className="mt-10">
          <div className="font-mono text-[12px] tabular-nums tracking-wide text-ink-muted mb-3">{rows ? `${rows.length} MARKET${rows.length === 1 ? '' : 'S'} ON-CHAIN` : 'LOADING…'}</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    <div className="rounded-card border border-hairline bg-surface p-5 shadow-card-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="font-display font-semibold text-[18px] tracking-[-0.01em] text-ink">Create a market</div>
        {connected && <button onClick={onFaucet} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-dim hover:text-accent-dim/80 transition-colors">Get test-USDC<ArrowRight className="w-3.5 h-3.5" /></button>}
      </div>
      <div className="grid sm:grid-cols-4 gap-3 items-end">
        <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Fixture id
          <input value={fixture} onChange={e => setFixture(e.target.value)} placeholder="18257865" className="mt-1 w-full bg-bg border border-hairline rounded-input px-2.5 py-2 text-sm font-mono tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
        </label>
        <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Type
          <select value={kind} onChange={e => setKind(e.target.value as any)} className="mt-1 w-full bg-bg border border-hairline rounded-input px-2.5 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <option value="MatchWinner">Match winner</option>
            <option value="OverUnder">Over / under</option>
            <option value="ExactScore">Exact score</option>
          </select>
        </label>
        {kind !== 'MatchWinner' && (
          <>
            <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Stat
              <select value={statKey} onChange={e => setStatKey(e.target.value)} className="mt-1 w-full bg-bg border border-hairline rounded-input px-2.5 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <option value="3">Total goals</option>
                <option value="1">Home goals</option>
                <option value="2">Away goals</option>
                <option value="4">Corners</option>
              </select>
            </label>
            <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{kind === 'OverUnder' ? 'Over' : 'Exactly'}
              <input value={threshold} onChange={e => setThreshold(e.target.value)} className="mt-1 w-full bg-bg border border-hairline rounded-input px-2.5 py-2 text-sm font-mono tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
            </label>
          </>
        )}
      </div>
      <ButtonAction variant="accent" disabled={!connected || !fx || !!busy} onClick={() => onCreate(fx, build(), 'create market')} className="mt-4">
        {busy === 'create market' ? 'Creating…' : connected ? 'Create market' : 'Connect wallet to create'}
      </ButtonAction>
      <p className="text-[12px] text-ink-muted leading-relaxed mt-3">Anyone can open a market. It stays live until the match is final — then it settles itself from the result. No approval, no waiting on us.</p>
    </div>
  )
}

function MarketCard({ m, onBet, busy, connected }: { m: MarketRow; onBet: (side: 'YES' | 'NO', amt: number) => void; busy: string | null; connected: boolean }) {
  const [amt, setAmt] = useState('100')
  const total = m.yes + m.no
  const yesPct = total ? Math.round((m.yes / total) * 100) : 50
  return (
    <div className={`rounded-card border bg-surface p-4 flex flex-col transition-all ${m.state === 'Settled' ? 'border-accent/40 shadow-card-sm' : 'border-hairline hover:border-ink/15 hover:shadow-card-sm'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center rounded-tag border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${KIND_STYLE[m.kind]}`}>{m.kind}</span>
        <Chip status={m.state === 'Settled' ? 'settled' : 'open'} />
      </div>
      <div className="font-display font-semibold text-[15px] text-ink leading-snug mb-1">{m.question}</div>
      <div className="font-mono text-[11px] tabular-nums text-ink-muted mb-3">fixture {m.fixtureId}</div>
      <div className="h-1.5 rounded-full bg-hairline overflow-hidden mb-1.5">
        <div className="h-full bg-accent rounded-full" style={{ width: `${yesPct}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[11px] tabular-nums mb-3">
        <span className="text-accent-dim">YES {fmt(m.yes)}</span><span className="text-ink-muted">NO {fmt(m.no)}</span>
      </div>
      {m.state === 'Settled' ? (
        <div className="mt-auto flex items-center gap-1.5">
          <CheckIcon className="w-4 h-4 text-accent-dim" />
          <span className={`text-[14px] font-semibold ${m.resolution === 'YES' ? 'text-accent-dim' : 'text-ink'}`}>Settled → {m.resolution}</span>
        </div>
      ) : (
        <div className="mt-auto flex items-center gap-2">
          <input value={amt} onChange={e => setAmt(e.target.value)} className="w-16 bg-bg border border-hairline rounded-input px-2 py-1.5 text-xs font-mono tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          <button disabled={!connected || !!busy} onClick={() => onBet('YES', Math.round(Number(amt) * 1e6))} className="flex-1 bg-accent text-accent-ink hover:bg-accent-dim disabled:opacity-40 text-xs font-semibold rounded-full py-1.5 transition-colors">YES</button>
          <button disabled={!connected || !!busy} onClick={() => onBet('NO', Math.round(Number(amt) * 1e6))} className="flex-1 bg-negative text-white hover:bg-negative/90 disabled:opacity-40 text-xs font-semibold rounded-full py-1.5 transition-colors">NO</button>
        </div>
      )}
      <a href={`/verify`} className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink mt-3">verify settlement<ArrowRight className="w-3.5 h-3.5" /></a>
    </div>
  )
}
