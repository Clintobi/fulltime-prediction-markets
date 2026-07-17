import axios, { AxiosInstance } from 'axios'

const DEVNET = {
  rpcUrl: 'https://api.devnet.solana.com',
  apiOrigin: 'https://txline-dev.txodds.com',
  programId: '6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J',
  txlTokenMint: '4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG',
  // Free-tier devnet API token from an on-chain subscribe (serviceLevel 1).
  // Grants read access to free World Cup / Friendlies devnet data; safe to ship.
  apiToken:
    process.env.NEXT_PUBLIC_TXLINE_API_TOKEN ||
    'txoracle_api_6f0df6e475c04668b9a3a19aa1eefda4',
}

export type Fixture = {
  FixtureId: number
  CompetitionId: number
  StartTime: string
  Participant1: string
  Participant2: string
  Participant1IsHome: boolean
  GameState?: number
  Status?: string
}

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

export type OddsRecord = {
  fixtureId: number
  ts: number
  odds: Array<{
    marketId: number
    label: string
    back: number
    lay: number
  }>
}

export class TxlineClient {
  private http: AxiosInstance
  private jwt: string | null = null
  private apiToken: string | null = null
  private apiOrigin: string

  constructor() {
    this.apiOrigin = DEVNET.apiOrigin
    this.http = axios.create({
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
      baseURL: `${this.apiOrigin}/api`,
    })
  }

  get devnet() { return DEVNET }

  async authenticate(): Promise<{ jwt: string; apiToken: string }> {
    const authRes = await axios.post(`${this.apiOrigin}/auth/guest/start`)
    this.jwt = authRes.data.token

    this.http.defaults.headers.common['Authorization'] = `Bearer ${this.jwt}`
    // The data API also requires the subscription API token on every request.
    this.setApiToken(DEVNET.apiToken)
    return { jwt: this.jwt, apiToken: this.apiToken || '' }
  }

  setApiToken(token: string) {
    this.apiToken = token
    this.http.defaults.headers.common['X-Api-Token'] = token
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.jwt}`,
      'X-Api-Token': this.apiToken || '',
      'Content-Type': 'application/json',
    }
  }

  async getFixtures(competitionId?: number): Promise<Fixture[]> {
    const params: Record<string, string> = {}
    if (competitionId) params.competitionId = String(competitionId)
    const res = await this.http.get('/fixtures/snapshot', { params })
    return res.data as Fixture[]
  }

  async getScoresSnapshot(fixtureId: number): Promise<ScoreRecord[]> {
    const res = await this.http.get(`/scores/snapshot/${fixtureId}`)
    return res.data as ScoreRecord[]
  }

  async getOddsSnapshot(fixtureId: number): Promise<OddsRecord[]> {
    const res = await this.http.get(`/odds/snapshot/${fixtureId}`)
    return res.data as OddsRecord[]
  }

  async getHistoricalScores(fixtureId: number): Promise<ScoreRecord[]> {
    const res = await this.http.get(`/scores/historical/${fixtureId}`)
    return res.data as ScoreRecord[]
  }

  async getScoreUpdates(epochDay: number, hour: number, interval: number): Promise<ScoreRecord[]> {
    const res = await this.http.get(`/scores/updates/${epochDay}/${hour}/${interval}`)
    return res.data as ScoreRecord[]
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
    const res = await fetch(`${this.apiOrigin}/api/scores/stream${params}`, {
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
          const msg = parseSSE(block)
          if (msg) {
            try { onScore(JSON.parse(msg.data)) }
            catch { /* skip unparseable */ }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async streamOdds(
    onOdds: (odds: OddsRecord) => void,
    fixtureId?: number,
    signal?: AbortSignal
  ): Promise<void> {
    const params = fixtureId ? `?fixtureId=${fixtureId}` : ''
    const res = await fetch(`${this.apiOrigin}/api/odds/stream${params}`, {
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
          const msg = parseSSE(block)
          if (msg) {
            try { onOdds(JSON.parse(msg.data)) }
            catch { /* skip */ }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

function parseSSE(block: string): { data: string; event?: string } | null {
  const msg: { data: string; event?: string } = { data: '' }
  for (const line of block.split('\n')) {
    if (line.startsWith('data: ')) msg.data += line.slice(6) + '\n'
    else if (line.startsWith('event: ')) msg.event = line.slice(7)
  }
  msg.data = msg.data.trim()
  return msg.data ? msg : null
}

export const txline = new TxlineClient()
