#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${LM_CODEX_ENV_FILE:-$PROJECT_ROOT/.env.codex.local}"

if [[ "$ENV_FILE" != /* ]]; then
  ENV_FILE="$PROJECT_ROOT/$ENV_FILE"
fi

LM_MCP_ENTRYPOINT="$PROJECT_ROOT/dist/index.js"

if [[ ! -f "$LM_MCP_ENTRYPOINT" ]]; then
  echo "Missing LogicMonitor MCP entrypoint at $LM_MCP_ENTRYPOINT. Build the project with: npm run build" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing Codex LogicMonitor env file: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -n "${LM_ACCOUNT:-}" || -n "${LM_BEARER_TOKEN:-}" ]]; then
  echo "This launcher is configured for session-based auth. Remove LM_ACCOUNT and LM_BEARER_TOKEN from $ENV_FILE." >&2
  exit 1
fi

if [[ -z "${LM_SESSION_LISTENER_BASE_URL:-}" ]]; then
  echo "LM_SESSION_LISTENER_BASE_URL must be set in $ENV_FILE" >&2
  exit 1
fi

if [[ "${LM_PORTAL:-}" == "your-portal-name" ]]; then
  echo "Update $ENV_FILE with a real default portal or clear LM_PORTAL to require explicit portal selection." >&2
  exit 1
fi

exec node "$LM_MCP_ENTRYPOINT" --stdio
