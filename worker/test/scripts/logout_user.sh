#!/usr/bin/env bash
# Logout by invalidating a session on the Worker.
# Usage:
#   ./logout_user.sh <WORKER_URL> <SESSION_ID>
# or set env vars WORKER_URL and SESSION_ID.
set -euo pipefail

WORKER_URL="${1:-${WORKER_URL:-}}"
SESSION_ID="${2:-${SESSION_ID:-}}"

if [[ -z "$WORKER_URL" || -z "$SESSION_ID" ]]; then
  echo "Usage: $0 <WORKER_URL> <SESSION_ID>" >&2
  echo "Or set WORKER_URL and SESSION_ID env vars." >&2
  exit 1
fi

curl -i -X POST "${WORKER_URL%/}/logout" \
     -H "X-Session-Id: $SESSION_ID" 