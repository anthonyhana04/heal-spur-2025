#!/usr/bin/env bash
# Register a new user against the Cloudflare Worker.
# Usage:
#   ./register_user.sh <WORKER_URL> <USERNAME> <PASSWORD>
# or set environment variables and omit the args:
#   WORKER_URL=... USERNAME=... PASSWORD=... ./register_user.sh
set -euo pipefail

WORKER_URL="${1:-${WORKER_URL:-}}"
USERNAME="${2:-${USERNAME:-}}"
PASSWORD="${3:-${PASSWORD:-}}"

if [[ -z "$WORKER_URL" || -z "$USERNAME" || -z "$PASSWORD" ]]; then
  echo "Usage: $0 <WORKER_URL> <USERNAME> <PASSWORD>" >&2
  echo "Or set WORKER_URL, USERNAME, PASSWORD env vars." >&2
  exit 1
fi

# Construct Basic Auth header (no trailing newline)
BASIC_HDR=$(printf "%s:%s" "$USERNAME" "$PASSWORD" | base64)

curl -i -X POST "${WORKER_URL%/}/register" \
  -H "Authorization: Basic $BASIC_HDR" 