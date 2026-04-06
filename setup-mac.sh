#!/bin/bash
# Setup script for Mac users who downloaded the binary
# Run: bash setup-mac.sh

set -e

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    BINARY="claude-code-mac-arm64"
elif [ "$ARCH" = "x86_64" ]; then
    BINARY="claude-code-mac-x64"
else
    echo "Unknown architecture: $ARCH"
    exit 1
fi

if [ ! -f "$BINARY" ]; then
    echo "Binary '$BINARY' not found in current directory."
    echo "Make sure you're in the same folder as the downloaded binary."
    exit 1
fi

echo "Setting up $BINARY for $ARCH Mac..."

# Remove macOS quarantine attribute (blocks unsigned binaries)
xattr -cr "$BINARY" 2>/dev/null || true

# Make executable
chmod +x "$BINARY"

echo "Done! Run with: ./$BINARY"
