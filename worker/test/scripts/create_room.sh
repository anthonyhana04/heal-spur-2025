#!/usr/bin/env bash
# Create a chat room via the Worker and return the roomId.
# Usage:
#   ./create_room.sh <WORKER_URL> <SESSION_ID> [TITLE]
# or set env vars WORKER_URL / SESSION_ID / TITLE.
# Requires: curl, optionally jq for parsing.
set -euo pipefail

WORKER_URL="${1:-${WORKER_URL:-}}"
SESSION_ID="${2:-${SESSION_ID:-}}"
TITLE="${3:-${TITLE:-}}"

if [[ -z "$WORKER_URL" || -z "$SESSION_ID" ]]; then
  echo "Usage: $0 <WORKER_URL> <SESSION_ID> [TITLE]" >&2
  echo "Or set WORKER_URL and SESSION_ID env vars. TITLE is optional." >&2
  exit 1
fi

if [[ -n "$TITLE" ]]; then
  DATA=$(printf '{"initialTitle":"%s"}' "$TITLE")
else
  DATA='{"initialTitle":null}'
fi

RESPONSE=$(curl -s -X POST "${WORKER_URL%/}/room" \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  --data "$DATA")

echo "Response: $RESPONSE"

if command -v jq >/dev/null 2>&1; then
  ROOM_ID=$(echo "$RESPONSE" | jq -r .id 2>/dev/null || true)
  if [[ -n "$ROOM_ID" && "$ROOM_ID" != "null" ]]; then
    echo "\nRoom ID → $ROOM_ID"
  fi
fi 