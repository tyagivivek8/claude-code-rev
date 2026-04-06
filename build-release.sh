#!/bin/bash
# Build standalone executables for all platforms
set -e

mkdir -p dist

echo "Building Claude Code (Copilot Edition)..."
echo ""

echo "[1/3] Windows (x64)..."
bun build --compile src/entrypoints/cli.tsx --outfile dist/claude-code-win-x64.exe

echo ""
echo "[2/3] macOS (ARM64 - M1/M2/M3/M4)..."
bun build --compile --target=bun-darwin-arm64 src/entrypoints/cli.tsx --outfile dist/claude-code-mac-arm64

echo ""
echo "[3/3] macOS (x64 - Intel)..."
bun build --compile --target=bun-darwin-x64 src/entrypoints/cli.tsx --outfile dist/claude-code-mac-x64

echo ""
echo "=== Builds complete ==="
ls -lh dist/claude-code-*
echo ""
echo "Share the binary for your team's platform. No install needed — just run it."
