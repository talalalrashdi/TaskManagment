#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_PORT="${API_PORT:-5270}"
WEB_PORT="${WEB_PORT:-}"
API_STARTED=0
WEB_STARTED=0

is_port_in_use() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

pick_web_port() {
  local candidate

  for candidate in 3002 3003 3004 3010 3011 3012; do
    if ! is_port_in_use "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  return 1
}

cleanup() {
  if [[ "$API_STARTED" -eq 1 && -n "${API_PID:-}" ]]; then
    kill "$API_PID" 2>/dev/null || true
  fi

  if [[ "$WEB_STARTED" -eq 1 && -n "${WEB_PID:-}" ]]; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ -z "$WEB_PORT" ]]; then
  WEB_PORT="$(pick_web_port)"
elif is_port_in_use "$WEB_PORT"; then
  printf 'Web port %s is already in use.\n' "$WEB_PORT" >&2
  exit 1
fi

if is_port_in_use "$API_PORT"; then
  printf 'API already running on http://localhost:%s\n' "$API_PORT"
else
  (
    cd "$ROOT_DIR"
    dotnet run --project TechFlowPM.API --launch-profile http
  ) &
  API_PID=$!
  API_STARTED=1
fi

(
  cd "$ROOT_DIR/techflowpm-web"
  npm run dev -- --port "$WEB_PORT"
) &
WEB_PID=$!
WEB_STARTED=1

printf '\nTechFlow PM local dev is starting...\n'
printf 'API: http://localhost:%s\n' "$API_PORT"
printf 'Web: http://localhost:%s\n\n' "$WEB_PORT"

while true; do
  if [[ "$API_STARTED" -eq 1 ]] && ! kill -0 "$API_PID" 2>/dev/null; then
    break
  fi

  if [[ "$WEB_STARTED" -eq 1 ]] && ! kill -0 "$WEB_PID" 2>/dev/null; then
    break
  fi

  sleep 1
done
