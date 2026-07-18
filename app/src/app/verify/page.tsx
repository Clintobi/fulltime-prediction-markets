'use client'

import { useEffect, useMemo, useState } from 'react'
import { Connection } from '@solana/web3.js'
import { verifySettle, VerifyResult, GENUINE } from '@/lib/verify'

const RPC = process.env.NEXT_PUBLIC_RPC || 'https://api.devnet.solana.com'
const EX = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`
const fmtUsdc = (n: number) => (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function VerifyPage() {
  const conn = useMemo(() => new Connection(RPC, 'confirmed'), [])
  const [sig, setSig] = useState(GENUINE[0].sig)
  const [res, setRes] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function run(s: string) {
    setLoading(true); setRes(null)
    try { setRes(await verifySettle(conn, s)) } finally { setLoading(false) }
  }
  useEffect(() => { run(GENUINE[0].sig) /* eslint-disable-next-line */ }, [])

  const trustless = res && res.cpiIntoTxline && res.ranValidateStat && res.returnDataB64 != null && res.resolution != null

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono text-pitch-400 mb-2">PROOF, NOT TRUST</div>
        <h1 className="text-3xl font-bold tracking-tight">Verify a settlement</h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Every Fulltime market resolves from a cryptographic TxLINE proof — the outcome is
          derived on-chain from TxLINE&apos;s own <span className="font-mono text-slate-300">validate_stat</span> verdict,
          never chosen by whoever settles. Paste any settle transaction and watch the chain reconstruct itself.
        </p>
      </div>

      {/* preset genuine txs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {GENUINE.map(g => (
          <button key={g.sig} onClick={() => { setSig(g.sig); run(g.sig) }}
            className={`text-xs font-semibold rounded-lg px-3 py-2 border transition ${sig === g.sig ? 'border-pitch-500 bg-pitch-950 text-pitch-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
            {g.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-8">
        <input value={sig} onChange={e => setSig(e.target.value)}
          spellCheck={false}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-xs font-mono text-slate-300 focus:border-pitch-500 outline-none"
          placeholder="Paste a settle transaction signature…" />
        <button onClick={() => run(sig)} disabled={loading}
          className="bg-pitch-600 hover:bg-pitch-700 disabled:opacity-50 text-sm font-semibold rounded-lg px-5">
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </div>

      {res?.error && (
        <div className="border border-red-900 bg-red-950/40 rounded-xl p-4 text-sm text-red-300">{res.error}</div>
      )}

      {res && !res.error && (
        <div className="space-y-6">
          {/* verdict banner */}
          <div className={`rounded-2xl border p-6 ${trustless ? 'border-pitch-700 bg-pitch-950/40' : 'border-amber-800 bg-amber-950/30'}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs font-mono text-slate-400 mb-1">
                  {res.fixtureId != null ? `FIXTURE ${res.fixtureId}` : 'SETTLEMENT'}
                </div>
                <div className="text-2xl font-bold">
                  {trustless ? 'Trustlessly settled' : 'Could not fully verify'}
                  {res.resolution && <span className={`ml-3 text-lg ${res.resolution === 'YES' ? 'text-pitch-300' : 'text-slate-300'}`}>→ {res.resolution}</span>}
                </div>
              </div>
              {res.verdictByte != null && (
                <div className="text-right">
                  <div className="text-xs text-slate-500 font-mono">TxLINE verdict</div>
                  <div className="font-mono text-lg text-slate-200">{res.returnDataB64} = 0x{res.verdictByte.toString(16).padStart(2, '0')}</div>
                </div>
              )}
            </div>
          </div>

          {/* the trust chain */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-xs font-mono text-slate-500 mb-4">THE TRUST CHAIN (reconstructed from public devnet state)</div>
            <ol className="space-y-3">
              {res.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className={`mt-0.5 flex-none w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${s.ok ? 'bg-pitch-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    {s.ok ? '✓' : '·'}
                  </span>
                  <div>
                    <div className={`text-sm font-medium ${s.ok ? 'text-slate-200' : 'text-slate-400'}`}>{s.label}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* flow diagram */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 overflow-x-auto">
            <div className="text-xs font-mono text-slate-500 mb-4">EXECUTION FLOW</div>
            <div className="flex items-center gap-2 text-xs font-mono whitespace-nowrap min-w-max">
              <Node title="Fulltime" sub="settle()" tone="pitch" />
              <Arrow label="CPI" />
              <Node title="TxLINE" sub="validate_stat" tone={res.ranValidateStat ? 'pitch' : 'slate'} />
              <Arrow label="Merkle ✓" />
              <Node title="verdict" sub={res.verdictByte != null ? `0x0${res.verdictByte}` : '—'} tone={res.returnDataB64 ? 'pitch' : 'slate'} />
              <Arrow label="derive" />
              <Node title="resolution" sub={res.resolution || '—'} tone={res.resolution ? 'pitch' : 'slate'} />
            </div>
          </div>

          {/* facts */}
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <Fact label="Market pool">{fmtUsdc(res.yesPool)} YES · {fmtUsdc(res.noPool)} NO (test-USDC)</Fact>
            <Fact label="State">{res.settled ? 'Settled' : 'Open'}</Fact>
            <Fact label="Checked against roots" mono>{res.merkleRoots ? res.merkleRoots.slice(0, 20) + '…' : '—'}</Fact>
            <Fact label="Transaction"><a className="text-pitch-400 hover:underline" href={EX(res.sig)} target="_blank" rel="noreferrer">View on Explorer ↗</a></Fact>
          </div>

          <p className="text-xs text-slate-600">
            No <span className="font-mono">admin_settle</span>, no owner override, no oracle you have to trust — the market can only
            reach <span className="font-mono">Settled</span> through a valid TxLINE proof. A tampered proof reverts inside{' '}
            <span className="font-mono">validate_stat</span>.
          </p>
        </div>
      )}
    </main>
  )
}

function Node({ title, sub, tone }: { title: string; sub: string; tone: 'pitch' | 'slate' }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${tone === 'pitch' ? 'border-pitch-700 bg-pitch-950/50' : 'border-slate-700 bg-slate-900'}`}>
      <div className={`font-semibold ${tone === 'pitch' ? 'text-pitch-200' : 'text-slate-400'}`}>{title}</div>
      <div className="text-slate-500">{sub}</div>
    </div>
  )
}
function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center text-slate-600 px-1">
      <span className="text-[10px]">{label}</span>
      <span className="text-slate-600">→</span>
    </div>
  )
}
function Fact({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-slate-200 ${mono ? 'font-mono text-xs' : ''}`}>{children}</div>
    </div>
  )
}
