#!/usr/bin/env bun
import { Cli, z } from 'incur'

const API_BASE = process.env.THESPAWN_API ?? 'https://thespawn.io'

const CHAINS: Record<string, number> = {
  ethereum: 1, base: 8453, bsc: 56, polygon: 137, arbitrum: 42161,
  optimism: 10, celo: 42220, avalanche: 43114, gnosis: 100, linea: 59144,
  scroll: 534352, solana: 101, tempo: 4217, arc: 5042002,
}

const chainIdToSlug = Object.fromEntries(Object.entries(CHAINS).map(([s, id]) => [id, s]))

type Agent = {
  id: number
  agent_id: number
  chain_id: number
  name: string | null
  description: string | null
  image_url: string | null
  quality_score: number | null
  quality_tier: string | null
  total_score: number | null
  is_verified: boolean
  agent_platform?: string | null
}

type BreakdownRow = { label: string; max: number; earned: number; tip: string | null }

type Recommendation = { severity: 'critical' | 'warning' | 'info'; message: string }

type CheckResponseSingle = {
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

type CheckResponseHost = {
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

type CheckResponse = CheckResponseSingle | CheckResponseHost

function isSingle(r: CheckResponse): r is CheckResponseSingle {
  return 'agent' in r && r.agent !== null && r.agent !== undefined
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'thespawn-cli' },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: GET ${path}`)
  return res.json() as Promise<T>
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'thespawn-cli',
    },
    body: JSON.stringify(body),
  })
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

function formatAgent(a: Agent) {
  const slug = chainIdToSlug[a.chain_id] ?? `chain-${a.chain_id}`
  const score = a.quality_score ?? a.total_score
  return {
    name: a.name ?? `agent #${a.agent_id}`,
    tier: a.quality_tier ?? '-',
    score: score !== null ? Math.round(score as number) : null,
    chain: slug,
    id: a.agent_id,
    verified: a.is_verified,
    description: a.description?.slice(0, 120) ?? null,
    url: `${API_BASE}/agents/${slug}/${a.agent_id}`,
  }
}

function passesFilters(a: Agent, chain?: string, tiers?: string[]) {
  if (chain) {
    const wantChain = CHAINS[chain.toLowerCase()]
    if (!wantChain || a.chain_id !== wantChain) return false
  }
  if (tiers && tiers.length > 0) {
    const tier = (a.quality_tier ?? '').toUpperCase()
    if (!tiers.includes(tier)) return false
  }
  return true
}

const DEFAULT_TIERS = ['S', 'A', 'B']

