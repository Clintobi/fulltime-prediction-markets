import 'server-only'

const ORIGIN = process.env.TXLINE_API_ORIGIN || 'https://txline-dev.txodds.com'

let guestToken: string | null = null
let guestTokenPromise: Promise<string> | null = null

async function authenticate(): Promise<string> {
  if (guestToken) return guestToken
  if (!guestTokenPromise) {
    guestTokenPromise = fetch(`${ORIGIN}/auth/guest/start`, {
      method: 'POST',
      cache: 'no-store',
    }).then(async response => {
      if (!response.ok) throw new Error(`TxLINE authentication failed (${response.status})`)
      const body = await response.json()
      if (typeof body.token !== 'string' || !body.token) throw new Error('TxLINE returned no guest token')
      guestToken = body.token
      return body.token
    }).finally(() => { guestTokenPromise = null })
  }
  return guestTokenPromise
}

export async function txlineRequest(path: string, search = ''): Promise<Response> {
  const apiToken = process.env.TXLINE_API_TOKEN
  if (!apiToken) throw new Error('TXLINE_API_TOKEN is not configured')

  const request = async () => fetch(`${ORIGIN}/api/${path}${search}`, {
    headers: {
      Authorization: `Bearer ${await authenticate()}`,
      'X-Api-Token': apiToken,
      Accept: path.endsWith('/stream') ? 'text/event-stream' : 'application/json',
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  })

  let response = await request()
  if (response.status === 401) {
    guestToken = null
    response = await request()
  }
  return response
}
