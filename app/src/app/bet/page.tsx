'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { ComputeBudgetProgram } from '@solana/web3.js'
import { Header } from '@/components/Header'
import { ButtonAction } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { CheckIcon, ArrowUpRight } from '@/components/ui/Mascots'
import {
  DEMO, MARKET, readMarket, usdcBalance, readDeposit,
  sendFaucet, depositTx, settleTx, claimTx, type MarketState, type Deposit,
} from '@/lib/market'

const EX = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`
const fmt = (n: number) => (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function BetPage() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction, signTransaction } = useWallet()
  const [mkt, setMkt] = useState<MarketState | null>(null)
  const [bal, setBal] = useState(0)
  const [dep, setDep] = useState<Deposit | null>(null)
  const [amount, setAmount] = useState('100')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; sig?: string; err?: boolean } | null>(null)

  const refresh = useCallback(async () => {
    setMkt(await readMarket(connection))
    if (publicKey) { setBal(await usdcBalance(connection, publicKey)); setDep(await readDeposit(connection, publicKey)) }
  }, [connection, publicKey])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { const t = setInterval(refresh, 8000); return () => clearInterval(t) }, [refresh])

  async function run(label: string, build: () => Promise<{ tx: any; signers: any[] }> | { tx: any; signers: any[] }) {
    if (!publicKey) return
    setBusy(label); setMsg(null)
    try {
      const { tx, signers } = await build()
      // Priority fee so the public devnet RPC actually includes the tx (fee-less txs
      // get dropped under load), a fresh blockhash, and the blockhash-based confirm
      // (the old 30s signature poll times out even on success).
      tx.instructions.unshift(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 300_000 }))
      const latest = await connection.getLatestBlockhash('confirmed')
      tx.feePayer = publicKey
      tx.recentBlockhash = latest.blockhash
      // Sign explicitly (co-signers first, then the wallet) so an extra signer's
      // signature can't be invalidated by a blockhash re-fetch.
      if (signers.length) tx.partialSign(...signers)
      let sig: string
      if (signTransaction) {
        // Sign once, then RE-BROADCAST the same raw tx until it confirms or the
        // blockhash expires — the free public devnet RPC drops txs, and re-sending
        // the identical signed tx (no wallet re-prompt) is what actually lands it.
        const raw = (await signTransaction(tx)).serialize()
        sig = await connection.sendRawTransaction(raw, { maxRetries: 3 })
        for (;;) {
          await new Promise(r => setTimeout(r, 2200))
          const st = await connection.getSignatureStatus(sig)
          if (st.value?.err) throw new Error('reverted on-chain: ' + JSON.stringify(st.value.err))
          const cs = st.value?.confirmationStatus
          if (cs === 'confirmed' || cs === 'finalized') break
          const h = await connection.getBlockHeight('confirmed')
          if (h > latest.lastValidBlockHeight) throw new Error('not confirmed — the public devnet RPC is dropping it. Retry, or set NEXT_PUBLIC_RPC to a dedicated devnet endpoint.')
          try { await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 2 }) } catch {}
        }
      } else {
        sig = await sendTransaction(tx, connection, { signers, maxRetries: 6 })
        const res = await connection.confirmTransaction({ signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, 'confirmed')
        if (res.value.err) throw new Error('reverted on-chain: ' + JSON.stringify(res.value.err))
      }
      setMsg({ text: `${label} confirmed`, sig })
      await refresh()
    } catch (e: any) {
      setMsg({ text: `${label} failed: ${e?.message || e}`, err: true })
    } finally { setBusy(null) }
  }

  async function doFaucet() {
    if (!publicKey) return
    setBusy('Faucet'); setMsg(null)
    try {
      const sig = await sendFaucet(connection, publicKey)   // app-signed; no wallet popup
      setMsg({ text: 'Faucet confirmed — 1,000 test-USDC', sig })
      await refresh()
    } catch (e: any) {
      setMsg({ text: `Faucet failed: ${e?.message || e}`, err: true })
    } finally { setBusy(null) }
  }

  const total = mkt ? mkt.yes + mkt.no : 0
  const yesPct = total ? Math.round((mkt!.yes / total) * 100) : 50
  const won = dep && mkt?.resolution && ((mkt.resolution === 'YES') === dep.isYes)

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-xl mx-auto px-5 py-16 sm:py-20">
        {/* intro */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-dim mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
            A real bet, end to end · devnet
          </div>
          <h1 className="font-display font-bold text-[30px] sm:text-[38px] tracking-[-0.02em] text-ink text-balance">
            Place a bet. Watch it settle itself.
          </h1>
          <p className="text-[15px] text-ink-muted leading-relaxed mt-3 max-w-lg">
            A real market on a finished World Cup match. Grab some test-USDC, back YES or NO, then
            settle it from the real result and claim your winnings. Nobody types in the outcome — the match decides it.
          </p>
        </div>

        {/* dark proof-ticket — the selected market, your position (the slip) & the on-chain result */}
        <div className="rounded-ticket bg-panel border border-panel-hairline text-panel-ink p-5 sm:p-6 shadow-card mb-4">
          {/* header: fixture + status */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <a
              href={`https://explorer.solana.com/address/${MARKET.toBase58()}?cluster=devnet`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-panel-muted hover:text-panel-ink transition-colors"
            >
              TxLINE fixture {DEMO.fixtureId}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
            <Chip status={mkt?.settled ? 'settled' : 'open'} onDark />
          </div>

          {/* scoreline */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="text-right font-display font-semibold text-[16px] truncate">{DEMO.home}</div>
            <div className="font-mono text-2xl font-medium tabular-nums text-panel-ink">
              {DEMO.realResult.g1}<span className="text-panel-muted mx-1.5">–</span>{DEMO.realResult.g2}
            </div>
            <div className="text-left font-display font-semibold text-[16px] truncate">{DEMO.away}</div>
          </div>
          <div className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-panel-muted mt-1.5 mb-5">Full time</div>

          {/* pool split */}
          <div className="flex items-center justify-between text-[12px] font-semibold mb-2">
            <span className="text-accent">YES · {DEMO.home} wins ({yesPct}%)</span>
            <span className="text-panel-muted">NO ({100 - yesPct}%)</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden bg-panel-2 flex mb-2">
            <div className="bg-accent" style={{ width: `${yesPct}%` }} />
            <div className="bg-white/15" style={{ width: `${100 - yesPct}%` }} />
          </div>
          <div className="flex justify-between font-mono text-[12px] tabular-nums text-panel-muted">
            <span>{mkt ? fmt(mkt.yes) : '—'} USDC</span>
            <span>{mkt ? fmt(mkt.no) : '—'} USDC</span>
          </div>

          {/* settled from proof */}
          {mkt?.settled && (
            <div className="mt-4 flex items-center gap-2 rounded-input bg-accent/10 px-3 py-2.5 text-[13px] text-accent">
              <CheckIcon className="w-4 h-4 shrink-0" />
              <span>Settled from the result → <b className="font-semibold">{mkt.resolution}</b></span>
            </div>
          )}

          {/* your position — the bet slip */}
          {dep && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-input bg-panel-2 px-3 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-panel-muted">Your position</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[13px] tabular-nums text-panel-ink">
                {fmt(dep.amount)} on {dep.isYes ? 'YES' : 'NO'}
                {mkt?.settled && (dep.claimed ? ' · claimed' : won ? ' · won' : ' · lost')}
                {mkt?.settled && won && !dep.claimed && <CheckIcon className="w-3.5 h-3.5 text-accent" />}
              </span>
            </div>
          )}

          {/* resulting on-chain tx */}
          {msg && (
            <div className="mt-4 pt-4 border-t border-panel-hairline flex flex-wrap items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${msg.err ? 'text-negative' : 'text-accent'}`}>
                {!msg.err && <CheckIcon className="w-4 h-4 shrink-0" />}
                {msg.text}
              </span>
              {msg.sig && (
                <a
                  href={EX(msg.sig)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[12px] tabular-nums text-panel-muted hover:text-panel-ink transition-colors"
                >
                  {msg.sig.slice(0, 6)}…{msg.sig.slice(-6)}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* light form card — the controls */}
        {!publicKey ? (
          <div className="rounded-card border border-hairline bg-surface p-5 sm:p-6">
            <p className="text-[15px] text-ink-muted mb-4">Connect a devnet wallet to bet.</p>
            <WalletMultiButton className="!bg-ink hover:!bg-black !text-white !text-sm !font-semibold !h-10 !rounded-full !px-4" />
          </div>
        ) : (
          <div className="rounded-card border border-hairline bg-surface p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Your balance</span>
              <span className="font-mono text-[15px] tabular-nums text-ink">{fmt(bal)} USDC</span>
            </div>
            <ButtonAction onClick={doFaucet} disabled={!!busy} variant="secondary" className="w-full">
              {busy === 'Faucet' ? 'Minting…' : 'Get 1,000 test-USDC'}
            </ButtonAction>

            {!mkt?.settled && (
              <>
                <div className="pt-2 border-t border-hairline" />
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted mb-2">Stake (USDC)</label>
                  <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal"
                    className="w-full bg-surface border border-hairline rounded-input px-3.5 py-2.5 font-mono text-[15px] tabular-nums text-ink placeholder:text-ink-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-accent" placeholder="amount (USDC)" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ButtonAction onClick={() => run('Bet YES', () => depositTx(publicKey, 'YES', Math.round(parseFloat(amount || '0') * 1e6)))} disabled={!!busy || !(parseFloat(amount) > 0)}
                    variant="accent" className="w-full">
                    {busy === 'Bet YES' ? '…' : `Bet YES · ${DEMO.home}`}
                  </ButtonAction>
                  <ButtonAction onClick={() => run('Bet NO', () => depositTx(publicKey, 'NO', Math.round(parseFloat(amount || '0') * 1e6)))} disabled={!!busy || !(parseFloat(amount) > 0)}
                    variant="secondary" className="w-full !text-negative !border-negative/40 hover:!bg-negative/5">
                    {busy === 'Bet NO' ? '…' : 'Bet NO'}
                  </ButtonAction>
                </div>
              </>
            )}

            <div className="pt-2 border-t border-hairline" />
            {!mkt?.settled ? (
              <ButtonAction onClick={() => run('Settle from proof', () => settleTx(publicKey))} disabled={!!busy}
                variant="secondary" className="w-full">
                {busy === 'Settle from proof' ? 'Settling from the result…' : 'Settle it from the result — anyone can'}
              </ButtonAction>
            ) : (
              <ButtonAction onClick={() => run('Claim', () => claimTx(publicKey))} disabled={!!busy || !won || dep?.claimed}
                variant="accent" className="w-full">
                {busy === 'Claim' ? 'Claiming…' : dep?.claimed ? 'Claimed' : won ? 'Claim winnings' : 'Nothing to claim'}
              </ButtonAction>
            )}
          </div>
        )}

        {/* disclaimer */}
        <p className="mt-6 text-[12px] text-ink-muted leading-relaxed">
          Devnet demo — test-USDC has no real value. When you settle, the winner is read straight from TxLINE&apos;s on-chain match data (<span className="font-mono">validate_stat</span>)
          {' '}— a tampered result just gets rejected. Each match settles once.
        </p>
      </main>
    </div>
  )
}
