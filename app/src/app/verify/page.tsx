'use client'

import { useEffect, useMemo, useState } from 'react'
import { Connection } from '@solana/web3.js'
import { verifySettle, VerifyResult, GENUINE } from '@/lib/verify'
import { Header } from '@/components/Header'
import { ButtonAction } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { CheckIcon, ArrowUpRight } from '@/components/ui/Mascots'

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
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-4xl mx-auto px-5 py-14 sm:py-16">
        <div className="mb-10">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-dim mb-3">
            <CheckIcon className="w-4 h-4" />
            Don&apos;t trust us — check us
          </div>
          <h1 className="font-display font-bold text-[36px] sm:text-[44px] tracking-[-0.02em] text-ink">Check any payout yourself</h1>
          <p className="text-ink-muted mt-3 max-w-2xl text-[15px] leading-relaxed">
            Every payout is decided on-chain by the real match data — not by whoever clicks settle.
            Paste any settled bet below and watch the whole thing rebuild itself, step by step, straight from
            TxLINE&apos;s <span className="font-mono text-ink">validate_stat</span> verdict.
          </p>
        </div>

        {/* preset genuine txs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {GENUINE.map(g => (
            <button key={g.sig} onClick={() => { setSig(g.sig); run(g.sig) }}
              className={`text-xs font-semibold rounded-full px-3.5 py-2 border transition ${sig === g.sig ? 'border-ink bg-ink text-white' : 'border-hairline text-ink-muted hover:border-ink/40 hover:text-ink'}`}>
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-10">
          <input value={sig} onChange={e => setSig(e.target.value)}
            spellCheck={false}
            className="flex-1 bg-surface border border-hairline rounded-input px-3 py-2.5 text-[13px] font-mono text-ink placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent outline-none transition"
            placeholder="Paste a settle transaction signature…" />
          <ButtonAction onClick={() => run(sig)} disabled={loading} variant="accent">
            {loading ? 'Verifying…' : 'Verify'}
          </ButtonAction>
        </div>

        {res?.error && (
          <div className="border border-negative/30 bg-negative/10 rounded-card p-4 text-sm text-negative">{res.error}</div>
        )}

        {res && !res.error && (
          <div className="space-y-6">
            {/* verdict banner — dark proof-ticket */}
            <div className="rounded-ticket bg-panel border border-panel-hairline p-6 text-panel-ink shadow-card">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-panel-muted mb-1">
                    {res.fixtureId != null ? `FIXTURE ${res.fixtureId}` : 'SETTLEMENT'}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="font-display font-bold text-2xl text-panel-ink">
                      {trustless ? 'Trustlessly settled' : 'Could not fully verify'}
                      {res.resolution && <span className={`ml-3 text-lg font-mono ${res.resolution === 'YES' ? 'text-accent' : 'text-panel-ink'}`}>→ {res.resolution}</span>}
                    </div>
                    {trustless && <Chip status="settled" onDark />}
                  </div>
                </div>
                {res.verdictByte != null && (
                  <div className="text-right">
                    <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-panel-muted">TxLINE verdict</div>
                    <div className="font-mono text-lg text-panel-ink">{res.returnDataB64} = 0x{res.verdictByte.toString(16).padStart(2, '0')}</div>
                  </div>
                )}
              </div>
            </div>

            {/* the trust chain — dark proof reconstruction */}
            <div className="rounded-ticket bg-panel border border-panel-hairline p-6 text-panel-ink shadow-card">
              <div className="font-mono text-[11px] text-panel-muted mb-4">THE TRUST CHAIN (reconstructed from public devnet state)</div>
              <ol className="space-y-3">
                {res.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex-none w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${s.ok ? 'bg-accent text-accent-ink' : 'bg-panel-2 text-panel-muted'}`}>
                      {s.ok ? <CheckIcon className="w-3 h-3" /> : '·'}
                    </span>
                    <div>
                      <div className={`text-sm font-medium ${s.ok ? 'text-panel-ink' : 'text-panel-muted'}`}>{s.label}</div>
                      <div className="text-[12px] text-panel-muted font-mono mt-0.5">{s.detail}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* flow diagram — dark execution flow */}
            <div className="rounded-ticket bg-panel border border-panel-hairline p-6 overflow-x-auto text-panel-ink shadow-card">
              <div className="font-mono text-[11px] text-panel-muted mb-4">EXECUTION FLOW</div>
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

            {/* facts — light cards */}
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Fact label="Market pool">{fmtUsdc(res.yesPool)} YES · {fmtUsdc(res.noPool)} NO (test-USDC)</Fact>
              <Fact label="State">{res.settled ? 'Settled' : 'Open'}</Fact>
              <Fact label="Checked against roots" mono>{res.merkleRoots ? res.merkleRoots.slice(0, 20) + '…' : '—'}</Fact>
              <Fact label="Transaction"><a className="inline-flex items-center gap-1 text-accent-dim font-semibold hover:underline" href={EX(res.sig)} target="_blank" rel="noreferrer">View on Explorer <ArrowUpRight className="w-3.5 h-3.5" /></a></Fact>
            </div>

            <p className="text-[13px] text-ink-muted leading-relaxed">
              No admin button, no owner override, no oracle you have to trust — a bet only reaches{' '}
              <span className="font-mono text-ink">Settled</span> when the real result proves it. Tamper with the
              data and it&apos;s rejected on the spot.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

function Node({ title, sub, tone }: { title: string; sub: string; tone: 'pitch' | 'slate' }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${tone === 'pitch' ? 'border-accent/40 bg-accent/10' : 'border-panel-hairline bg-panel-2'}`}>
      <div className={`font-semibold ${tone === 'pitch' ? 'text-accent' : 'text-panel-muted'}`}>{title}</div>
      <div className="text-panel-muted">{sub}</div>
    </div>
  )
}
function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center text-panel-muted px-1">
      <span className="text-[10px]">{label}</span>
      <span className="text-panel-muted">→</span>
    </div>
  )
}
function Fact({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-card border border-hairline bg-surface px-4 py-3">
      <div className="text-[12px] text-ink-muted mb-1">{label}</div>
      <div className={`text-ink ${mono ? 'font-mono text-xs' : ''}`}>{children}</div>
    </div>
  )
}
