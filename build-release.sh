#!/bin/bash
# Build standalone executables for all platforms
set -e

mkdir -p dist

echo "Building Clawd Code (Copilot Edition)..."
echo ""

echo "[1/4] Windows (x64)..."
bun build --compile src/entrypoints/cli.tsx --outfile dist/claude-code-win-x64.exe

echo ""
echo "[2/4] macOS (ARM64 - M1/M2/M3/M4)..."
bun build --compile --target=bun-darwin-arm64 src/entrypoints/cli.tsx --outfile dist/claude-code-mac-arm64

echo ""
echo "[3/4] macOS (x64 - Intel)..."
bun build --compile --target=bun-darwin-x64 src/entrypoints/cli.tsx --outfile dist/claude-code-mac-x64

echo ""
echo "[4/4] Linux (x64)..."
bun build --compile --target=bun-linux-x64 src/entrypoints/cli.tsx --outfile dist/claude-code-linux-x64

echo ""
echo "=== Builds complete ==="
ls -lh dist/claude-code-*
echo ""
echo "IMPORTANT: Mac users must clear quarantine before running:"
echo "  xattr -cr ./claude-code-mac-arm64"
echo "  chmod +x ./claude-code-mac-arm64"
echo ""
echo "Share the binary for your team's platform. No install needed — just run it."
