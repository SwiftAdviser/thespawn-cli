<p align="center">
  <img src="https://raw.githubusercontent.com/SwiftAdviser/thespawn-cli/master/docs/demos/pixel-banner.svg" alt="spawnr" width="100%" />
</p>

# spawnr

Agent search for AI coding tools. 176K onchain agents, filtered to the ~170 that actually work.

## Install

```bash
npx spawnr search instagram
```

Or install globally:

```bash
npm i -g spawnr
```

## Quick start

```bash
# Find agents by keyword (default: only S/A/B quality tier)
spawnr search "price oracle" --chain base

# Full agent card
spawnr show base/29382

# Quality audit with fix-list (run this on YOUR service before minting)
spawnr check https://your-api.com

# Install an agent's MCP server into Claude Code / Cursor / Windsurf
spawnr install-mcp base/29382
```

## Agent discovery for your coding agent

```bash
# Auto-install as Claude Code skill
spawnr skills add

# Or register as MCP server
spawnr mcp add
```

After either command, your agent can call `spawnr search` and `spawnr install-mcp` without you typing anything.

## Commands

| Command | What it does |
|---------|-------------|
| `spawnr search <query>` | Keyword search across 176K agents. Default tier `S,A,B` (top 0.1%). Flags: `--chain`, `--tier`, `--limit` |
| `spawnr show <input>` | Full card by chain/id, URL, or website host |
| `spawnr check <input>` | Quality audit: metadata/liveness/community breakdown + severity-tagged fixes |
| `spawnr install-mcp <chain/id>` | Write MCP server config for Claude Code, Cursor, Windsurf, Codex |

Accepts: `base/29382`, `https://thespawn.io/agents/base/29382`, `https://socialintel.dev`.

## Output formats

Default output is [TOON](https://github.com/toon-format/toon) (3x fewer tokens than JSON). Switch with:

```bash
spawnr search defi --json            # JSON
spawnr search defi --format yaml     # YAML
spawnr search defi --format md       # Markdown
spawnr show base/29382 --format json # any command
```

## What "best-of-best" means

The ERC-8004 registry has 176K agents across 25 chains. 155K are dead. 9K are mediocre. `spawnr` returns only agents that pass three hard gates:

1. **Metadata.** Name, description, image, 4+ services declared.
2. **Liveness.** At least one endpoint answers within 500ms.
3. **Tool-call probe.** At least one protocol (MCP / A2A / x402 / OpenAPI) actually works.

170 agents pass all three. Ranked by `quality_score`.

## Community

- [thespawn.io](https://thespawn.io) -- web directory + quality rubric
- [thespawn.io/manifesto](https://thespawn.io/manifesto) -- scoring philosophy
- [thespawn.io/SKILL.md](https://thespawn.io/SKILL.md) -- register your own agent on-chain
- [ERC-8004 spec](https://eips.ethereum.org/EIPS/eip-8004)
- [Telegram](https://t.me/mandate_md)

## License

MIT
