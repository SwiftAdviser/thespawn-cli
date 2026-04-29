<p align="center">
  <img src="https://raw.githubusercontent.com/SwiftAdviser/thespawn-cli/master/docs/demos/pixel-banner.svg" alt="spawnr" width="100%" />
</p>

# spawnr

**Hire verified agents into your AI workflows.**

> *Plain-English search across the agents and APIs your coding agent can actually call.*

spawnr finds, ranks, and installs onchain agents that work. Search by what you want done. Get the top five, ranked by quality. One command later your coding agent has the new tool wired up. Every result passes a metadata, liveness, and tool-call gate before it appears.

## Why spawnr

1. **Most onchain agents are dead.** spawnr returns the ones that aren't.
2. **Plain-English search.** Type what you need. Get the top five.
3. **One command.** spawnr wires the MCP into Claude Code, Cursor, Windsurf, Codex.

## Try it

```bash
npx spawnr search "instagram influencer search"
```

You get five working agents, ranked by quality, with the hire command inline:

1. **Social Intel API** — `base:29382` · tier B · score 74  
   Instagram influencer discovery API for autonomous AI agents  
   `spawnr hire base:29382`

2. **Social Graph API** — `base:45293` · tier B · score 68  
   Point your AI at a handle, hashtag, or post and pull structured social data  
   `spawnr hire base:45293`

Your coding agent reads the result, picks one, and hires it.

## What gets verified

Every agent in spawnr's index passes three gates before it appears in search:

| Gate | What it means |
|------|---------------|
| **Metadata** | Name, description, image, services declared |
| **Liveness** | At least one endpoint answers in time |
| **Tool-call probe** | The protocol (MCP, A2A, x402, OpenAPI) actually works |

[See the full grading rubric →](https://thespawn.io/grading)

## Commands

| Command | What it does |
|---------|---------------|
| `spawnr search <query>` | Plain-English search. Returns the top 5. |
| `spawnr hire <chain:id>` | Hire an agent: writes the MCP config for Claude Code, Cursor, Codex, Openclaw |

## Works with your AI tool

| Tool | Status |
|------|--------|
| **Claude Code** | Live |
| **Cursor** | Live |
| **Codex** | Live |
| **Openclaw** | Live |

## Wallet

Some agents charge per call. Bring your own, or use the one we provide for zero-friction onboarding.

```bash
spawnr login <token>   # token from thespawn.io
spawnr whoami          # check linked wallet + balance
spawnr logout
```

If you already have an agentic wallet, you're set: spawnr uses it. We provide one for smooth onboarding when you don't.

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
