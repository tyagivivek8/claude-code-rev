# Claude Code with GitHub Copilot (Free)

Run Claude Code CLI using your GitHub Copilot subscription (free tier works).

## Option 1: Standalone Binary (no install needed)

Download the binary for your platform from the latest release, then:

### macOS

```bash
# Remove quarantine attribute (macOS blocks unsigned downloaded binaries)
xattr -d com.apple.quarantine ./claude-code-mac-arm64   # M1/M2/M3/M4
# or
xattr -d com.apple.quarantine ./claude-code-mac-x64     # Intel Mac

# Make executable
chmod +x ./claude-code-mac-arm64

# Run
./claude-code-mac-arm64
```

**If you get "cannot be opened because the developer cannot be verified":**
1. Run: `xattr -cr ./claude-code-mac-arm64`
2. Or: System Settings > Privacy & Security > click "Allow Anyway"

**Which binary do I need?**
- Run `uname -m` in Terminal
- `arm64` = use `claude-code-mac-arm64` (M1/M2/M3/M4)
- `x86_64` = use `claude-code-mac-x64` (Intel)

### Windows

```cmd
claude-code-win-x64.exe
```

### Linux

```bash
chmod +x ./claude-code-linux-x64
./claude-code-linux-x64
```

## Option 2: Run from source

### Prerequisites

- [Bun](https://bun.sh) runtime: `curl -fsSL https://bun.sh/install | bash` (or `powershell -c "irm bun.sh/install.ps1 | iex"` on Windows)
- GitHub account with Copilot access (free tier is fine)

### Setup

```bash
git clone https://github.com/tyagivivek8/claude-code-rev.git
cd claude-code-rev
bun install
```

### Run

```bash
# Interactive mode (REPL)
bun run src/entrypoints/cli.tsx

# One-shot mode
bun run src/entrypoints/cli.tsx -p "your question here"
```

### Windows (cmd)

```cmd
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
ANTHROPIC_MODEL=sonnet bun run src/entrypoints/cli.tsx
```

## Build standalone binaries

```bash
# Build for all platforms (requires Bun)
bash build-release.sh

# Or build individually
bun build --compile src/entrypoints/cli.tsx --outfile dist/claude-code-win-x64.exe
bun build --compile --target=bun-darwin-arm64 src/entrypoints/cli.tsx --outfile dist/claude-code-mac-arm64
bun build --compile --target=bun-darwin-x64 src/entrypoints/cli.tsx --outfile dist/claude-code-mac-x64
bun build --compile --target=bun-linux-x64 src/entrypoints/cli.tsx --outfile dist/claude-code-linux-x64
```

## Troubleshooting

- **"cannot be opened" on Mac**: Run `xattr -cr ./claude-code-mac-arm64` to clear quarantine
- **Rate limit / quota exceeded**: Wait a few minutes or switch to `ANTHROPIC_MODEL=sonnet`
- **SSL certificate error**: Make sure `NODE_TLS_REJECT_UNAUTHORIZED=0` is set (already baked into the binary)
- **Auth expired**: Delete `~/.claude/copilot-auth.json` and re-run
- **Binary crashes on Mac**: Check architecture with `uname -m` — use the matching binary (arm64 vs x64)
