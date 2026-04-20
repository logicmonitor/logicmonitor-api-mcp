#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PLUGIN_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PACKAGE_ROOT="$(cd -- "$PLUGIN_ROOT/../.." && pwd)"
CHECKOUT_ROOT="${LOGICMONITOR_PLUGIN_CHECKOUT_ROOT:-$PACKAGE_ROOT}"
MODE="${LOGICMONITOR_PLUGIN_MODE:-auto}"
PACKAGE_ENTRYPOINT="$PACKAGE_ROOT/dist/index.js"
CHECKOUT_ENTRYPOINT="$CHECKOUT_ROOT/dist/index.js"
CHECKOUT_LAUNCHER="$CHECKOUT_ROOT/scripts/start-logicmonitor-mcp.sh"

ok() {
  echo "[ok] $1"
}

warn() {
  echo "[warn] $1"
}

fail() {
  echo "[fail] $1"
}

resolve_env_file() {
  local env_file="${LM_CODEX_ENV_FILE:-$CHECKOUT_ROOT/.env.codex.local}"

  if [[ "$env_file" != /* ]]; then
    env_file="$CHECKOUT_ROOT/$env_file"
  fi

  printf '%s\n' "$env_file"
}

read_env_value() {
  local key="$1"
  local env_file="$2"

  if [[ ! -f "$env_file" ]]; then
    return 1
  fi

  sed -n "s/^${key}=//p" "$env_file" | head -n 1 | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

has_advanced_local() {
  local env_file
  env_file="$(resolve_env_file)"

  [[ -d "$CHECKOUT_ROOT" ]] || return 1
  [[ -f "$CHECKOUT_LAUNCHER" ]] || return 1
  [[ -f "$CHECKOUT_ENTRYPOINT" ]] || return 1
  [[ -f "$env_file" ]] || return 1
  [[ -n "$(read_env_value LM_SESSION_LISTENER_BASE_URL "$env_file")" ]] || return 1
  return 0
}

summarize_portals() {
  PORTALS_RESPONSE="$1" node <<'NODE'
const raw = process.env.PORTALS_RESPONSE ?? '';
const trimmed = raw.trim();

if (trimmed === 'None') {
  console.log('none');
  process.exit(0);
}

try {
  const parsed = JSON.parse(raw);

  const extractList = value => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return null;
    for (const key of ['portals', 'items', 'data']) {
      const nested = extractList(value[key]);
      if (nested) return nested;
    }
    return null;
  };

  const list = extractList(parsed);
  if (list) {
    console.log(list.length === 0 ? 'empty' : `count:${list.length}`);
    process.exit(0);
  }

  if (
    parsed === null ||
    parsed === 'None' ||
    parsed?.portals === null ||
    parsed?.items === null ||
    parsed?.data === null
  ) {
    console.log('none');
    process.exit(0);
  }

  console.log('present');
} catch {
  console.log('present');
}
NODE
}

ENV_FILE="$(resolve_env_file)"
SELECTED_MODE="$MODE"
STATUS=0

if [[ "$SELECTED_MODE" == "auto" ]]; then
  if has_advanced_local; then
    SELECTED_MODE="advanced-local"
  else
    SELECTED_MODE="standard"
  fi
fi

ok "mode: $SELECTED_MODE"

case "$SELECTED_MODE" in
  standard)
    if command -v node >/dev/null 2>&1; then
      ok "node: $(command -v node)"
    else
      fail "node is required for standard mode"
      STATUS=1
    fi

    if [[ -f "$PACKAGE_ENTRYPOINT" ]]; then
      ok "packaged entrypoint: $PACKAGE_ENTRYPOINT"
    elif command -v npx >/dev/null 2>&1; then
      warn "packaged entrypoint missing; standard mode will fall back to npx -y logicmonitor-api-mcp --stdio"
    else
      fail "standard mode requires $PACKAGE_ENTRYPOINT or a working npx installation"
      STATUS=1
    fi

    if [[ -n "${LM_ACCOUNT:-}" ]]; then
      ok "LM_ACCOUNT is set"
    else
      fail "LM_ACCOUNT must be set for standard mode"
      STATUS=1
    fi

    if [[ -n "${LM_BEARER_TOKEN:-}" ]]; then
      ok "LM_BEARER_TOKEN is set"
    else
      fail "LM_BEARER_TOKEN must be set for standard mode"
      STATUS=1
    fi
    ;;
  advanced-local)
    if [[ -d "$CHECKOUT_ROOT" ]]; then
      ok "checkout root: $CHECKOUT_ROOT"
    else
      fail "checkout root is missing: $CHECKOUT_ROOT"
      STATUS=1
    fi

    if [[ -f "$CHECKOUT_LAUNCHER" ]]; then
      ok "checkout launcher: $CHECKOUT_LAUNCHER"
    else
      fail "advanced-local mode requires $CHECKOUT_LAUNCHER"
      STATUS=1
    fi

    if [[ -f "$CHECKOUT_ENTRYPOINT" ]]; then
      ok "built entrypoint: $CHECKOUT_ENTRYPOINT"
    else
      fail "advanced-local mode requires $CHECKOUT_ENTRYPOINT"
      STATUS=1
    fi

    if [[ -f "$ENV_FILE" ]]; then
      ok "env file: $ENV_FILE"
    else
      fail "advanced-local mode expects an env file at $ENV_FILE"
      STATUS=1
    fi

    LISTENER_URL=""
    if [[ -f "$ENV_FILE" ]]; then
      LISTENER_URL="$(read_env_value LM_SESSION_LISTENER_BASE_URL "$ENV_FILE")"
    fi

    if [[ -n "$LISTENER_URL" ]]; then
      ok "listener base URL found"
    else
      fail "LM_SESSION_LISTENER_BASE_URL must be set in $ENV_FILE"
      STATUS=1
    fi

    PORTAL_VALUE=""
    if [[ -f "$ENV_FILE" ]]; then
      PORTAL_VALUE="$(read_env_value LM_PORTAL "$ENV_FILE")"
    fi

    if [[ -n "$PORTAL_VALUE" ]]; then
      ok "LM_PORTAL default found"
    else
      warn "LM_PORTAL not set; explicit portal or lm_session defaultPortal will be required"
    fi

    if [[ $STATUS -eq 0 ]]; then
      if command -v curl >/dev/null 2>&1; then
        PORTALS_URL="${LISTENER_URL%/}/api/v1/portals"
        if RESPONSE="$(curl --fail --silent --show-error "$PORTALS_URL" 2>&1)"; then
          ok "portal discovery endpoint responded: /api/v1/portals"

          PORTAL_SUMMARY="$(summarize_portals "$RESPONSE")"
          case "$PORTAL_SUMMARY" in
            empty)
              warn "portal discovery returned an empty list"
              ;;
            none)
              warn "portal discovery returned None"
              ;;
            count:*)
              ok "portal discovery returned loaded portals (${PORTAL_SUMMARY#count:})"
              ;;
            *)
              ok "portal discovery returned data"
              ;;
          esac
        else
          fail "portal discovery request failed: $RESPONSE"
          STATUS=1
        fi
      else
        fail "curl is required to verify $LISTENER_URL/api/v1/portals"
        STATUS=1
      fi
    fi
    ;;
  *)
    fail "unsupported LOGICMONITOR_PLUGIN_MODE='$MODE'"
    STATUS=1
    ;;
esac

exit "$STATUS"
