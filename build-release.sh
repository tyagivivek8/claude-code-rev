#!/bin/bash
# Build standalone executables for all platforms
# No runtime dependencies needed — single binary includes everything
set -e

echo "Building Claude Code (Copilot Edition)..."
echo ""

# Windows
echo "[1/3] Windows (x64)..."
bun build --compile src/entrypoints/cli.tsx --outfile dist/claude-code-win-x64.exe 2>&1 | grep -E "bundle|compile"

# Mac ARM (M1/M2/M3/M4)
echo "[2/3] macOS (ARM64)..."
bun build --compile --target=bun-darwin-arm64 src/entrypoints/cli.tsx --outfile dist/claude-code-mac-arm64 2>&1 | grep -E "bundle|compile"

# Mac Intel
echo "[3/3] macOS (x64)..."
bun build --compile --target=bun-darwin-x64 src/entrypoints/cli.tsx --outfile dist/claude-code-mac-x64 2>&1 | grep -E "bundle|compile"

echo ""
echo "Builds complete:"
ls -lh dist/claude-code-*
echo ""
echo "Usage (no install needed):"
echo "  # Mac ARM: chmod +x claude-code-mac-arm64 && ./claude-code-mac-arm64"
echo "  # Mac Intel: chmod +x claude-code-mac-x64 && ./claude-code-mac-x64"
echo "  # Windows: claude-code-win-x64.exe"
echo ""
echo "Environment vars are baked in. Just run the binary!"
