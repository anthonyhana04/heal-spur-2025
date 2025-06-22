#!/usr/bin/env bash
# Send a prompt to the /generate endpoint, optionally uploading and including an image.
# Usage:
#   ./generate_prompt.sh <WORKER_URL> <SESSION_ID> <ROOM_ID> "Prompt" [IMAGE_PATH]
# Env vars fallback: WORKER_URL, SESSION_ID, ROOM_ID, PROMPT, IMAGE_PATH

set -euo pipefail

WORKER_URL="${1:-${WORKER_URL:-}}"
SESSION_ID="${2:-${SESSION_ID:-}}"
ROOM_ID="${3:-${ROOM_ID:-}}"
PROMPT="${4:-${PROMPT:-}}"
IMAGE_PATH="${5:-}"

if [[ -z "$WORKER_URL" || -z "$SESSION_ID" || -z "$ROOM_ID" || -z "$PROMPT" ]]; then
  echo "Usage: $0 <WORKER_URL> <SESSION_ID> <ROOM_ID> \"PROMPT\" [IMAGE_PATH]" >&2
  exit 1
fi

# Function to handle image upload
upload_image() {
  local image_path="$1"
  local filename
  filename=$(basename "$image_path")
  
  # Detect mime type
  local mime_type
  if command -v file >/dev/null 2>&1; then
    mime_type=$(file -b --mime-type "$image_path")
  else
    # Default to jpeg if file command not available
    mime_type="image/jpeg"
  fi
  
  # Base64 encode the image
  local base64_data
  base64_data=$(base64 < "$image_path" | tr -d '\n')
  
  # Create upload JSON
  local upload_json
  upload_json=$(printf '{"fileName":"%s","data":"%s"}' "$filename" "$base64_data")
  
  # Upload to /image-upload endpoint
  echo "Uploading image to /image-upload..."
  local response
  response=$(printf '%s' "$upload_json" | curl -s -X POST "${WORKER_URL%/}/image-upload" \
    -H "Content-Type: application/json" \
    -H "X-Session-Id: $SESSION_ID" \
    --data-binary @-)
  
  # Extract the key from response
  local key
  key=$(echo "$response" | jq -r '.key')
  if [[ -z "$key" || "$key" == "null" ]]; then
    echo "Upload failed: $response" >&2
    exit 1
  fi
  echo "$key"
}

# Build the generate request payload
if [[ -n "$IMAGE_PATH" ]]; then
  if [[ ! -f "$IMAGE_PATH" ]]; then
    echo "Image file '$IMAGE_PATH' not found" >&2
    exit 1
  fi
  
  # Upload the image first
  IMAGE_KEY=$(upload_image "$IMAGE_PATH")
  echo "Image uploaded successfully with key: $IMAGE_KEY"
  
  # Create JSON payload with image
  JSON_PAYLOAD=$(printf '{"roomId":"%s","content":"%s","imageKey":"%s"}' \
    "$ROOM_ID" \
    "$(printf '%s' "$PROMPT" | sed 's/"/\\"/g')" \
    "$IMAGE_KEY")
else
  # Text-only payload
  JSON_PAYLOAD=$(printf '{"roomId":"%s","content":"%s"}' \
    "$ROOM_ID" \
    "$(printf '%s' "$PROMPT" | sed 's/"/\\"/g')")
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
