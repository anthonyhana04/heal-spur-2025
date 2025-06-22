#!/usr/bin/env bash
# Upload an image to the /image-upload endpoint and return the key.
# Usage:
#   ./upload_image.sh <WORKER_URL> <SESSION_ID> <IMAGE_PATH>
# Env vars fallback: WORKER_URL, SESSION_ID, IMAGE_PATH

set -euo pipefail

WORKER_URL="${1:-${WORKER_URL:-}}"
SESSION_ID="${2:-${SESSION_ID:-}}"
IMAGE_PATH="${3:-${IMAGE_PATH:-}}"

if [[ -z "$WORKER_URL" || -z "$SESSION_ID" || -z "$IMAGE_PATH" ]]; then
  echo "Usage: $0 <WORKER_URL> <SESSION_ID> <IMAGE_PATH>" >&2
  exit 1
fi

if [[ ! -f "$IMAGE_PATH" ]]; then
  echo "Image file '$IMAGE_PATH' not found" >&2
  exit 1
fi

# Base64 encode the image
BASE64_DATA=$(base64 < "$IMAGE_PATH" | tr -d '\n')

# Create upload JSON
UPLOAD_JSON=$(printf '{"fileName":"%s","data":"%s"}' "$(basename "$IMAGE_PATH")" "$BASE64_DATA")

# Upload to /image-upload endpoint
echo "Uploading to /image-upload..."
RESPONSE=$(printf '%s' "$UPLOAD_JSON" | curl -s -X POST "${WORKER_URL%/}/image-upload" \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  --data-binary @-)

# Extract and output just the key
KEY=$(echo "$RESPONSE" | jq -r '.key')
if [[ -z "$KEY" || "$KEY" == "null" ]]; then
  echo "Upload failed: $RESPONSE" >&2
  exit 1
fi

echo "$KEY" 