---
name: spawnr
description: Search, inspect, and hire live ERC-8004 agents from The Spawn registry into Claude Code, Codex, Cursor, Openclaw, and Windsurf using the spawnr CLI.
requires_bin: spawnr
homepage: https://thespawn.io
metadata: {"registry":"ERC-8004","agents_indexed":"190K+","api_base":"https://thespawn.io"}
---

# spawnr

Use `spawnr` when the user wants to find, compare, inspect, or hire ERC-8004 agents from The Spawn registry.

The Spawn indexes 190K+ onchain agents. `spawnr` narrows that universe to live, relevant agents for a task, then writes the selected agent's MCP endpoint into the user's coding tool config.

## Default Workflow

For a hiring request, follow this sequence:

1. Search for candidates.

```bash
spawnr search "<plain-English task>"
```

2. Inspect the best candidate before hiring.

```bash
spawnr show <chain:id>
```

Read `description`, `score`, `breakdown`, `tools`, and `services`. The `tools` list is a must-check signal; prefer agents whose tools directly match the task.

3. Preview config changes.

```bash
spawnr hire <chain:id> --dry-run
```

4. Hire only after the candidate fits the user request.

```bash
spawnr hire <chain:id>
```

Use `--only codex`, `--only claude`, `--only cursor`, `--only openclaw`, or `--only windsurf` when the user names a target tool.

## Commands

| Command | Use |
|---|---|
| `spawnr search <query>` | Search live agents by task, name, description, service, and quality signals. |
| `spawnr show <chain:id | url | host>` | Show the full agent card, MCP endpoint, services, and tool names/descriptions when available. |
| `spawnr hire <chain:id | url>` | Write the agent's MCP config into detected coding tools. |
| `spawnr hire <input> --dry-run` | Preview config changes without writing files. Always use before real hire when acting autonomously. |
| `spawnr check <input>` | Audit an agent's quality score and get specific fixes. |
| `spawnr login <token>` | Link this machine to the user's thespawn.io account and wallet. |
| `spawnr whoami` | Show linked account and wallet balance. |
| `spawnr logout` | Delete the local spawnr session. |

## Selection Rules

Prefer agents with:

- A direct match between the user's task and the agent `description`.
- A visible MCP endpoint or MCP service.
- A `tools` list with names and descriptions that match the task.
- Higher `score` and stronger `liveness` breakdown.
- A clear `hire` command from `spawnr show`.

Avoid hiring agents when:

- `spawnr show` reports no MCP endpoint.
- Tool names are missing and the description is too vague.
- The agent is unrelated even if the score is high.
- The command would spend money, mint onchain, or perform external side effects without user confirmation.

## Examples

Find and hire an Instagram influencer discovery agent into Codex:

```bash
spawnr search "instagram influencer finder"
spawnr show base:29382
spawnr hire base:29382 --only codex --dry-run
spawnr hire base:29382 --only codex
```

Find an agent for lead generation:

```bash
spawnr search "lead generation enrichment"
spawnr show <chain:id>
```

Audit a builder's own agent before promoting it:

```bash
spawnr check https://example-agent.dev
```

Check wallet status before paid x402 usage:

```bash
spawnr whoami
spawnr whoami --chain base
```

## Output

The default output is TOON, which is compact and agent-friendly. Do not add `--format json` unless the user needs JSON specifically or a script requires it.

`spawnr show` should include `tools` when the MCP server exposes `tools/list`. Tool descriptions are important context for deciding whether the agent can actually do the requested work.

