#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PLUGIN_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PACKAGE_ROOT="$(cd -- "$PLUGIN_ROOT/../.." && pwd)"
CHECKOUT_ROOT="${LOGICMONITOR_PLUGIN_CHECKOUT_ROOT:-$PACKAGE_ROOT}"
MODE="${LOGICMONITOR_PLUGIN_MODE:-auto}"
PACKAGE_ENTRYPOINT="$PACKAGE_ROOT/dist/index.js"
CHECKOUT_LAUNCHER="$CHECKOUT_ROOT/scripts/start-logicmonitor-mcp.sh"

resolve_env_file() {
  local env_file="${LM_CODEX_ENV_FILE:-$CHECKOUT_ROOT/.env.codex.local}"

  if [[ "$env_file" != /* ]]; then
    env_file="$CHECKOUT_ROOT/$env_file"
  fi

  printf '%s\n' "$env_file"
}

has_advanced_local() {
  local env_file
  env_file="$(resolve_env_file)"

  [[ -f "$CHECKOUT_LAUNCHER" ]] || return 1
  [[ -f "$CHECKOUT_ROOT/dist/index.js" ]] || return 1
  [[ -f "$env_file" ]] || return 1
  return 0
}

run_standard() {
  if [[ -f "$PACKAGE_ENTRYPOINT" ]]; then
    exec node "$PACKAGE_ENTRYPOINT" --stdio
  fi

  if command -v npx >/dev/null 2>&1; then
    exec npx -y logicmonitor-api-mcp --stdio
  fi

  echo "Standard mode requires $PACKAGE_ENTRYPOINT or a working npx installation." >&2
  exit 1
}

run_advanced_local() {
  if [[ ! -f "$CHECKOUT_LAUNCHER" ]]; then
    echo "Advanced local mode requires $CHECKOUT_LAUNCHER." >&2
    exit 1
  fi

  exec zsh "$CHECKOUT_LAUNCHER"
}

case "$MODE" in
  advanced-local)
    run_advanced_local
    ;;
  standard)
    run_standard
    ;;
  auto)
    if has_advanced_local; then
      run_advanced_local
    fi
    run_standard
    ;;
  *)
    echo "Unsupported LOGICMONITOR_PLUGIN_MODE='$MODE'. Use auto, standard, or advanced-local." >&2
    exit 1
    ;;
esac
