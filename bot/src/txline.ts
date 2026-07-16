import axios, { AxiosInstance } from 'axios'

const DEVNET_API_ORIGIN = 'https://txline-dev.txodds.com'
const DEVNET_API_BASE = `${DEVNET_API_ORIGIN}/api`

export type ScoreRecord = {
  fixtureId: number
  seq: number
  ts: number
  statusId: number
  period: number
  action: string
  homeScore?: number
  awayScore?: number
  stats?: Record<string, number>
}

export class TxlineClient {
  private http: AxiosInstance
  private jwt: string | null = null
  private apiToken: string | null = null

  constructor() {
    this.http = axios.create({
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
      baseURL: DEVNET_API_BASE,
    })
  }

  async authenticate(): Promise<{ jwt: string; apiToken: string }> {
    const authRes = await axios.post(`${DEVNET_API_ORIGIN}/auth/guest/start`)
    this.jwt = authRes.data.token

    const message = new TextEncoder().encode(`:${this.jwt}`)
    const signature = Buffer.from(
      nacl.sign.detached(message, Buffer.from(process.env.BOT_WALLET_SECRET_KEY!, 'base64'))
    ).toString('base64')

    const activateRes = await axios.post(
      `${DEVNET_API_BASE}/token/activate`,
      {
        txSig: '0000000000000000000000000000000000000000000000000000000000000000',
        walletSignature: signature,
        leagues: [],
      },
      { headers: { Authorization: `Bearer ${this.jwt}` } }
    )

    this.apiToken = activateRes.data.token || activateRes.data
    this.http.defaults.headers.common['Authorization'] = `Bearer ${this.jwt}`
    this.http.defaults.headers.common['X-Api-Token'] = this.apiToken

    return { jwt: this.jwt, apiToken: this.apiToken }
  }

  async getStatValidation(fixtureId: number, seq: number, statKeys: string) {
    const res = await this.http.get('/scores/stat-validation', {
      params: { fixtureId, seq, statKeys },
    })
    return res.data
  }

  async streamScores(
    onScore: (score: ScoreRecord) => void,
    fixtureId?: number,
    signal?: AbortSignal
  ): Promise<void> {
    const params = fixtureId ? `?fixtureId=${fixtureId}` : ''
    const res = await fetch(`${DEVNET_API_ORIGIN}/api/scores/stream${params}`, {
      headers: {
        ...this.headers,
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      signal,
    })

    if (!res.ok) throw new Error(`Stream failed: ${res.status}`)
    if (!res.body) throw new Error('No response body')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const block of parts) {
          const msg = this.parseSSE(block)
          if (msg) {
            try {
              onScore(JSON.parse(msg.data))
            } catch {
              /* skip unparseable */
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.jwt}`,
      'X-Api-Token': this.apiToken || '',
    }
  }

  private parseSSE(block: string): { data: string; event?: string } | null {
    const msg: { data: string; event?: string } = { data: '' }
    for (const line of block.split('\n')) {
      if (line.startsWith('data: ')) msg.data += line.slice(6) + '\n'
      else if (line.startsWith('event: ')) msg.event = line.slice(7)
    }
    msg.data = msg.data.trim()
    return msg.data ? msg : null
  }
}
