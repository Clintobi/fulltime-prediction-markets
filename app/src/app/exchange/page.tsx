'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { ComputeBudgetProgram, Transaction, PublicKey } from '@solana/web3.js'
import { Header } from '@/components/Header'
import { listOffers, createOfferTx, fillOfferTx, layLiability, type OfferRow, type NewOffer } from '@/lib/exchange'
import { sendFaucet } from '@/lib/market'
import { trySponsored } from '@/lib/gasless'
import { ButtonAction } from '@/components/ui/Button'
import { Chip, type ChipStatus } from '@/components/ui/Chip'
import { CheckIcon } from '@/components/ui/Mascots'

const fmt = (n: number) => (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })
const chipFor = (s: string): ChipStatus =>
  s === 'Open' ? 'open' : s === 'Settled' || s === 'Claimed' ? 'settled' : 'live'

export default function ExchangePage() {
  const { connection } = useConnection()
  const { publicKey, signTransaction } = useWallet()
  const [rows, setRows] = useState<OfferRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)
  const [form, setForm] = useState<NewOffer>({ fixtureId: 18257739, kind: 'MatchWinner', k1: 1, k2: 2, threshold: 0, oddsBps: 20000, stake: 100 })

  const refresh = useCallback(async () => { setRows(await listOffers(connection)) }, [connection])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { const t = setInterval(refresh, 12000); return () => clearInterval(t) }, [refresh])

  async function run(tx: Transaction, ok: string) {
    if (!publicKey || !signTransaction) { setMsg({ text: 'connect a wallet', err: true }); return }
    setBusy(true); setMsg(null)
    try {
      tx.instructions.unshift(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 300_000 }))
      // Gasless first (fee-payer sponsorship) on a clone; silently falls back to
      // the pristine wallet-pays tx below if the relayer isn't configured.
      const sponsored = await trySponsored(connection, new Transaction().add(...tx.instructions), signTransaction)
      if (sponsored) { setMsg({ text: ok + ' · gasless ⚡' }); await refresh(); return }
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
        if ((await connection.getBlockHeight('confirmed')) > latest.lastValidBlockHeight) throw new Error('devnet RPC dropped it — retry')
        try { await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 2 }) } catch {}
      }
      setMsg({ text: ok }); await refresh()
    } catch (e: any) { setMsg({ text: e.message, err: true }) } finally { setBusy(false) }
  }

  const create = () => publicKey && run(createOfferTx(publicKey, Math.floor(Date.now() / 1000) % 2_000_000_000, { ...form, threshold: form.kind === 'MatchWinner' ? 0 : form.threshold, k1: form.kind === 'MatchWinner' ? 1 : 3, stake: Math.round(form.stake * 1e6) }), 'offer posted')
  const odds = form.oddsBps / 10000

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-wide mx-auto px-5 py-16 sm:py-20">
        {/* heading — light shell */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-dim mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Peer to peer · no house
            </div>
            <h1 className="font-display font-bold text-[40px] sm:text-[52px] leading-[1.05] tracking-[-0.02em] text-ink">Exchange</h1>
          </div>        </div>
        <p className="text-[15px] sm:text-[17px] leading-relaxed text-ink-muted max-w-2xl mb-8">Name your odds and back a call — someone else takes the other side. Both stakes lock in escrow, and the <a href="/verify" className="font-semibold text-accent-dim underline decoration-accent/40 underline-offset-2 hover:decoration-accent">real result</a> decides who wins. No bookie setting the line, no house edge, and no waiting on anyone to pay out.</p>

        {msg && (
          <div className={`mb-8 flex items-center gap-2 rounded-input border px-4 py-2.5 text-[14px] ${msg.err ? 'border-negative/30 bg-negative/[0.08] text-negative' : 'border-accent/30 bg-accent/10 text-accent-dim'}`}>
            {!msg.err && <CheckIcon className="w-4 h-4 text-accent-dim" />}
            <span className="font-medium">{msg.text}</span>
          </div>
        )}

        {/* post a BACK offer — light surface card */}
        <div className="rounded-card border border-hairline bg-surface shadow-card-sm p-5 sm:p-6 mb-10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-display font-semibold text-[18px] text-ink">Post a BACK offer</h2>
            {publicKey && (
              <ButtonAction variant="secondary" size="md" withArrow onClick={() => sendFaucet(connection, publicKey).then(() => setMsg({ text: 'minted 1000 test-USDC' })).catch(e => setMsg({ text: e.message, err: true }))}>
                Get test-USDC
              </ButtonAction>
            )}
          </div>
          <div className="grid sm:grid-cols-5 gap-4 items-end">
            <label className="sm:col-span-2 block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted mb-1.5">Fixture id</span>
              <input value={form.fixtureId} onChange={e => setForm({ ...form, fixtureId: Number(e.target.value) })} className="w-full rounded-input border border-hairline bg-surface px-3 py-2 text-[14px] font-mono tabular-nums text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30" />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted mb-1.5">Bet</span>
              <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as any })} className="w-full rounded-input border border-hairline bg-surface px-3 py-2 text-[14px] text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30">
                <option value="MatchWinner">Home wins</option>
                <option value="OverUnder">Total goals over…</option>
              </select>
            </label>
            {form.kind !== 'MatchWinner' && (
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted mb-1.5">Line</span>
                <input value={form.threshold} onChange={e => setForm({ ...form, threshold: Number(e.target.value) })} className="w-full rounded-input border border-hairline bg-surface px-3 py-2 text-[14px] font-mono tabular-nums text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30" />
              </label>
            )}
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted mb-1.5">Odds ×</span>
              <input value={odds} onChange={e => setForm({ ...form, oddsBps: Math.round(Number(e.target.value) * 10000) })} className="w-full rounded-input border border-hairline bg-surface px-3 py-2 text-[14px] font-mono tabular-nums text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30" />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted mb-1.5">Stake</span>
              <input value={form.stake} onChange={e => setForm({ ...form, stake: Number(e.target.value) })} className="w-full rounded-input border border-hairline bg-surface px-3 py-2 text-[14px] font-mono tabular-nums text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <div className="text-[13px] text-ink-muted">win <span className="font-mono font-semibold tabular-nums text-accent-dim">{(form.stake * odds).toFixed(0)}</span> · taker risks <span className="font-mono tabular-nums text-ink">{(form.stake * (odds - 1)).toFixed(0)}</span></div>
            <ButtonAction variant="accent" size="md" disabled={!publicKey || busy} onClick={create} className="ml-auto">{busy ? 'Posting…' : 'Post offer'}</ButtonAction>
          </div>
          <p className="mt-3 text-[12px] text-ink-muted">No SOL? We cover the network fee for you when the relay is online — otherwise your wallet pays it.</p>
        </div>

        {/* order book — dark trading-terminal panel */}
        <div className="rounded-ticket bg-panel border border-panel-hairline shadow-card text-panel-ink overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-panel-hairline">
            <div>
              <h2 className="font-display font-semibold text-[17px] text-panel-ink">Order book</h2>
              <p className="text-[12px] text-panel-muted mt-0.5">Back and lay against other fans — the result settles it</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
                <span className="inline-flex items-center gap-1.5 text-accent"><span className="w-1.5 h-1.5 rounded-full bg-accent" />Back</span>
                <span className="inline-flex items-center gap-1.5 text-negative"><span className="w-1.5 h-1.5 rounded-full bg-negative" />Lay</span>
              </div>
              <span className="font-mono text-[12px] tabular-nums text-panel-muted">{rows ? `${rows.length} OFFER${rows.length === 1 ? '' : 'S'}` : 'LOADING…'}</span>
            </div>
          </div>

          {/* column header (desktop) */}
          <div className="hidden md:grid md:grid-cols-[128px_minmax(0,1fr)_84px_96px_108px_132px] md:gap-4 px-5 py-2.5 border-b border-panel-hairline text-[11px] font-mono uppercase tracking-[0.08em] text-panel-muted">
            <span>Side</span>
            <span>Market</span>
            <span className="text-right">Odds</span>
            <span className="text-right">Stake</span>
            <span className="text-right">Pot</span>
            <span></span>
          </div>

          {rows?.map(o => {
            const odds = o.oddsBps / 10000
            return (
              <div key={o.pubkey} className="flex flex-col gap-3 md:grid md:grid-cols-[128px_minmax(0,1fr)_84px_96px_108px_132px] md:items-center md:gap-4 px-5 py-4 border-b border-panel-hairline last:border-b-0">
                {/* side + status */}
                <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-start">
                  <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">Back</span>
                  <Chip status={chipFor(o.status)} onDark>{o.status.toUpperCase()}</Chip>
                  {(o.status === 'Settled' || o.status === 'Claimed') && (
                    <span className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${o.outcomeYes ? 'text-accent' : 'text-negative'}`}>{o.outcomeYes ? 'BACK won' : 'LAY won'}</span>
                  )}
                </div>

                {/* market */}
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-panel-ink truncate">{o.question}</div>
                  <div className="mt-0.5 text-[11px] font-mono tabular-nums text-panel-muted">fixture {o.fixtureId}</div>
                </div>

                {/* odds */}
                <div className="flex items-center justify-between md:block md:text-right">
                  <span className="md:hidden text-[11px] font-mono uppercase tracking-[0.06em] text-panel-muted">Odds</span>
                  <span className="font-mono tabular-nums text-[14px] text-panel-ink">{odds.toFixed(2)}×</span>
                </div>

                {/* stake */}
                <div className="flex items-center justify-between md:block md:text-right">
                  <span className="md:hidden text-[11px] font-mono uppercase tracking-[0.06em] text-panel-muted">Stake</span>
                  <span className="font-mono tabular-nums text-[14px] text-panel-ink">{fmt(o.makerStake)}</span>
                </div>

                {/* pot */}
                <div className="flex items-center justify-between md:block md:text-right">
                  <span className="md:hidden text-[11px] font-mono uppercase tracking-[0.06em] text-panel-muted">Pot</span>
                  <span className="font-mono tabular-nums text-[14px] text-panel-ink">{fmt(o.makerStake + (o.takerLiability || layLiability(o.makerStake, o.oddsBps)))}</span>
                </div>

                {/* action: take the LAY side (negative) */}
                <div className="flex md:justify-end">
                  {o.status === 'Open' && publicKey && o.maker !== publicKey.toBase58() && (
                    <button disabled={busy} onClick={() => run(fillOfferTx(new PublicKey(o.pubkey), publicKey), 'you took the LAY side')} className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-negative px-4 py-2 text-[13px] font-semibold text-negative-ink transition-all hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel">Lay {fmt(layLiability(o.makerStake, o.oddsBps))}</button>
                  )}
                </div>
              </div>
            )
          })}

          {rows && rows.length === 0 && (
            <div className="px-5 py-14 text-center text-[13px] text-panel-muted">No open offers yet — post the first BACK above.</div>
          )}
          {!rows && (
            <div className="px-5 py-14 text-center font-mono text-[13px] text-panel-muted">Loading order book…</div>
          )}
        </div>
      </main>
    </div>
  )
}
