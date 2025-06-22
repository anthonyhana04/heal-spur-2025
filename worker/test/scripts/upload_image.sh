#!/usr/bin/env bash
# Upload an image to the /upload endpoint, then invoke /generate referencing
# that image so Gemini can reason about it.
#
# Usage:
#   ./upload_image.sh <WORKER_URL> <SESSION_ID> <FILE_PATH>
#
# Env var fallbacks:
#   WORKER_URL, SESSION_ID, FILE_PATH
#
# Requires: curl, jq, base64, file (optional for mime-type detection)
set -euo pipefail

WORKER_URL="${1:-${WORKER_URL:-}}"
SESSION_ID="${2:-${SESSION_ID:-}}"
FILE_PATH="${3:-${FILE_PATH:-}}"

if [[ -z "$WORKER_URL" || -z "$SESSION_ID" || -z "$FILE_PATH" ]]; then
  echo "Usage: $0 <WORKER_URL> <SESSION_ID> <FILE_PATH>" >&2
  exit 1
fi

if [[ ! -f "$FILE_PATH" ]]; then
  echo "Error: file '$FILE_PATH' not found" >&2
  exit 1
fi

FILE_NAME=$(basename "$FILE_PATH")
MIME_TYPE="image/jpeg"  # force to jpg per requirements

# Encode file → base64 (no newlines, portable across BSD/GNU)
if base64 --help 2>&1 | grep -q -- "-w"; then
  BASE64_DATA=$(base64 -w0 "$FILE_PATH")
else
  BASE64_DATA=$(base64 < "$FILE_PATH" | tr -d '\n')
fi

JSON_UPLOAD=$(printf '{"fileName":"%s","mimeType":"%s","data":"%s"}' "$FILE_NAME" "$MIME_TYPE" "$BASE64_DATA")

echo "Uploading image …"
UPLOAD_RESP=$(printf '%s' "$JSON_UPLOAD" | \
  curl -s -X POST "${WORKER_URL%/}/upload" \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  --data-binary @- )

if command -v jq >/dev/null 2>&1; then
  echo "$UPLOAD_RESP" | jq
else
  echo "Upload response: $UPLOAD_RESP"
fi 