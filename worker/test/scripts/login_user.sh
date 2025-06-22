#!/usr/bin/env bash
# Login with Basic Auth and extract the sessionId from the response.
# Usage:
#   ./login_user.sh <WORKER_URL> <USERNAME> <PASSWORD>
# or set env vars:
#   WORKER_URL=... USERNAME=... PASSWORD=... ./login_user.sh
set -euo pipefail

WORKER_URL="${1:-${WORKER_URL:-}}"
USERNAME="${2:-${USERNAME:-}}"
PASSWORD="${3:-${PASSWORD:-}}"

if [[ -z "$WORKER_URL" || -z "$USERNAME" || -z "$PASSWORD" ]]; then
  echo "Usage: $0 <WORKER_URL> <USERNAME> <PASSWORD>" >&2
  echo "Or set WORKER_URL, USERNAME, PASSWORD env vars." >&2
  exit 1
fi

BASIC_HDR=$(printf "%s:%s" "$USERNAME" "$PASSWORD" | base64)

# Perform login, capture JSON, and extract sessionId with jq if present
RESPONSE=$(curl -s -X POST "${WORKER_URL%/}/login" \
  -H "Authorization: Basic $BASIC_HDR")

echo "Response: $RESPONSE"

# If jq is available, parse the sessionId
if command -v jq >/dev/null 2>&1; then
  SESSION_ID=$(echo "$RESPONSE" | jq -r .sessionId 2>/dev/null || true)
  if [[ -n "$SESSION_ID" && "$SESSION_ID" != "null" ]]; then
    echo "\nSession ID → $SESSION_ID"
  fi
fi 