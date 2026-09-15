#!/usr/bin/env bash

set -euo pipefail

readonly repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly compose_file="${repository_root}/docker-compose.e2e.yml"
readonly compose_project="${COMPOSE_PROJECT_NAME:-wise-e2e-${PPID}-${RANDOM}}"

port_is_available() {
  node --input-type=module -e "
    import net from 'node:net';
    const port = Number(process.argv[1]);
    const server = net.createServer();
    server.once('error', () => process.exit(1));
    server.listen({ host: '127.0.0.1', port }, () => {
      server.close(() => process.exit(0));
    });
  " "$1"
}

find_free_port() {
  local excluded="${1:-}"
  local candidate

  while true; do
    candidate="$(node --input-type=module -e "
      import net from 'node:net';
      const server = net.createServer();
      server.listen({ host: '127.0.0.1', port: 0 }, () => {
        const address = server.address();
        if (!address || typeof address === 'string') process.exit(1);
        process.stdout.write(String(address.port));
        server.close(() => process.exit(0));
      });
    ")"
    if [[ "${candidate}" != "${excluded}" ]] && port_is_available "${candidate}"; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done
}

validate_explicit_port() {
  local port="$1"
  if ! [[ "${port}" =~ ^[0-9]+$ ]] || ! port_is_available "${port}"; then
    printf 'E2E port %s is unavailable; choose another E2E_*_PORT.\n' "${port}" >&2
    return 1
  fi
}

if [[ -n "${E2E_BACKEND_PORT:-}" ]]; then
  validate_explicit_port "${E2E_BACKEND_PORT}"
fi
readonly backend_port="${E2E_BACKEND_PORT:-$(find_free_port)}"
readonly frontend_port="${E2E_FRONTEND_PORT:-$(find_free_port "${backend_port}")}"
if [[ "${backend_port}" == "${frontend_port}" ]]; then
  printf 'E2E backend and frontend ports must be distinct.\n' >&2
  exit 1
fi
if [[ -n "${E2E_FRONTEND_PORT:-}" ]]; then
  validate_explicit_port "${frontend_port}"
fi

readonly base_url="${E2E_BASE_URL:-https://127.0.0.1:${frontend_port}}"
readonly api_url="${E2E_API_URL:-${base_url}/api/v1}"
readonly tls_dir="$(mktemp -d "${TMPDIR:-/tmp}/wise-warrior-e2e-tls.XXXXXX")"

capture_failure_diagnostics() {
  local diagnostics_dir="${repository_root}/apps/frontend/test-results"
  mkdir -p "${diagnostics_dir}" || true
  COMPOSE_PROJECT_NAME="${compose_project}" docker compose \
    --file "${compose_file}" ps >"${diagnostics_dir}/compose-ps.txt" 2>&1 || true
  COMPOSE_PROJECT_NAME="${compose_project}" docker compose \
    --file "${compose_file}" logs --no-color \
    | sed -E \
      -e 's/wise-e2e-(access|refresh)-secret/[REDACTED]/g' \
      -e 's/wise-e2e-(root-)?password/[REDACTED]/g' \
    >"${diagnostics_dir}/compose-logs.txt" 2>&1 || true
}

cleanup() {
  local status=$?
  if [[ "${status}" -ne 0 ]]; then
    capture_failure_diagnostics
  fi
  COMPOSE_PROJECT_NAME="${compose_project}" docker compose \
    --file "${compose_file}" \
    down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -f "${tls_dir}/server.crt" "${tls_dir}/server.key"
  rmdir "${tls_dir}" 2>/dev/null || true
  return "${status}"
}

trap cleanup EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "${tls_dir}/server.key" \
  -out "${tls_dir}/server.crt" \
  -subj '/CN=127.0.0.1' \
  -addext 'subjectAltName=IP:127.0.0.1' >/dev/null 2>&1

cd "${repository_root}"

export COMPOSE_PROJECT_NAME="${compose_project}"
export E2E_BACKEND_PORT="${backend_port}"
export E2E_FRONTEND_PORT="${frontend_port}"
export E2E_BASE_URL="${base_url}"
export E2E_API_URL="${api_url}"
export E2E_TLS_DIR="${tls_dir}"

docker compose --file "${compose_file}" up --build --detach

for _ in {1..60}; do
  if curl --insecure --fail --silent "${base_url}/health" >/dev/null \
    && curl --insecure --fail --silent "${api_url}/health" >/dev/null; then
    break
  fi
  sleep 1
done

curl --insecure --fail --silent "${base_url}/health" >/dev/null
curl --insecure --fail --silent "${api_url}/health" >/dev/null

npm run test:e2e --workspace apps/frontend -- "$@"
