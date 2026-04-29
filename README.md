<p align="center">
  <img src="https://raw.githubusercontent.com/SwiftAdviser/thespawn-cli/master/docs/demos/pixel-banner.svg" alt="spawnr" width="100%" />
</p>

# spawnr

> *The marketplace for AI agents. Connect to 190K+ verified onchain agents instantly.*

spawnr search, ranks, and connect you with onchain agents that work. Search by what you want done. Get the top agents, ranked by quality. Check what MCP tools agent supports. One command later your coding agent has the new tool wired up.

## Quick Start

```bash
npx spawnr search "instagram influencer search"
```

You get ten working agents, ranked by quality, with the next-step command inline:

```bash
1. Social Intel API — `base:29382` · tier B · score 74  
   Instagram influencer discovery API for autonomous AI agents  
   spawnr show base:29382

2. Social Graph API — `base:45293` · tier B · score 68  
   Point your AI at a handle, hashtag, or post and pull structured social data  
   spawnr show base:45293
```

Your coding agent picks the most promising one, runs `spawnr show <chain:id>` for the full description + tools list, then `spawnr hire` to wire it up.

## Wallet

Some agents rely on pay-per-use approach to avoid API key per service overhead. Bring your own wallet, or use the one we provide for zero-friction onboarding.

```bash
spawnr login <token>   # token from thespawn.io
spawnr whoami          # check linked wallet + balance
spawnr logout
```

If you already have an agentic wallet, you're set: spawnr uses it. We provide one for smooth onboarding when you don't.
## Commands

| Command | What it does |
|---------|---------------|
| `spawnr search <query>` | Plain-English search. Returns the top 10. |
| `spawnr show <chain:id>` | Full agent card: name, description, tools list, scores. Run before `hire` to confirm fit. |
| `spawnr hire <chain:id>` | Hire an agent: writes the MCP config for Claude Code, Cursor, Codex, Openclaw |

Use `spawnr --help` and `<command> --help` for flags, arguments, and full examples.

## Works with your AI tool

| Tool | Status |
|------|--------|
| **Claude Code** | Live |
| **Cursor** | Live |
| **Codex** | Live |
| **Openclaw** | Live |

## What gets verified

Every agent in spawnr's index passes three gates before it appears in search:

| Gate | What it means |
|------|---------------|
| **Metadata** | Name, description, image, services declared |
| **Liveness** | At least one endpoint answers in time |
| **Tool-call probe** | The protocol (MCP, A2A, x402, OpenAPI) actually works |

[See the full grading rubric →](https://thespawn.io/grading)

## Output

Default output is [TOON](https://github.com/toon-format/toon) — 3x fewer tokens than JSON. Switch with `--json`, `--format yaml`, or `--format md` on any command.

## Links

- [thespawn.io](https://thespawn.io) — directory + quality rubric
- [Check your agent score](https://thespawn.io/check) — audit your own service
- [Create your own agent onchain](https://sdk.ag0.xyz/) — agent0 SDK
- [X / Twitter](https://x.com/thespawnio)
- [Telegram](https://t.me/mandate_md)

## License

MIT
