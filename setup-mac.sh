#!/bin/bash
# Setup script for Mac users who downloaded the binary
# Run: bash setup-mac.sh

set -e

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    BINARY="clawd-mac-arm64"
elif [ "$ARCH" = "x86_64" ]; then
    BINARY="clawd-mac-x64"
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

# Create symlink as 'claude' in /usr/local/bin so it's callable from anywhere
INSTALL_DIR="/usr/local/bin"
LINK_NAME="clawd"

echo ""
echo "Install to PATH so you can run 'clawd' from anywhere?"
echo "This will create a symlink at $INSTALL_DIR/$LINK_NAME"
read -p "Install to PATH? [Y/n] " answer
answer="${answer:-Y}"

if [[ "$answer" =~ ^[Yy]$ ]]; then
    FULL_PATH="$(cd "$(dirname "$BINARY")" && pwd)/$(basename "$BINARY")"
    if [ -w "$INSTALL_DIR" ]; then
        ln -sf "$FULL_PATH" "$INSTALL_DIR/$LINK_NAME"
    else
        sudo ln -sf "$FULL_PATH" "$INSTALL_DIR/$LINK_NAME"
    fi
    echo "Installed! Run 'clawd' from any directory."
else
    # Add current directory to PATH in shell profile
    CURRENT_DIR="$(pwd)"
    SHELL_RC=""
    if [ -f "$HOME/.zshrc" ]; then
        SHELL_RC="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        SHELL_RC="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
        SHELL_RC="$HOME/.bash_profile"
    fi

    if [ -n "$SHELL_RC" ]; then
        # Create an alias instead
        ALIAS_LINE="alias clawd='$CURRENT_DIR/$BINARY'"
        if ! grep -qF "$ALIAS_LINE" "$SHELL_RC" 2>/dev/null; then
            echo "" >> "$SHELL_RC"
            echo "# Clawd Code (Copilot)" >> "$SHELL_RC"
            echo "$ALIAS_LINE" >> "$SHELL_RC"
            echo "Added alias to $SHELL_RC. Run 'source $SHELL_RC' or open a new terminal."
        else
            echo "Alias already exists in $SHELL_RC."
        fi
    fi
fi

echo ""
echo "Done! Run: ./$BINARY"
