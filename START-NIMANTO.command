#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
cd "$SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Nimanto needs Node.js 24 or newer. Install it from https://nodejs.org/"
  read -r "?Press Return to close."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@11.20.0 --activate
fi

pnpm install --frozen-lockfile
NIMANTO_RUNTIME_DIR=${NIMANTO_DATA_DIR:-"$SCRIPT_DIR/.nimanto-data"}
mkdir -p -m 700 "$NIMANTO_RUNTIME_DIR"
chmod 700 "$NIMANTO_RUNTIME_DIR"
NIMANTO_SECRET_FILE="$NIMANTO_RUNTIME_DIR/launch-secret"
if [[ ! -s "$NIMANTO_SECRET_FILE" ]]; then
  umask 077
  openssl rand -base64 32 | tr -d '\n' > "$NIMANTO_SECRET_FILE"
  print >> "$NIMANTO_SECRET_FILE"
fi
chmod 600 "$NIMANTO_SECRET_FILE"
export NIMANTO_BOOTSTRAP_SECRET=$(<"$NIMANTO_SECRET_FILE")
(sleep 2; open "http://127.0.0.1:4300/workspace/#bootstrap=$NIMANTO_BOOTSTRAP_SECRET") &
pnpm dev
