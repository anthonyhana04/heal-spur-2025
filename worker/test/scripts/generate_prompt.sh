#!/usr/bin/env bash
# Send a prompt to the /generate endpoint, optionally including an image key.
# Usage:
#   ./generate_prompt.sh <WORKER_URL> <SESSION_ID> <ROOM_ID> "Prompt" [IMAGE_KEY]
# Env vars fallback: WORKER_URL, SESSION_ID, ROOM_ID, PROMPT, IMAGE_KEY

set -euo pipefail

WORKER_URL="${1:-${WORKER_URL:-}}"
SESSION_ID="${2:-${SESSION_ID:-}}"
ROOM_ID="${3:-${ROOM_ID:-}}"
PROMPT="${4:-${PROMPT:-}}"
IMAGE_KEY="${5:-}"

if [[ -z "$WORKER_URL" || -z "$SESSION_ID" || -z "$ROOM_ID" || -z "$PROMPT" ]]; then
  echo "Usage: $0 <WORKER_URL> <SESSION_ID> <ROOM_ID> \"PROMPT\" [IMAGE_KEY]" >&2
  exit 1
fi

# Build the generate request payload
if [[ -n "$IMAGE_KEY" ]]; then
  # Create JSON payload with image key
  JSON_PAYLOAD=$(printf '{"roomId":"%s","content":"%s","imageKey":"%s"}' \
    "$ROOM_ID" \
    "$PROMPT" \
    "$IMAGE_KEY")
else
  # Text-only payload
  JSON_PAYLOAD=$(printf '{"roomId":"%s","content":"%s"}' \
    "$ROOM_ID" \
    "$PROMPT")
fi

# Send the generate request
echo "Sending prompt to /generate..."
printf '%s' "$JSON_PAYLOAD" | \
  curl -s -X POST "${WORKER_URL%/}/generate" \
    -H "Content-Type: application/json" \
    -H "X-Session-Id: $SESSION_ID" \
    --data-binary @- | {
      if command -v jq >/dev/null 2>&1; then
        jq
      else
        cat
      fi
    }
