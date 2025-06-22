#!/usr/bin/env bash
# Send a prompt to the /generate endpoint, optionally embedding an image inline as base64.
# Usage:
#   ./generate_prompt.sh <WORKER_URL> <SESSION_ID> <ROOM_ID> "Prompt" [IMAGE_PATH] [MIME_TYPE]
# Env vars fallback: WORKER_URL, SESSION_ID, ROOM_ID, PROMPT, IMAGE_PATH, MIME_TYPE

set -euo pipefail

WORKER_URL="${1:-${WORKER_URL:-}}"
SESSION_ID="${2:-${SESSION_ID:-}}"
ROOM_ID="${3:-${ROOM_ID:-}}"
PROMPT="${4:-${PROMPT:-}}"
ARG5_RAW="${5:-}"; ARG6="${6:-}";
# trim leading/trailing whitespace and remove internal newlines
ARG5="$(printf '%s' "$ARG5_RAW" | tr -d '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
# Determine input style for 5th argument
#  - starts with @<key>   → existing R2 key
#  - starts with http/https → remote URL that will be downloaded
#  - otherwise treat as local file path
#
# shellcheck disable=SC2034
# If ARG5 starts with @, treat as existing r2Key (without uploading)
if [[ "$ARG5" == @* ]]; then
  R2_KEY="${ARG5#@}"
  MIME_TYPE="$ARG6"
  IMAGE_PATH=""
elif [[ "$ARG5" =~ ^https?:// ]]; then
  TEMP_FILE=$(mktemp /tmp/gprompt-XXXXXX)
  echo "Downloading remote image…"
  curl -sSL "$ARG5" -o "$TEMP_FILE"
  IMAGE_PATH="$TEMP_FILE"
  MIME_TYPE="$ARG6"
else
  IMAGE_PATH="$ARG5"
  MIME_TYPE="$ARG6"
fi

if [[ -z "$WORKER_URL" || -z "$SESSION_ID" || -z "$ROOM_ID" || -z "$PROMPT" ]]; then
  echo "Usage: $0 <WORKER_URL> <SESSION_ID> <ROOM_ID> \"PROMPT\" [IMAGE_PATH] [MIME_TYPE]" >&2
  exit 1
fi

# Build JSON payload
if [[ -n "$IMAGE_PATH" ]]; then
  if [[ ! -f "$IMAGE_PATH" ]]; then
    echo "Image file '$IMAGE_PATH' not found" >&2
    exit 1
  fi
  # Detect mime if not supplied
  if [[ -z "$MIME_TYPE" ]]; then
    if command -v file >/dev/null 2>&1; then
      MIME_TYPE=$(file -b --mime-type "$IMAGE_PATH")
    else
      MIME_TYPE="image/jpeg"
    fi
  fi
  BASE64_DATA=$(base64 < "$IMAGE_PATH" | tr -d '\n')
  # first upload (IMAGE_PATH is guaranteed to exist)
  UPLOAD_JSON=$(printf '{"fileName":"%s","mimeType":"%s","data":"%s"}' "$(basename "$IMAGE_PATH")" "$MIME_TYPE" "$BASE64_DATA")
  echo "Uploading to /upload…"
  R2_KEY=$(printf '%s' "$UPLOAD_JSON" | curl -s -X POST "${WORKER_URL%/}/upload" -H "Content-Type: application/json" -H "X-Session-Id: $SESSION_ID" --data-binary @- | jq -r .imageUrl )
  if [[ -z "$R2_KEY" || "$R2_KEY" == "null" ]]; then
    echo "Upload failed" >&2; exit 1; fi

  JSON_PAYLOAD=$(printf '{"roomId":"%s","content":"%s","imageUrl":"%s","mimeType":"%s"}' \
    "$ROOM_ID" "$(printf '%s' "$PROMPT" | sed 's/"/\\"/g')" "$R2_KEY" "$MIME_TYPE")
else
  # text-only or key provided
  if [[ -n "${R2_KEY:-}" ]]; then
    JSON_PAYLOAD=$(printf '{"roomId":"%s","content":"%s","imageUrl":"%s","mimeType":"%s"}' "$ROOM_ID" "$(printf '%s' "$PROMPT" | sed 's/"/\\"/g')" "$R2_KEY" "$MIME_TYPE")
  else
    JSON_PAYLOAD=$(printf '{"roomId":"%s","content":"%s"}' "$ROOM_ID" "$(printf '%s' "$PROMPT" | sed 's/"/\\"/g')")
  fi
fi

echo "Sending prompt…"

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

# cleanup temp file if created
if [[ -n "${TEMP_FILE:-}" && -f "$TEMP_FILE" ]]; then
  rm -f "$TEMP_FILE"
fi
