#!/usr/bin/env node
import { Cli, z } from 'incur'
import {
  API_BASE, CHAINS, chainIdToSlug,
  apiGet, apiPost, formatAgent, normalizeAgentInput,
  isSingle, PaymentRequiredError, extractMcpEndpoint, fetchMcpTools,
  extractMetadataTools, formatServices,
  type SearchResponse, type CheckResponse, type AgentDetail,
} from './shared'
import { hireCommand } from './hire'
import {
  readAuth, writeAuth, deleteAuth, claimPairToken, fetchBalance,
  shortenAddress, describePaymentError, AUTH_PATH,
} from './auth'

async function run402Safe<T>(fn: () => Promise<T>, c: any) {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof PaymentRequiredError) {
      return c.ok(await describePaymentError(err, readAuth()))
    }
    throw err
  }
}

Cli.create('spawnr', {
  description: 'Hire verified agents into your AI workflows.',
  version: '0.4.1',
  sync: {
    include: ['skills/*'],
    suggestions: [
      'who can I hire with spawnr for lead generation?',
      'find an Instagram influencer search agent and install it into Codex',
      'check the quality score for base:29382',
    ],
  },
})
  .command('search', {
    description:
      'Search MCP-ready agents by use case. Returns the top ranked live agents.',
    args: z.object({
      query: z.string().min(2).describe('What you want the agent to do (plain English)'),
    }),
    options: z.object({
      limit: z.number().int().min(1).max(100).optional().describe('Maximum results to return (default: 10, max: 100)'),
      chain: z.string().optional().describe('Filter by chain slug, e.g. base, arbitrum, bsc, celo, tempo'),
      tier: z.string().optional().describe('Filter by comma-separated quality tiers, e.g. S,A,B'),
    }),
    examples: [
      { args: { query: 'instagram influencer finder' }, description: 'Find agents for influencer discovery' },
      { args: { query: 'mcp defi trading' }, options: { limit: 5, tier: 'S,A,B' }, description: 'Find high-quality DeFi MCP agents' },
    ],
    async run(c) {
      return run402Safe(async () => {
        const q = c.args.query
        const params = new URLSearchParams({ q, limit: String(c.options.limit ?? 10) })
        if (c.options.chain) params.set('chain', c.options.chain)
        if (c.options.tier) params.set('tier', c.options.tier)
        const data = await apiGet<SearchResponse>(`/api/v1/search?${params.toString()}`)
        const agents = data.agents.map(formatAgent)
        return c.ok({ query: q, agents })
      }, c)
    },
  })
  .command('show', {
    description:
      'Show a full agent card by chain:id, URL, or website host. Triggers JIT resolve if not indexed yet.',
    args: z.object({
      input: z.string().describe(
        'Accepted: "base:29382", "https://thespawn.io/agents/base/29382", "https://socialintel.dev"',
      ),
    }),
    examples: [
      { args: { input: 'base:29382' }, description: 'Inspect an agent by chain:id before hiring' },
      { args: { input: 'https://socialintel.dev' }, description: 'Resolve a website host to matching agents' },
    ],
    async run(c) {
      return run402Safe(async () => {
      const data = await apiPost<CheckResponse>('/api/quality-check', {
        input: normalizeAgentInput(c.args.input),
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
              ? `${list.length} agents match host "${data.host}". Pick one and re-run with "chain:id" format.`
              : `No agent found for "${c.args.input}". Either it is not registered, or use "base:29382" format.`,
          candidates: list,
        })
      }

      const slug = data.agent.chain_slug ?? chainIdToSlug[data.agent.chain_id] ?? `chain-${data.agent.chain_id}`
      const details = await apiGet<AgentDetail>(`/api/v1/agents/${slug}/${data.agent.agent_id}`)
      const mcpEndpoint = extractMcpEndpoint(details)
      const probedTools = mcpEndpoint ? await fetchMcpTools(mcpEndpoint) : []
      const tools = probedTools.length > 0 ? probedTools : extractMetadataTools(details.services)

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
        mcp_endpoint: mcpEndpoint,
        tools,
        services: formatServices(details.services, tools),
        url: `${API_BASE}/agents/${slug}/${data.agent.agent_id}`,
        hire: `spawnr hire ${slug}:${data.agent.agent_id}`,
      })
      }, c)
    },
  })
  .command('check', {
    description:
      'Audit an agent: quality score breakdown + recommendations on what to fix. ' +
      'Pass it your own service URL before minting to know what to improve.',
    args: z.object({
      input: z.string().describe(
        'Accepted: "base:29382", URL on thespawn.io, or a bare website host',
      ),
    }),
    examples: [
      { args: { input: 'base:29382' }, description: 'Audit a known agent and get score fixes' },
      { args: { input: 'https://socialintel.dev' }, description: 'Audit an agent by website host' },
    ],
    async run(c) {
      return run402Safe(async () => {
      const data = await apiPost<CheckResponse>('/api/quality-check', {
        input: normalizeAgentInput(c.args.input),
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
              ? `${list.length} agents match host "${data.host}". Pick one and re-run with "chain:id" format.`
              : `No agent found for "${c.args.input}". The URL is not registered, or try "base:29382" format.`,
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
      }, c)
    },
  })
  .command('hire', hireCommand)
  .command('whoami', {
    description: 'Show the account and wallet linked to this machine.',
    args: z.object({}),
    options: z.object({
      chain: z.string().optional().describe('Check balance on a specific chain (default: base)'),
    }),
    examples: [
      { args: {}, description: 'Show linked account and Base wallet balance' },
      { args: {}, options: { chain: 'base' }, description: 'Show linked wallet balance on Base' },
    ],
    async run(c) {
      const session = readAuth()
      if (!session) {
        return c.ok({
          linked: false,
          message: 'Not linked. Run `spawnr login <token>` or copy an install command while logged in at thespawn.io.',
          auth_path: AUTH_PATH.replace(process.env.HOME ?? '~', '~'),
        })
      }

      const chain = c.options.chain ?? 'base'
      const chainId = CHAINS[chain]
      const bal = chainId ? await fetchBalance(chainId, session.wallet_address) : null

      return c.ok({
        linked: true,
        email: session.user_email,
        wallet: {
          address: shortenAddress(session.wallet_address),
          address_full: session.wallet_address,
          chain,
          balance: bal?.balance ?? '-',
          symbol: bal?.symbol ?? 'USDC',
        },
        linked_at: session.linked_at,
      })
    },
  })
  .command('login', {
    description:
      'Link this machine to your thespawn.io account using a claim token. ' +
      'Get a token by copying any install command while logged in at thespawn.io.',
    args: z.object({
      token: z.string().min(3).describe('Claim token (starts with "c_")'),
    }),
    examples: [
      { args: { token: 'c_example' }, description: 'Link this machine with a claim token from thespawn.io' },
    ],
    async run(c) {
      const claimed = await claimPairToken(c.args.token)
      if (!claimed) {
        return c.ok({
          ok: false,
          error: 'token_expired_or_invalid',
          message: 'Token is expired, already used, or invalid. Tokens last 24 hours and work once.',
        })
      }
      const session = {
        session_token: claimed.session_token,
        user_email: claimed.user_email,
        wallet_address: claimed.wallet_address,
        linked_at: new Date().toISOString(),
      }
      writeAuth(session)
      return c.ok({
        ok: true,
        email: session.user_email,
        wallet: {
          address: shortenAddress(session.wallet_address),
          address_full: session.wallet_address,
        },
      }, {
        cta: {
          commands: [
            { command: 'whoami', description: 'Show linked account + balance' },
          ],
        },
      })
    },
  })
  .command('logout', {
    description: 'Unlink this machine from your account (deletes local session file).',
    args: z.object({}),
    examples: [
      { args: {}, description: 'Remove the local spawnr session' },
    ],
    async run(c) {
      const existed = deleteAuth()
      return c.ok({
        ok: true,
        cleared: existed,
        message: existed ? 'Session removed.' : 'No session on this machine.',
      })
    },
  })
  .serve()
