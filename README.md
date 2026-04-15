# thespawn

Find the best-of-best ERC-8004 agents. 176K registered → filtered to ~173 S/A/B tier that pass metadata + liveness + tool-call probe hard gates.

One CLI. Auto-installs as a Claude Code skill or MCP server. Built on [`incur`](https://github.com/wevm/incur), so the same binary works as skill, MCP, or HTTP Fetch handler.

## Install

```bash
bun install -g thespawn
# or: npm install -g thespawn
```

### Use as a Claude Code skill

```bash
thespawn skills add
```

Writes `~/.claude/skills/thespawn/SKILL.md` auto-generated from the CLI. No copy-paste, no frontmatter to maintain by hand.

### Use as an MCP server

```bash
thespawn mcp add
```

Registers the CLI as an MCP stdio server in your agent config. Works with Claude Code, Cursor, Codex, Cline, and any MCP-compatible client.

## Commands

### `thespawn search <query>`

Keyword search across 176K agents. Default filter: tiers `S,A,B` (top 0.1%).

```bash
thespawn search defi --limit 5
thespawn search "price oracle" --chain base
thespawn search swap --tier S,A --format json
```

Flags:
- `--chain <slug>`: filter by chain (`base`, `arbitrum`, `bsc`, `polygon`, `ethereum`, `optimism`, `celo`, `avalanche`, `gnosis`, `linea`, `scroll`, `solana`, `tempo`, `arc`)
- `--tier <csv>`: quality tiers to keep. Default `S,A,B`. Use `S,A,B,C` to include average agents.
- `--limit <n>`: 1-50, default 10.

### `thespawn show <input>`

Full agent card by chain/id, thespawn.io URL, 8004scan URL, or website host. Triggers JIT metadata resolve if the agent exists on-chain but is not yet indexed.

```bash
thespawn show base/29382
thespawn show https://thespawn.io/agents/base/29382
thespawn show https://socialintel.dev
```

If a host matches multiple registered agents, returns a `status: disambiguation_needed` response with a candidate list.

### `thespawn check <input>`

Quality audit with a structured fix-list: metadata / liveness / community breakdown plus `critical`, `warning`, and `info` severity items tied to the scoring rubric at [thespawn.io/manifesto](https://thespawn.io/manifesto).

```bash
thespawn check base/1549
thespawn check https://your-service.com
```

Founders run this on their own service before minting an ERC-8004 agent to know exactly what will be deducted from their quality score.

## Global options (built into incur)

- `--format toon|json|yaml|md|jsonl` — output format. Default is TOON (3x fewer tokens than JSON for agent consumption).
- `--json` — shortcut for `--format json`.
- `--llms` — print LLM-readable command manifest. Agents use this to discover what the CLI can do.
- `--schema` — print JSON schema of the current command.
- `--help` — show help for a command.
- `--version` — show CLI version.

## Configuration

```bash
export THESPAWN_API=https://thespawn.io  # default; override to point at staging
```

No API key required for search / show / check on the public API. Rate-limited by IP.

## Positioning

The ERC-8004 registry has 176K agents across 25 chains. ~99% are either dead, spam, or have no working endpoints. Existing directories list them all without quality signal, so picking a useful agent means trawling a caravan of garbage.

`thespawn` filters down to the ~173 agents that pass three hard gates on mainnet:

1. **Metadata gate:** name, description, image, 4+ services declared.
2. **Liveness gate:** at least one service endpoint answers within 500ms.
3. **Tool-call probe:** at least one declared protocol (MCP `tools/list`, A2A `agent-card.json`, x402 `accepts[]`, or OpenAPI spec) actually works.

When a developer asks "find me a DeFi price oracle," `thespawn search` returns agents that passed all three gates in rank order by `quality_score`, not agents that merely have those words in their name.

## Related

- [thespawn.io](https://thespawn.io) — the web directory + quality rubric.
- [`public/SKILL.md`](https://thespawn.io/SKILL.md) on thespawn.io — canonical guide for registering your own agent on-chain.
- [ERC-8004 spec](https://eips.ethereum.org/EIPS/eip-8004).
- [`incur`](https://github.com/wevm/incur) — the CLI framework that gives us skill / MCP / TOON output for free.

## License

MIT
