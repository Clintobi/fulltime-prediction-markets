'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { ComputeBudgetProgram, Transaction } from '@solana/web3.js'
import { Header } from '@/components/Header'
import { listParlays, readConfig, createParlayTx, payoutIfWon, type ParlayRow, type Leg } from '@/lib/parlay'
import { sendFaucet } from '@/lib/market'

const fmt = (n: number) => (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })
const STATUS_STYLE: Record<string, string> = {
  Pending: 'text-slate-400 border-slate-700', Won: 'text-pitch-300 border-pitch-700',
  Lost: 'text-red-400 border-red-900', Claimed: 'text-indigo-300 border-indigo-800',
}

export default function ParlayPage() {
  const { connection } = useConnection()
  const { publicKey, signTransaction } = useWallet()
  const [rows, setRows] = useState<ParlayRow[] | null>(null)
  const [conf, setConf] = useState<{ oddsBps: number; vault: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)
  const [legs, setLegs] = useState<Leg[]>([{ fixtureId: 18179549, kind: 'MatchWinner', k1: 1, k2: 2, threshold: 0, predictedYes: true }])
  const [stake, setStake] = useState('100')

  const refresh = useCallback(async () => {
    setRows(await listParlays(connection)); setConf(await readConfig(connection))
  }, [connection])
  useEffect(() => { refresh() }, [refresh])

  const odds = conf ? conf.oddsBps / 10000 : 1.9
  const mult = Math.pow(odds, legs.length)

  async function create() {
    if (!publicKey || !signTransaction) { setMsg({ text: 'connect a wallet', err: true }); return }
    setBusy(true); setMsg(null)
    try {
      const nonce = Math.floor(Date.now() / 1000) % 2_000_000_000
      const tx = createParlayTx(publicKey, nonce, legs, Math.round(Number(stake) * 1e6))
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
        if ((await connection.getBlockHeight('confirmed')) > latest.lastValidBlockHeight) throw new Error('devnet RPC dropped it — retry')
        try { await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 2 }) } catch {}
      }
      setMsg({ text: 'parlay created — anyone can now prove its legs as fixtures finalize' }); await refresh()
    } catch (e: any) { setMsg({ text: e.message, err: true }) } finally { setBusy(false) }
  }

  const setLeg = (i: number, p: Partial<Leg>) => setLegs(legs.map((l, j) => j === i ? { ...l, ...p } : l))

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
          <div>
            <div className="text-xs font-mono text-pitch-400 mb-2">EVERY LEG PROVEN ON-CHAIN</div>
            <h1 className="text-3xl font-bold tracking-tight">Parlays</h1>
          </div>
          <WalletMultiButton className="!bg-pitch-600 hover:!bg-pitch-700 !text-xs !h-9 !rounded-lg !px-4" />
        </div>
        <p className="text-slate-400 mb-6 max-w-2xl">Stack up to 5 predictions into one ticket. It only pays if <em>every</em> leg hits — and each leg is settled trustlessly by a TxLINE proof, not an admin. One miss and the ticket dies. {conf && <span className="text-slate-300">{odds}× per leg · reward vault {fmt(conf.vault)} test-USDC.</span>}</p>

        {msg && <div className={`mb-6 rounded-lg px-4 py-2.5 text-sm border ${msg.err ? 'border-red-900 bg-red-950/40 text-red-300' : 'border-pitch-800 bg-pitch-950/40 text-pitch-200'}`}>{msg.text}</div>}

        {/* builder */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-200">Build a ticket</div>
            {publicKey && <button onClick={() => sendFaucet(connection, publicKey).then(() => setMsg({ text: 'minted 1000 test-USDC' })).catch(e => setMsg({ text: e.message, err: true }))} className="text-xs text-pitch-400 hover:text-pitch-300">Get test-USDC →</button>}
          </div>
          <div className="space-y-2">
            {legs.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input value={l.fixtureId} onChange={e => setLeg(i, { fixtureId: Number(e.target.value) })} className="col-span-4 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 outline-none" placeholder="fixture id" />
                <select value={l.kind} onChange={e => setLeg(i, { kind: e.target.value as any })} className="col-span-4 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none">
                  <option value="MatchWinner">Home wins</option>
                  <option value="OverUnder">Total goals over…</option>
                  <option value="ExactScore">Total goals exactly…</option>
                </select>
                {l.kind !== 'MatchWinner' && <input value={l.threshold} onChange={e => setLeg(i, { k1: 3, threshold: Number(e.target.value) })} className="col-span-1 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs font-mono text-slate-200 outline-none" />}
                <div className={`col-span-${l.kind !== 'MatchWinner' ? 2 : 3} flex gap-1`}>
                  <button onClick={() => setLeg(i, { predictedYes: true })} className={`flex-1 text-[11px] font-semibold rounded-md py-1.5 ${l.predictedYes ? 'bg-pitch-600 text-white' : 'bg-slate-800 text-slate-400'}`}>YES</button>
                  <button onClick={() => setLeg(i, { predictedYes: false })} className={`flex-1 text-[11px] font-semibold rounded-md py-1.5 ${!l.predictedYes ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400'}`}>NO</button>
                </div>
                <button onClick={() => setLegs(legs.filter((_, j) => j !== i))} className="col-span-1 text-slate-600 hover:text-red-400 text-sm">×</button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-4">
            {legs.length < 5 && <button onClick={() => setLegs([...legs, { fixtureId: 18193785, kind: 'MatchWinner', k1: 1, k2: 2, threshold: 0, predictedYes: false }])} className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5">+ add leg</button>}
            <div className="flex items-center gap-2 text-xs text-slate-400">stake <input value={stake} onChange={e => setStake(e.target.value)} className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 font-mono text-slate-200 outline-none" /></div>
            <div className="text-xs text-slate-500">pays <span className="text-pitch-300 font-semibold">{(Number(stake) * mult).toFixed(0)}</span> if all {legs.length} hit ({mult.toFixed(2)}×)</div>
            <button disabled={!publicKey || busy || !legs.length} onClick={create} className="ml-auto bg-pitch-600 hover:bg-pitch-700 disabled:opacity-40 text-sm font-semibold rounded-lg px-5 py-2">{busy ? 'Creating…' : 'Create ticket'}</button>
          </div>
        </div>

        {/* list */}
        <div className="text-xs font-mono text-slate-500 mb-3">{rows ? `${rows.length} TICKET${rows.length === 1 ? '' : 'S'} ON-CHAIN` : 'LOADING…'}</div>
        <div className="space-y-3">
          {rows?.map(p => (
            <div key={p.pubkey} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-semibold uppercase rounded-md border px-2 py-0.5 ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                <span className="text-xs text-slate-500">{fmt(p.stake)} → <span className="text-pitch-300">{conf ? fmt(payoutIfWon(p.stake, p.numLegs, conf.oddsBps)) : '…'}</span> if won · {p.numLegs} legs</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.legs.map((l, i) => {
                  const hit = (p.provenMask & (1 << i)) !== 0
                  return (
                    <span key={i} className={`text-[11px] rounded-md border px-2 py-1 font-mono ${hit ? 'border-pitch-800 text-pitch-300 bg-pitch-950/30' : 'border-slate-700 text-slate-400'}`}>
                      {hit ? '✓ ' : ''}{l.fixtureId} {l.kind === 'MatchWinner' ? (l.predictedYes ? 'home' : 'away') : l.kind === 'OverUnder' ? `o${l.threshold}` : `=${l.threshold}`}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
