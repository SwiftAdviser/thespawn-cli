import { z } from 'incur'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { API_BASE, CHAINS, apiGet, PaymentRequiredError } from './shared'
import {
  readAuth, writeAuth, claimPairToken, fetchBalance, shortenAddress, describePaymentError,
  type AuthSession,
} from './auth'

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

const BANNER = `
       \u25CB
      \u2571 \u2572    thespawn.io
      \u2572 \u2571    hiring an agent
       \u25CB
`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentDetail = {
  agent_id: number
  chain_id: number
  chain_slug: string
  name: string | null
  description: string | null
  quality_tier: string | null
  quality_score: number | null
  mcp_endpoint: string | null
  services: Array<{ name?: string; type?: string; endpoint?: string; url?: string }> | null
  url: string
}

type ToolInfo = {
  name: string
  slug: string
  configPath: string
  detected: boolean
  format: 'json' | 'toml'
}

type InstallResult = {
  tool: string
  path: string
  status: 'added' | 'updated' | 'error' | 'dry-run'
  error?: string
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

const THESPAWN_URL_RE = /thespawn\.io\/agents\/([a-z]+)\/(\d+)/

function parseInput(input: string): { chain: string; agentId: number } {
  const urlMatch = input.match(THESPAWN_URL_RE)
  if (urlMatch && urlMatch[1] && urlMatch[2]) {
    const chain: string = urlMatch[1]
    const id = Number(urlMatch[2])
    if (!(chain in CHAINS)) throw new Error(`Unknown chain "${chain}"`)
    return { chain, agentId: id }
  }

  if (/^\d+$/.test(input)) {
    throw new Error(`Specify chain: base:${input}, arbitrum:${input}, etc.`)
  }

  const parts = input.split(/[:/]/)
  if (parts.length === 2) {
    const [chain, idStr] = parts
    const id = Number(idStr)
    if (!chain || Number.isNaN(id)) throw new Error(`Invalid format. Use: base:29382 or base/29382`)
    if (!(chain in CHAINS)) throw new Error(`Unknown chain "${chain}". Valid: ${Object.keys(CHAINS).join(', ')}`)
    return { chain, agentId: id }
  }

  throw new Error(`Invalid input. Use: base:29382, base/29382, or https://thespawn.io/agents/base/29382`)
}

// ---------------------------------------------------------------------------
// MCP endpoint extraction
// ---------------------------------------------------------------------------

function extractMcpEndpoint(agent: AgentDetail): string | null {
  if (agent.mcp_endpoint) return agent.mcp_endpoint

  if (agent.services) {
    for (const svc of agent.services) {
      const label = (svc.type ?? svc.name ?? '').toLowerCase()
      if (label === 'mcp') {
        return svc.endpoint ?? svc.url ?? null
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Tool detection
// ---------------------------------------------------------------------------

function detectTools(onlySlug?: string): ToolInfo[] {
  const home = homedir()

  const tools: ToolInfo[] = [
    {
      name: 'Claude Code',
      slug: 'claude',
      configPath: join(home, '.claude.json'),
      detected: existsSync(join(home, '.claude.json')),
      format: 'json',
    },
    {
      name: 'Cursor',
      slug: 'cursor',
      configPath: join(home, '.cursor', 'mcp.json'),
      detected: existsSync(join(home, '.cursor')),
      format: 'json',
    },
    {
      name: 'Windsurf',
      slug: 'windsurf',
      configPath: join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      detected: existsSync(join(home, '.codeium', 'windsurf')),
      format: 'json',
    },
    {
      name: 'Codex',
      slug: 'codex',
      configPath: join(home, '.codex', 'config.toml'),
      detected: existsSync(join(home, '.codex', 'config.toml')),
      format: 'toml',
    },
  ]

  if (onlySlug) {
    const match = tools.find((t) => t.slug === onlySlug)
    if (!match) throw new Error(`Unknown tool "${onlySlug}". Valid: ${tools.map((t) => t.slug).join(', ')}`)
    return [match]
  }

  return tools
}

// ---------------------------------------------------------------------------
// Server name derivation
// ---------------------------------------------------------------------------

function deriveServerName(agent: AgentDetail, override?: string): string {
  if (override) return override

  const base = agent.name
    ? agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : null

  return base
    ? `spwnr-${base}`
    : `spwnr-${agent.chain_slug ?? 'agent'}-${agent.agent_id}`
}

// ---------------------------------------------------------------------------
// Config writers
// ---------------------------------------------------------------------------

function writeJsonMcp(configPath: string, serverName: string, mcpUrl: string, dryRun: boolean): InstallResult {
  const toolName = configPath.includes('.claude') ? 'Claude Code'
    : configPath.includes('.cursor') ? 'Cursor'
    : configPath.includes('windsurf') ? 'Windsurf'
    : 'Unknown'

  const shortPath = configPath.replace(homedir(), '~')

  try {
    let config: Record<string, unknown> = {}
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, 'utf-8')
      config = JSON.parse(raw)
    }

    const servers = (config.mcpServers ?? {}) as Record<string, unknown>
    const existed = serverName in servers
    const entry: Record<string, string> = { url: mcpUrl }
    if (configPath.includes('.claude')) entry.type = 'http'
    servers[serverName] = entry
    config.mcpServers = servers

    if (dryRun) {
      return { tool: toolName, path: shortPath, status: 'dry-run' }
    }

    const dir = dirname(configPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')

    return { tool: toolName, path: shortPath, status: existed ? 'updated' : 'added' }
  } catch (err) {
    return { tool: toolName, path: shortPath, status: 'error', error: String(err) }
  }
}

function writeTomlMcp(configPath: string, serverName: string, mcpUrl: string, dryRun: boolean): InstallResult {
  const shortPath = configPath.replace(homedir(), '~')

  try {
    let content = ''
    if (existsSync(configPath)) {
      content = readFileSync(configPath, 'utf-8')
    }

    const sectionHeader = `[mcp_servers.${serverName}]`
    const sectionRe = new RegExp(
      `\\[mcp_servers\\.${serverName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\][^\\[]*`,
      's',
    )
    const newSection = `${sectionHeader}\ntype = "http"\nurl = "${mcpUrl}"\n`
    const existed = sectionRe.test(content)

    if (existed) {
      content = content.replace(sectionRe, newSection)
    } else {
      content = content.trimEnd() + '\n\n' + newSection
    }

    if (dryRun) {
      return { tool: 'Codex', path: shortPath, status: 'dry-run' }
    }

    writeFileSync(configPath, content, 'utf-8')
    return { tool: 'Codex', path: shortPath, status: existed ? 'updated' : 'added' }
  } catch (err) {
    return { tool: 'Codex', path: shortPath, status: 'error', error: String(err) }
  }
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export const hireCommand = {
  description:
    'Hire an agent: writes its MCP config into your coding tools. ' +
    'Auto-detects Claude Code, Cursor, Windsurf, Codex.',
  args: z.object({
    input: z.string().describe(
      'Agent reference: "base/29382" or "https://thespawn.io/agents/base/29382"',
    ),
  }),
  options: z.object({
    only: z.string().optional().describe(
      'Install to one tool only: claude, cursor, windsurf, codex',
    ),
    name: z.string().optional().describe(
      'Override server name in config (default: thespawn-{agent-name})',
    ),
    'dry-run': z.boolean().optional().default(false).describe(
      'Preview changes without writing files',
    ),
    claim: z.string().optional().describe(
      'One-time pairing token to link this install to your thespawn.io account',
    ),
  }),
  async run(c: any) {
    console.log(BANNER)

    const { chain, agentId } = parseInput(c.args.input)

    // Resolve auth first so 402 errors can reference the user's wallet.
    let session: AuthSession | null = null
    let claimJustLinked = false
    const claimToken = c.options.claim as string | undefined
    if (claimToken) {
      const claimed = await claimPairToken(claimToken)
      if (claimed) {
        session = {
          session_token: claimed.session_token,
          user_email: claimed.user_email,
          wallet_address: claimed.wallet_address,
          linked_at: new Date().toISOString(),
        }
        writeAuth(session)
        claimJustLinked = true
      }
    }
    if (!session) session = readAuth()

    let agent: AgentDetail
    try {
      agent = await apiGet<AgentDetail>(`/api/v1/agents/${chain}/${agentId}`)
    } catch (err) {
      if (err instanceof PaymentRequiredError) {
        return c.ok(await describePaymentError(err, session))
      }
      throw err
    }
    const mcpUrl = extractMcpEndpoint(agent)
    const agentName = agent.name ?? `agent #${agent.agent_id}`
    const agentUrl = agent.url ?? `${API_BASE}/agents/${chain}/${agentId}`

    if (!mcpUrl) {
      return c.ok({
        agent: agentName,
        chain,
        id: agentId,
        tier: agent.quality_tier ?? '-',
        score: agent.quality_score !== null ? Math.round(agent.quality_score) : null,
        error: 'No MCP endpoint. This agent does not expose an MCP server.',
        url: agentUrl,
      })
    }

    const dryRun = c.options['dry-run'] ?? false
    const serverName = deriveServerName(agent, c.options.name)
    const tools = detectTools(c.options.only)

    const installed: InstallResult[] = []
    const skipped: Array<{ tool: string; reason: string }> = []

    for (const tool of tools) {
      if (!tool.detected) {
        skipped.push({ tool: tool.name, reason: 'not found' })
        continue
      }

      const result = tool.format === 'toml'
        ? writeTomlMcp(tool.configPath, serverName, mcpUrl, dryRun)
        : writeJsonMcp(tool.configPath, serverName, mcpUrl, dryRun)

      installed.push(result)
    }

    // Fetch wallet balance on the agent's chain (non-blocking, 2s timeout)
    let wallet: { address: string; address_full: string; balance: string; symbol: string; chain: string; fund_url?: string } | undefined
    if (session?.wallet_address) {
      const chainId = CHAINS[chain]
      const bal = chainId ? await fetchBalance(chainId, session.wallet_address) : null
      wallet = {
        address: shortenAddress(session.wallet_address),
        address_full: session.wallet_address,
        balance: bal?.balance ?? '—',
        symbol: bal?.symbol ?? 'USDC',
        chain,
      }
      if (bal && (bal.balance === '0.00' || bal.balance === '—')) {
        wallet.fund_url = `${API_BASE}/wallet`
      }
    }

    return c.ok({
      agent: { name: agentName, chain, id: agentId, tier: agent.quality_tier, score: agent.quality_score !== null ? Math.round(agent.quality_score) : null, mcp_endpoint: mcpUrl },
      server_name: serverName,
      installed,
      skipped,
      linked: session ? { email: session.user_email, just_linked: claimJustLinked } : undefined,
      wallet,
      url: agentUrl,
      hint: installed.some((r) => r.status === 'added' || r.status === 'updated')
        ? 'Restart your editor to connect.'
        : null,
    }, {
      cta: {
        commands: [
          ...(session ? [] : [{ command: 'login <token>', description: 'Link this hire to your account' }]),
          { command: `show ${chain}:${agentId}`, description: 'Full agent card' },
        ],
      },
    })
  },
}