Cli.create('thespawn', {
  description:
    'Find the best-of-best ERC-8004 agents across 25 chains. ' +
    '176K total agents → filtered to ~173 S/A/B tier verified-working via hard gates.',
  version: '0.1.0',
})
  .command('search', {
    description:
      'Search agents by keyword. Default filter returns only S/A/B tier (top 0.1% of 176K).',
    args: z.object({
      query: z.string().min(2).describe('Keyword to search for (name, description, services)'),
    }),
    options: z.object({
      chain: z.string().optional().describe(
        'Filter by chain slug: base, arbitrum, bsc, polygon, ethereum, ...',
      ),
      tier: z.string().optional().describe(
        'Comma-separated quality tiers. Default: S,A,B (best-of-best). Use S,A,B,C to include average.',
      ),
      limit: z.coerce.number().int().min(1).max(50).default(10).describe('Max results 1-50'),
    }),
    async run(c) {
      const q = c.args.query
      const tiers = (c.options.tier ?? DEFAULT_TIERS.join(','))
        .split(',').map((t) => t.trim().toUpperCase()).filter(Boolean)

      const raw = await apiGet<Agent[]>(`/api/agents/search?q=${encodeURIComponent(q)}`)
      const filtered = raw.filter((a) => passesFilters(a, c.options.chain, tiers))
      const picked = filtered.slice(0, c.options.limit).map(formatAgent)

      return c.ok(
        {
          query: q,
          filter: {
            chain: c.options.chain ?? 'any',
            tier: tiers.join(','),
          },
          total_returned: picked.length,
          total_before_filter: raw.length,
          agents: picked,
        },
        {
          cta: {
            commands: picked.slice(0, 2).map((a) => ({
              command: `show ${a.chain}/${a.id}`,
              description: `Full card for ${a.name}`,
            })),
          },
        },
      )
    },
  })
  .command('show', {
    description:
      'Show a full agent card by URL, chain/id, or website host. Triggers JIT resolve if not indexed yet.',
    args: z.object({
      input: z.string().describe(
        'Accepted: "base/29382", "https://thespawn.io/agents/base/29382", "https://socialintel.dev"',
      ),
    }),
    async run(c) {
      const data = await apiPost<CheckResponse>('/api/quality-check', {
        input: c.args.input,
      })

      if (!isSingle(data)) {
        const list = data.candidates.slice(0, 5).map((a) => {
          const slug = a.chain_slug ?? chainIdToSlug[a.chain_id] ?? `chain-${a.chain_id}`
          return {
            chain: slug,
            id: a.agent_id,
            name: a.name ?? `agent #${a.agent_id}`,
            tier: a.quality_tier ?? '-',
            score: a.quality_score !== null ? Math.round(a.quality_score) : null,
            url: `${API_BASE}/agents/${slug}/${a.agent_id}`,
          }
        })
        return c.ok({
          status: list.length > 0 ? 'disambiguation_needed' : 'not_found',
          host: data.host,
          message:
            list.length > 0
              ? `${list.length} agents match host "${data.host}". Pick one and re-run with "chain/id" format.`
              : `No ERC-8004 agent found for "${c.args.input}". Either it is not registered, or use "base/29382" format.`,
          candidates: list,
        })
      }

      const slug = data.agent.chain_slug ?? chainIdToSlug[data.agent.chain_id] ?? `chain-${data.agent.chain_id}`
      return c.ok({
        name: data.agent.name ?? `agent #${data.agent.agent_id}`,
        tier: data.scores.quality_tier,
        score: Math.round(data.scores.quality_score),
        chain: slug,
        id: data.agent.agent_id,
        description: data.agent.description,
        breakdown: {
          metadata: Math.round(data.scores.metadata_score),
          liveness: Math.round(data.scores.liveness_score),
          community: Math.round(data.scores.community_score),
        },
        url: `${API_BASE}/agents/${slug}/${data.agent.agent_id}`,
      }, {
        cta: {
          commands: [
            {
              command: `check ${slug}/${data.agent.agent_id}`,
              description: 'Audit with fix-list',
            },
          ],
        },
      })
    },
  })
  .command('check', {
    description:
      'Audit an agent: quality score breakdown + recommendations on what to fix. ' +
      'Pass it your own service URL before minting to know what to improve.',
    args: z.object({
      input: z.string().describe(
        'Accepted: "base/29382", URL on thespawn.io, or a bare website host',
      ),
    }),
    async run(c) {
      const data = await apiPost<CheckResponse>('/api/quality-check', {
        input: c.args.input,
      })

      if (!isSingle(data)) {
        const list = data.candidates.slice(0, 5).map((a) => {
          const slug = a.chain_slug ?? chainIdToSlug[a.chain_id] ?? `chain-${a.chain_id}`
          return {
            chain: slug,
            id: a.agent_id,
            name: a.name ?? `agent #${a.agent_id}`,
            tier: a.quality_tier ?? '-',
            url: `${API_BASE}/agents/${slug}/${a.agent_id}`,
          }
        })
        return c.ok({
          status: list.length > 0 ? 'disambiguation_needed' : 'not_found',
          host: data.host,
          message:
            list.length > 0
              ? `${list.length} agents match host "${data.host}". Pick one and re-run with "chain/id" format.`
              : `No ERC-8004 agent found for "${c.args.input}". The URL is not registered, or try "base/29382" format.`,
          candidates: list,
        })
      }

      const slug = data.agent.chain_slug ?? chainIdToSlug[data.agent.chain_id] ?? `chain-${data.agent.chain_id}`

      const fixes = (data.recommendations ?? []).map((r) => ({
        severity: r.severity,
        fix: r.message,
      }))

      const tipsFromBreakdowns = [
        ...(data.scores.metadata_breakdown ?? []),
        ...(data.scores.liveness_breakdown ?? []),
        ...(data.scores.community_breakdown ?? []),
      ]
        .filter((r) => r.tip && r.earned < r.max)
        .map((r) => ({ severity: 'info' as const, fix: `${r.label} (${r.earned}/${r.max}): ${r.tip}` }))

      const all = [...fixes, ...tipsFromBreakdowns]

      return c.ok({
        agent: data.agent.name ?? `agent #${data.agent.agent_id}`,
        chain: slug,
        id: data.agent.agent_id,
        tier: data.scores.quality_tier,
        score: Math.round(data.scores.quality_score),
        breakdown: {
          metadata: Math.round(data.scores.metadata_score),
          liveness: Math.round(data.scores.liveness_score),
          community: Math.round(data.scores.community_score),
        },
        fixes: all.length ? all : [{ severity: 'info' as const, fix: 'No major issues. Agent is in good shape.' }],
        url: `${API_BASE}/agents/${slug}/${data.agent.agent_id}`,
      })
    },
  })
  .serve()
