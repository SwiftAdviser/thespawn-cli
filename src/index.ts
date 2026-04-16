#!/usr/bin/env node
import { Cli, z } from 'incur'
import {
  API_BASE, chainIdToSlug,
  apiGet, apiPost, formatAgent,
  isSingle,
  type SearchResponse, type CheckResponse,
} from './shared'
import { installMcpCommand } from './install-mcp'

const DEFAULT_TIERS = ['S', 'A', 'B']

Cli.create('spawnr', {
  description:
    'Find the best-of-best ERC-8004 agents across 25 chains. ' +
    '176K total agents → filtered to ~173 S/A/B tier verified-working via hard gates.',
  version: '0.1.1',
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

      const params = new URLSearchParams({
        q,
        tier: tiers.join(','),
        limit: String(c.options.limit),
      })
      if (c.options.chain) params.set('chain', c.options.chain)

      const data = await apiGet<SearchResponse>(`/api/v1/search?${params.toString()}`)
      const picked = data.agents.map(formatAgent)

      const top = picked[0]
      const ctas = top
        ? [
            { command: `install-mcp ${top.chain}/${top.id}`, description: `Install MCP for ${top.name}` },
            ...picked.slice(0, 2).map((a) => ({
              command: `show ${a.chain}/${a.id}`,
              description: `Full card for ${a.name}`,
            })),
          ]
        : []

      return c.ok(
        {
          query: q,
          filter: {
            chain: data.filter.chain ?? 'any',
            tier: data.filter.tier.join(','),
            limit: data.filter.limit,
          },
          total_returned: data.total_returned,
          agents: picked,
        },
        { cta: { commands: ctas } },
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
              command: `install-mcp ${slug}/${data.agent.agent_id}`,
              description: 'Install MCP server',
            },
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
  .command('install-mcp', installMcpCommand)
  .serve()
