#!/usr/bin/env bash

set -euo pipefail

readonly repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly image_tag="wise-frontend-delivery-test"
readonly container_name="wise-frontend-delivery-test-$$"
readonly public_api_url="https://api.delivery-test.invalid/v1"

cleanup() {
  docker rm --force "${container_name}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

assert_contains() {
  local value="$1"
  local expected="$2"
  local description="$3"

  if [[ "${value}" != *"${expected}"* ]]; then
    printf 'Expected %s to contain %q, but got:\n%s\n' "${description}" "${expected}" "${value}" >&2
    exit 1
  fi
}

assert_not_contains() {
  local value="$1"
  local unexpected="$2"
  local description="$3"

  if [[ "${value}" == *"${unexpected}"* ]]; then
    printf 'Expected %s not to contain %q, but got:\n%s\n' "${description}" "${unexpected}" "${value}" >&2
    exit 1
  fi
}

cd "${repository_root}"

grep -Eq '^FROM node:22([.-]|$)' apps/frontend/Dockerfile

if grep -Eiq 'v[i]te' apps/frontend/Dockerfile docker-compose.yml .github/workflows/ci.yml; then
  printf 'Legacy frontend build references remain in container or CI configuration.\n' >&2
  exit 1
fi

docker build \
  --file apps/frontend/Dockerfile \
  --build-arg "EXPO_PUBLIC_API_URL=${public_api_url}" \
  --tag "${image_tag}" \
  .

docker run --detach --name "${container_name}" --publish-all "${image_tag}" >/dev/null
if [[ "$(docker inspect --format '{{.State.Running}}' "${container_name}")" != 'true' ]]; then
  docker logs "${container_name}" >&2
  exit 1
fi

readonly host_port="$(docker port "${container_name}" 80/tcp | head -n 1 | sed 's/.*://')"
readonly base_url="http://127.0.0.1:${host_port}"

for _ in {1..30}; do
  if curl --fail --silent "${base_url}/health" >/dev/null; then
    break
  fi
  sleep 1
done

readonly health_body="$(curl --fail --silent "${base_url}/health")"
[[ "${health_body}" == 'ok' ]]

readonly root_body="$(curl --fail --silent "${base_url}/")"
assert_contains "${root_body}" '<div id="root"></div>' 'SPA document'

readonly -a spa_paths=(
  '/'
  '/sessao'
  '/perfil'
  '/guilda'
  '/route-that-does-not-exist'
)

route_body=''
for spa_path in "${spa_paths[@]}"; do
  route_body="$(curl --fail --silent "${base_url}${spa_path}")"
  if [[ "${route_body}" != "${root_body}" ]]; then
    printf 'Expected %s to serve the same SPA document as /, but the responses differ.\n' "${spa_path}" >&2
    exit 1
  fi
done

readonly asset_path="$(printf '%s' "${root_body}" | grep -Eo '/[^" ]*[.-][[:xdigit:]]{16,}[^" ]*\.(js|css|png)' | head -n 1)"
[[ -n "${asset_path}" ]]

readonly document_headers="$(curl --fail --silent --head "${base_url}/")"
readonly asset_headers="$(curl --fail --silent --head "${base_url}${asset_path}")"
assert_not_contains "${document_headers,,}" 'immutable' 'main document headers'
assert_contains "${asset_headers,,}" 'cache-control: public, max-age=31536000, immutable' 'hashed asset headers'

printf 'Frontend delivery smoke test passed.\n'
