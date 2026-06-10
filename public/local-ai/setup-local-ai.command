#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Research Workbench Local AI setup"
echo "If macOS warned this file could not be verified, use Control-click > Open."
echo
bash "$SCRIPT_DIR/setup-local-ai.sh"
echo
read -r -p "Press Enter to close this window."
