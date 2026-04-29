export const API_BASE = process.env.THESPAWN_API ?? 'https://thespawn.io'

export const CHAINS: Record<string, number> = {
  ethereum: 1, base: 8453, bsc: 56, polygon: 137, arbitrum: 42161,
  optimism: 10, celo: 42220, avalanche: 43114, gnosis: 100, linea: 59144,
  scroll: 534352, solana: 101, tempo: 4217, arc: 5042002,
}

export const chainIdToSlug = Object.fromEntries(
  Object.entries(CHAINS).map(([s, id]) => [id, s]),
)

export type Agent = {
  agent_id: number
  chain_id: number
  chain_slug: string
  name: string | null
  description: string | null
  image_url: string | null
  quality_score: number | null
  quality_tier: string | null
  is_verified: boolean
  agent_platform?: string | null
  url: string
}

export type BreakdownRow = { label: string; max: number; earned: number; tip: string | null }

export type Recommendation = { severity: 'critical' | 'warning' | 'info'; message: string }

export type CheckResponseSingle = {
  agent: {
    id: number
    agent_id: number
    chain_id: number
    chain_slug?: string | null
    name: string | null
    description: string | null
    image_url: string | null
  }
  scores: {
    quality_score: number
    quality_tier: string
    metadata_score: number
    liveness_score: number
    community_score: number
    metadata_breakdown?: BreakdownRow[]
    liveness_breakdown?: BreakdownRow[]
    community_breakdown?: BreakdownRow[]
  }
  liveness_checks?: unknown[]
  recommendations?: Recommendation[]
}

export type CheckResponseHost = {
  host: string | null
  candidates: Array<{
    id: number
    agent_id: number
    chain_id: number
    chain_slug?: string | null
    name: string | null
    description: string | null
    image_url: string | null
    quality_score: number | null
    quality_tier: string | null
  }>
}

export type CheckResponse = CheckResponseSingle | CheckResponseHost

export function isSingle(r: CheckResponse): r is CheckResponseSingle {
  return 'agent' in r && r.agent !== null && r.agent !== undefined
}

export type PaymentRequirement = {
  network: string
  amount: string      // human-readable, e.g. "1.00"
  symbol: string      // e.g. "USDC"
  decimals: number
  asset: string       // token contract or "native"
  payTo: string
  raw_amount: string  // base units as returned
  description?: string
}

export class PaymentRequiredError extends Error {
  constructor(public readonly requirement: PaymentRequirement, public readonly path: string) {
    super(`Payment required: ${requirement.amount} ${requirement.symbol} on ${requirement.network}`)
    this.name = 'PaymentRequiredError'
  }
}

function parseX402(body: any, path: string): PaymentRequiredError | null {
  const accepts = body?.accepts
  if (!Array.isArray(accepts) || accepts.length === 0) return null
  const a = accepts[0] as Record<string, any>
  const decimals = Number(a?.extra?.decimals ?? 6)
  const symbol = String(a?.extra?.name ?? a?.extra?.symbol ?? 'USDC')
  const raw = String(a?.maxAmountRequired ?? '0')
  const amountNum = Number(raw) / Math.pow(10, decimals)
  const amount = amountNum < 0.01 && amountNum > 0 ? '<0.01' : amountNum.toFixed(2)
  return new PaymentRequiredError({
    network: String(a?.network ?? 'unknown'),
    amount,
    symbol,
    decimals,
    asset: String(a?.asset ?? 'native'),
    payTo: String(a?.payTo ?? ''),
    raw_amount: raw,
    description: a?.description ? String(a.description) : undefined,
  }, path)
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'thespawn-cli' },
  })
  if (res.status === 402) {
    let body: any = null
    try { body = await res.json() } catch {}
    const err = parseX402(body, path)
    if (err) throw err
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: GET ${path}`)
  return res.json() as Promise<T>
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'thespawn-cli',
    },
    body: JSON.stringify(body),
  })
  if (res.status === 402) {
    let parsed: any = null
    try { parsed = await res.json() } catch {}
    const err = parseX402(parsed, path)
    if (err) throw err
  }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const err = await res.json() as { error?: string; message?: string }
      if (err?.error || err?.message) msg += `: ${err.error ?? err.message}`
    } catch {}
    throw new Error(`${msg} (POST ${path})`)
  }
  return res.json() as Promise<T>
}

export function formatAgent(a: Agent) {
  return {
    name: a.name ?? `agent #${a.agent_id}`,
    tier: a.quality_tier ?? '-',
    score: a.quality_score !== null ? Math.round(a.quality_score) : null,
    chain: a.chain_slug,
    id: a.agent_id,
    verified: a.is_verified,
    description: a.description?.slice(0, 120) ?? null,
    url: a.url,
    hire: `spawnr hire ${a.chain_slug}:${a.agent_id}`,
  }
}

export type SearchResponse = {
  query: string
  filter: { chain: string | null; tier: string[]; limit: number }
  total_returned: number
  agents: Agent[]
}
