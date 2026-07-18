'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Header } from '@/components/Header'
import {
  DEMO, MARKET, readMarket, usdcBalance, readDeposit,
  faucetTx, depositTx, settleTx, claimTx, type MarketState, type Deposit,
} from '@/lib/market'

const EX = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`
const fmt = (n: number) => (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function BetPage() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
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
      const sig = await sendTransaction(tx, connection, { signers })
      await connection.confirmTransaction(sig, 'confirmed')
      setMsg({ text: `${label} confirmed`, sig })
      await refresh()
    } catch (e: any) {
      setMsg({ text: `${label} failed: ${e?.message || e}`, err: true })
    } finally { setBusy(null) }
  }

  const total = mkt ? mkt.yes + mkt.no : 0
  const yesPct = total ? Math.round((mkt!.yes / total) * 100) : 50
  const won = dep && mkt?.resolution && ((mkt.resolution === 'YES') === dep.isYes)

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pitch-950 border border-pitch-800 text-pitch-300 text-xs mb-4">
            <span className="w-2 h-2 rounded-full bg-pitch-400" /> Devnet · real on-chain market
          </div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">Place a bet, then settle it from a proof</h1>
          <p className="text-sm text-slate-400 mt-2">
            A real market on a finished World Cup fixture. Get test-USDC, stake YES or NO, then
            settle it trustlessly from TxLINE&apos;s on-chain proof and claim. No outcome is ever entered by hand.
          </p>
        </div>

        {/* market card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">TxLINE fixture {DEMO.fixtureId}</span>
            <a href={`https://explorer.solana.com/address/${MARKET.toBase58()}?cluster=devnet`} target="_blank" rel="noreferrer" className="text-xs text-pitch-400 hover:underline font-mono">market ↗</a>
          </div>
          <div className="font-display text-xl font-semibold mb-4">{DEMO.home} <span className="text-slate-600 font-sans">vs</span> {DEMO.away}
            <span className="text-xs font-normal text-slate-500 ml-2 font-mono">FT {DEMO.realResult.g1}–{DEMO.realResult.g2}</span>
          </div>

          {/* pool bar */}
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-pitch-300 font-semibold">YES · {DEMO.home} wins ({yesPct}%)</span>
            <span className="text-slate-400 font-semibold">NO ({100 - yesPct}%)</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden bg-slate-800 flex mb-1.5">
            <div className="bg-pitch-500" style={{ width: `${yesPct}%` }} />
            <div className="bg-slate-600" style={{ width: `${100 - yesPct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>{mkt ? fmt(mkt.yes) : '—'} USDC</span>
            <span>{mkt ? fmt(mkt.no) : '—'} USDC</span>
          </div>

          {mkt?.settled && (
            <div className="mt-4 text-sm px-3 py-2 rounded-lg bg-pitch-950/60 border border-pitch-900 text-pitch-200">
              Settled from proof → resolved <b>{mkt.resolution}</b>
            </div>
          )}
        </div>

        {!publicKey ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
            <p className="text-sm text-slate-400 mb-4">Connect a devnet wallet to bet.</p>
            <WalletMultiButton className="!bg-pitch-600 hover:!bg-pitch-700 !rounded-lg" />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">your test-USDC</span>
              <span className="font-mono">{fmt(bal)} USDC</span>
            </div>
            <button onClick={() => run('Faucet', () => faucetTx(publicKey))} disabled={!!busy}
              className="w-full py-2.5 rounded-lg border border-slate-700 hover:border-pitch-600 text-sm disabled:opacity-50">
              {busy === 'Faucet' ? 'Minting…' : 'Get 1,000 test-USDC'}
            </button>

            {!mkt?.settled && (
              <>
                <div className="pt-2 border-t border-slate-800" />
                <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:border-pitch-600 outline-none" placeholder="amount (USDC)" />
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => run('Bet YES', () => depositTx(publicKey, 'YES', Math.round(parseFloat(amount || '0') * 1e6)))} disabled={!!busy || !(parseFloat(amount) > 0)}
                    className="py-3 rounded-lg bg-pitch-600 hover:bg-pitch-700 text-white text-sm font-semibold disabled:opacity-50">
                    {busy === 'Bet YES' ? '…' : `Bet YES · ${DEMO.home}`}
                  </button>
                  <button onClick={() => run('Bet NO', () => depositTx(publicKey, 'NO', Math.round(parseFloat(amount || '0') * 1e6)))} disabled={!!busy || !(parseFloat(amount) > 0)}
                    className="py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold disabled:opacity-50">
                    {busy === 'Bet NO' ? '…' : 'Bet NO'}
                  </button>
                </div>
              </>
            )}

            {dep && (
              <div className="text-xs text-slate-400 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800">
                your position: <b className={dep.isYes ? 'text-pitch-300' : 'text-slate-300'}>{fmt(dep.amount)} on {dep.isYes ? 'YES' : 'NO'}</b>
                {mkt?.settled && (dep.claimed ? ' · claimed' : won ? ' · won 🎉' : ' · lost')}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800" />
            {!mkt?.settled ? (
              <button onClick={() => run('Settle from proof', () => settleTx(publicKey))} disabled={!!busy}
                className="w-full py-2.5 rounded-lg border border-pitch-800 bg-pitch-950/40 hover:bg-pitch-950 text-pitch-200 text-sm disabled:opacity-50">
                {busy === 'Settle from proof' ? 'Fetching proof + settling…' : 'Settle from TxLINE proof (anyone can)'}
              </button>
            ) : (
              <button onClick={() => run('Claim', () => claimTx(publicKey))} disabled={!!busy || !won || dep?.claimed}
                className="w-full py-3 rounded-lg bg-pitch-600 hover:bg-pitch-700 text-white text-sm font-semibold disabled:opacity-50">
                {busy === 'Claim' ? 'Claiming…' : dep?.claimed ? 'Claimed' : won ? 'Claim winnings' : 'Nothing to claim'}
              </button>
            )}
          </div>
        )}

        {msg && (
          <div className={`mt-4 text-xs px-3 py-2.5 rounded-lg border ${msg.err ? 'border-red-900 bg-red-950/40 text-red-300' : 'border-pitch-900 bg-pitch-950/40 text-pitch-200'}`}>
            {msg.text}{msg.sig && <> · <a href={EX(msg.sig)} target="_blank" rel="noreferrer" className="underline">explorer ↗</a></>}
          </div>
        )}

        <p className="mt-6 text-[11px] text-slate-600 leading-relaxed">
          Devnet demo. Test-USDC is valueless. Settlement runs a CPI to TxLINE&apos;s <span className="font-mono">validate_stat</span>
          {' '}and derives the winner from the cryptographic verdict — a tampered proof reverts on-chain. A fixture settles once.
        </p>
      </div>
    </div>
  )
}
