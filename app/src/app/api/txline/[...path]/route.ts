import { NextResponse } from 'next/server'
import { txlineRequest } from '@/lib/txline-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED = [
  /^fixtures\/snapshot$/,
  /^scores\/snapshot\/\d+$/,
  /^odds\/snapshot\/\d+$/,
  /^scores\/historical\/\d+$/,
  /^scores\/updates\/\d+\/\d+\/\d+$/,
  /^scores\/stat-validation$/,
  /^scores\/stream$/,
  /^odds\/stream$/,
]

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/')
  if (!ALLOWED.some(rule => rule.test(path))) {
    return NextResponse.json({ error: 'TxLINE route not allowed' }, { status: 404 })
  }

  try {
    const url = new URL(request.url)
    const upstream = await txlineRequest(path, url.search)
    if (!upstream.ok) {
      return NextResponse.json({ error: `TxLINE upstream returned ${upstream.status}` }, { status: upstream.status })
    }

    if (path.endsWith('/stream')) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TxLINE proxy failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
