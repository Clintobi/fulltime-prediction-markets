'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { ComputeBudgetProgram, Transaction } from '@solana/web3.js'
import { Header } from '@/components/Header'
import { ButtonAction } from '@/components/ui/Button'
import { Chip, type ChipStatus } from '@/components/ui/Chip'
import { CheckIcon } from '@/components/ui/Mascots'
import { listParlays, readConfig, createParlayTx, payoutIfWon, type ParlayRow, type Leg } from '@/lib/parlay'
import { sendFaucet } from '@/lib/market'

const fmt = (n: number) => (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })
const CHIP_STATUS: Record<string, ChipStatus> = {
  Pending: 'open', Won: 'settled', Lost: 'void', Claimed: 'settled',
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
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-content mx-auto px-5 py-16 sm:py-20">
        {/* heading */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-dim mb-3">
              <CheckIcon className="w-4 h-4" />
              Every leg has to land
            </div>
            <h1 className="font-display font-bold text-[40px] sm:text-[48px] leading-[1.05] tracking-[-0.02em] text-ink">Parlays</h1>
          </div>        </div>
        <p className="text-[15px] leading-relaxed text-ink-muted max-w-2xl mb-8">
          Stack up to 5 calls on one ticket for a bigger payout. It only pays if <em>every</em> leg lands — and each one settles from its own real result, so a losing leg can never slip through. Miss one and the ticket&apos;s done.{' '}
          {conf && <span className="text-ink"><span className="font-mono tabular-nums">{odds}×</span> per leg · reward vault <span className="font-mono tabular-nums">{fmt(conf.vault)}</span> test-USDC.</span>}
        </p>

        {msg && (
          <div className={`mb-8 flex items-center gap-2 rounded-card px-4 py-3 text-[13px] border ${msg.err ? 'border-negative/30 bg-negative/10 text-negative' : 'border-hairline bg-surface text-accent-dim'}`}>
            {!msg.err && <CheckIcon className="w-4 h-4 shrink-0 text-accent-dim" />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* builder — the dark betslip */}
        <div className="rounded-ticket bg-panel border border-panel-hairline shadow-card p-5 sm:p-6 mb-12 text-panel-ink">
          <div className="flex items-center justify-between gap-3 mb-5">
            <span className="font-display font-semibold text-[17px] text-panel-ink">Build a ticket</span>
            {publicKey && <button onClick={() => sendFaucet(connection, publicKey).then(() => setMsg({ text: 'minted 1000 test-USDC' })).catch(e => setMsg({ text: e.message, err: true }))} className="text-[12px] font-semibold text-panel-muted hover:text-panel-ink transition-colors">Get test-USDC →</button>}
          </div>
          <div className="space-y-2.5">
            {legs.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input value={l.fixtureId} onChange={e => setLeg(i, { fixtureId: Number(e.target.value) })} className="flex-1 min-w-[7rem] bg-panel-2 border border-panel-hairline rounded-input px-3 py-2 text-[13px] font-mono tabular-nums text-panel-ink placeholder:text-panel-muted outline-none focus:border-accent/60" placeholder="fixture id" />
                <select value={l.kind} onChange={e => setLeg(i, { kind: e.target.value as any })} className="flex-1 min-w-[9rem] bg-panel-2 border border-panel-hairline rounded-input px-3 py-2 text-[13px] text-panel-ink outline-none focus:border-accent/60">
                  <option value="MatchWinner">Home wins</option>
                  <option value="OverUnder">Total goals over…</option>
                  <option value="ExactScore">Total goals exactly…</option>
                </select>
                {l.kind !== 'MatchWinner' && <input value={l.threshold} onChange={e => setLeg(i, { k1: 3, threshold: Number(e.target.value) })} className="w-14 bg-panel-2 border border-panel-hairline rounded-input px-2 py-2 text-[13px] font-mono tabular-nums text-panel-ink outline-none focus:border-accent/60" />}
                <div className="flex gap-1">
                  <button onClick={() => setLeg(i, { predictedYes: true })} className={`px-3.5 py-2 text-[12px] font-semibold rounded-input transition-colors ${l.predictedYes ? 'bg-accent text-accent-ink' : 'bg-panel-2 text-panel-muted hover:text-panel-ink'}`}>YES</button>
                  <button onClick={() => setLeg(i, { predictedYes: false })} className={`px-3.5 py-2 text-[12px] font-semibold rounded-input transition-colors ${!l.predictedYes ? 'bg-negative text-white' : 'bg-panel-2 text-panel-muted hover:text-panel-ink'}`}>NO</button>
                </div>
                <button onClick={() => setLegs(legs.filter((_, j) => j !== i))} className="ml-auto w-8 h-8 flex items-center justify-center rounded-input text-lg leading-none text-panel-muted hover:text-negative hover:bg-panel-2 transition-colors" aria-label="remove leg">×</button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-panel-hairline">
            {legs.length < 5 && <button onClick={() => setLegs([...legs, { fixtureId: 18193785, kind: 'MatchWinner', k1: 1, k2: 2, threshold: 0, predictedYes: false }])} className="text-[12px] font-semibold text-panel-muted hover:text-panel-ink border border-panel-hairline rounded-full px-3.5 py-1.5 transition-colors">+ add leg</button>}
            <div className="flex items-center gap-2 text-[12px] text-panel-muted">stake <input value={stake} onChange={e => setStake(e.target.value)} className="w-20 bg-panel-2 border border-panel-hairline rounded-input px-2.5 py-1.5 font-mono tabular-nums text-[13px] text-panel-ink outline-none focus:border-accent/60" /></div>
            <div className="text-[12px] text-panel-muted">pays <span className="font-mono tabular-nums font-medium text-accent">{(Number(stake) * mult).toFixed(0)}</span> if all {legs.length} hit (<span className="font-mono tabular-nums text-panel-ink">{mult.toFixed(2)}×</span>)</div>
            <ButtonAction variant="accent" size="md" onClick={create} disabled={!publicKey || busy || !legs.length} className="ml-auto">{busy ? 'Creating…' : 'Create ticket'}</ButtonAction>
          </div>
        </div>

        {/* list */}
        <div className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.06em] text-ink-muted mb-4">{rows ? `${rows.length} TICKET${rows.length === 1 ? '' : 'S'} ON-CHAIN` : 'LOADING…'}</div>
        <div className="space-y-4">
          {rows?.map(p => (
            <div key={p.pubkey} className="rounded-ticket bg-panel border border-panel-hairline shadow-card p-5 text-panel-ink">
              <div className="flex items-center justify-between gap-3 mb-3">
                <Chip status={CHIP_STATUS[p.status] ?? 'open'} onDark>{p.status}</Chip>
                <span className="text-[12px] text-panel-muted">
                  <span className="font-mono tabular-nums text-panel-ink">{fmt(p.stake)}</span> → <span className="font-mono tabular-nums text-accent">{conf ? fmt(payoutIfWon(p.stake, p.numLegs, conf.oddsBps)) : '…'}</span> if won · <span className="font-mono tabular-nums">{p.numLegs}</span> legs
                </span>
              </div>
              <div>
                {p.legs.map((l, i) => {
                  const hit = (p.provenMask & (1 << i)) !== 0
                  return (
                    <div key={i} className={`flex items-center justify-between gap-3 py-2.5 ${i > 0 ? 'border-t border-panel-hairline' : ''}`}>
                      <span className="font-mono text-[13px] tabular-nums text-panel-ink">
                        {l.fixtureId} <span className="text-panel-muted">{l.kind === 'MatchWinner' ? (l.predictedYes ? 'home' : 'away') : l.kind === 'OverUnder' ? `o${l.threshold}` : `=${l.threshold}`}</span>
                      </span>
                      {hit
                        ? <CheckIcon className="w-4 h-4 shrink-0 text-accent" />
                        : <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-panel-hairline" />}
                    </div>
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
