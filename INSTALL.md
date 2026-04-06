# Claude Code with GitHub Copilot (Free)

Run Claude Code CLI using your GitHub Copilot subscription (free tier works).

## Prerequisites

- [Bun](https://bun.sh) runtime: `curl -fsSL https://bun.sh/install | bash` (or `powershell -c "irm bun.sh/install.ps1 | iex"` on Windows)
- GitHub account with Copilot access (free tier is fine)

## Setup

```bash
git clone https://github.com/tyagivivek8/claude-code-rev.git
cd claude-code-rev
bun install
```

## Run

### Interactive mode (REPL)
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 CLAUDE_CODE_USE_COPILOT=1 bun run src/entrypoints/cli.tsx
```

### One-shot mode
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 CLAUDE_CODE_USE_COPILOT=1 bun run src/entrypoints/cli.tsx -p "your question here"
```

### Windows (cmd)
```cmd
set NODE_TLS_REJECT_UNAUTHORIZED=0
set CLAUDE_CODE_USE_COPILOT=1
bun run src\entrypoints\cli.tsx
```

## First run

On first run, you'll see a GitHub device flow prompt:
1. Open the URL shown (https://github.com/login/device)
2. Enter the code displayed
3. Authorize the app

Your token is cached in `~/.claude/copilot-auth.json` — you won't need to re-auth unless it expires.

## Model selection

Default model is **Claude Opus 4.6**. To use a different model:

```bash
# Use Sonnet (faster, higher rate limits)
ANTHROPIC_MODEL=sonnet NODE_TLS_REJECT_UNAUTHORIZED=0 CLAUDE_CODE_USE_COPILOT=1 bun run src/entrypoints/cli.tsx
```

## Troubleshooting

- **Rate limit / quota exceeded**: Wait a few minutes or switch to `ANTHROPIC_MODEL=sonnet`
- **SSL certificate error**: Make sure `NODE_TLS_REJECT_UNAUTHORIZED=0` is set
- **Auth expired**: Delete `~/.claude/copilot-auth.json` and re-run
