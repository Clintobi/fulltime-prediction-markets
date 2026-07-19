'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { ComputeBudgetProgram, Transaction, PublicKey } from '@solana/web3.js'
import { Header } from '@/components/Header'
import { listOffers, createOfferTx, fillOfferTx, layLiability, type OfferRow, type NewOffer } from '@/lib/exchange'
import { sendFaucet } from '@/lib/market'
import { trySponsored } from '@/lib/gasless'

const fmt = (n: number) => (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })
const S: Record<string, string> = { Open: 'text-pitch-300 border-pitch-700', Filled: 'text-indigo-300 border-indigo-800', Settled: 'text-amber-300 border-amber-800', Claimed: 'text-slate-400 border-slate-700' }

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
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
          <div>
            <div className="text-xs font-mono text-pitch-400 mb-2">PEER-TO-PEER · NO HOUSE · NO AMM</div>
            <h1 className="text-3xl font-bold tracking-tight">Exchange</h1>
          </div>
          <WalletMultiButton className="!bg-pitch-600 hover:!bg-pitch-700 !text-xs !h-9 !rounded-lg !px-4" />
        </div>
        <p className="text-slate-400 mb-6 max-w-2xl">Back a prediction at your own odds; someone lays the other side. Both stakes escrow, and the winner is decided by a <a href="/verify" className="text-pitch-400 hover:underline">TxLINE proof</a> — not a bookmaker, not an AMM that arbitrageurs drain at the whistle, not a manual ops team.</p>

        {msg && <div className={`mb-6 rounded-lg px-4 py-2.5 text-sm border ${msg.err ? 'border-red-900 bg-red-950/40 text-red-300' : 'border-pitch-800 bg-pitch-950/40 text-pitch-200'}`}>{msg.text}</div>}

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-200">Post a BACK offer</div>
            {publicKey && <button onClick={() => sendFaucet(connection, publicKey).then(() => setMsg({ text: 'minted 1000 test-USDC' })).catch(e => setMsg({ text: e.message, err: true }))} className="text-xs text-pitch-400 hover:text-pitch-300">Get test-USDC →</button>}
          </div>
          <div className="grid sm:grid-cols-5 gap-3 items-end">
            <label className="text-xs text-slate-400 sm:col-span-2">Fixture id
              <input value={form.fixtureId} onChange={e => setForm({ ...form, fixtureId: Number(e.target.value) })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm font-mono text-slate-200 outline-none focus:border-pitch-500" />
            </label>
            <label className="text-xs text-slate-400">Bet
              <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as any })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-200 outline-none focus:border-pitch-500">
                <option value="MatchWinner">Home wins</option>
                <option value="OverUnder">Total goals over…</option>
              </select>
            </label>
            {form.kind !== 'MatchWinner' && <label className="text-xs text-slate-400">Line<input value={form.threshold} onChange={e => setForm({ ...form, threshold: Number(e.target.value) })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm font-mono text-slate-200 outline-none" /></label>}
            <label className="text-xs text-slate-400">Odds ×<input value={odds} onChange={e => setForm({ ...form, oddsBps: Math.round(Number(e.target.value) * 10000) })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm font-mono text-slate-200 outline-none" /></label>
            <label className="text-xs text-slate-400">Stake<input value={form.stake} onChange={e => setForm({ ...form, stake: Number(e.target.value) })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm font-mono text-slate-200 outline-none" /></label>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="text-xs text-slate-500">win <span className="text-pitch-300 font-semibold">{(form.stake * odds).toFixed(0)}</span> · layer risks {(form.stake * (odds - 1)).toFixed(0)}</div>
            <button disabled={!publicKey || busy} onClick={create} className="ml-auto bg-pitch-600 hover:bg-pitch-700 disabled:opacity-40 text-sm font-semibold rounded-lg px-5 py-2">{busy ? 'Posting…' : 'Post offer'}</button>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-500 mb-3">{rows ? `${rows.length} OFFER${rows.length === 1 ? '' : 'S'}` : 'LOADING…'}</div>
        <div className="space-y-3">
          {rows?.map(o => {
            const odds = o.oddsBps / 10000
            return (
              <div key={o.pubkey} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold uppercase rounded-md border px-2 py-0.5 ${S[o.status]}`}>{o.status}{o.status === 'Settled' || o.status === 'Claimed' ? ` · ${o.outcomeYes ? 'BACK won' : 'LAY won'}` : ''}</span>
                    <span className="text-[10px] font-mono text-slate-500">fixture {o.fixtureId}</span>
                  </div>
                  <div className="text-sm text-slate-100 font-medium">BACK {o.question} @ {odds.toFixed(2)}×</div>
                  <div className="text-xs text-slate-500 mt-0.5">stake {fmt(o.makerStake)} · pot {fmt(o.makerStake + (o.takerLiability || layLiability(o.makerStake, o.oddsBps)))}</div>
                </div>
                {o.status === 'Open' && publicKey && o.maker !== publicKey.toBase58() && (
                  <button disabled={busy} onClick={() => run(fillOfferTx(new PublicKey(o.pubkey), publicKey), 'you took the LAY side')} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-xs font-semibold rounded-lg px-4 py-2">Lay {fmt(layLiability(o.makerStake, o.oddsBps))}</button>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
