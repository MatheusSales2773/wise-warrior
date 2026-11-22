#!/usr/bin/env bash
# Gera wise-warrior.zip na estrutura da entrega final (docs/ api/ web/ app/).
# Parte só dos arquivos versionados em HEAD (git archive), então node_modules,
# .env, android/, ios/, .expo/ e relatórios de teste nunca entram.
# Pode ser rodado de novo a cada reenvio: o zip anterior é substituído.

set -euo pipefail

readonly repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly output_zip="${repository_root}/wise-warrior.zip"
readonly staging="$(mktemp -d)"
readonly source_dir="${staging}/src"
readonly package_dir="${staging}/wise-warrior"

trap 'rm -rf "${staging}"' EXIT

fail() {
  printf 'empacotar: %s\n' "$1" >&2
  exit 1
}

cd "${repository_root}"

if [[ -n "$(git status --porcelain)" ]]; then
  printf 'Aviso: há alterações não commitadas; o zip usa só o que está em HEAD.\n' >&2
fi

mkdir -p "${source_dir}" "${package_dir}"
git archive HEAD | tar -x -C "${source_dir}"

# Gera um lockfile próprio a partir do lockfile do workspace, mantendo as
# mesmas versões, para que a pasta instale com npm fora do monorepo.
standalone_lockfile() {
  local target="$1"
  cp "${source_dir}/package-lock.json" "${target}/package-lock.json"
  (cd "${target}" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null)
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const lock = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const key of Object.keys(lock.packages)) {
      if (key.startsWith("apps/")) delete lock.packages[key];
    }
    fs.writeFileSync(file, JSON.stringify(lock, null, 2) + "\n");
  ' "${target}/package-lock.json"
}

# Arquivos que só funcionam com a raiz do monorepo como contexto.
readonly -a monorepo_only=(Dockerfile e2e-gateway.Dockerfile test-delivery.sh)

copy_app() {
  local from="$1" to="$2"
  cp -R "${source_dir}/apps/${from}" "${package_dir}/${to}"
  cp "${source_dir}/entrega/${to}/README.md" "${package_dir}/${to}/README.md"
  for file in "${monorepo_only[@]}"; do
    rm -f "${package_dir}/${to}/${file}"
  done
}

cp -R "${source_dir}/docs" "${package_dir}/docs"

copy_app backend api
standalone_lockfile "${package_dir}/api"

copy_app frontend web
standalone_lockfile "${package_dir}/web"
copy_app frontend app
cp "${package_dir}/web/package-lock.json" "${package_dir}/app/package-lock.json"

for app in api web app; do
  [[ -f "${package_dir}/${app}/README.md" ]] || fail "${app}/README.md ausente"
  [[ -f "${package_dir}/${app}/package-lock.json" ]] || fail "${app}/package-lock.json ausente"
  # Caminhos do monorepo: apps/..., ../../backend|frontend e o node_modules da raiz do workspace.
  if grep -rlE 'apps/(backend|frontend)|\.\./\.\./(backend|frontend)/|\.\./\.\./\.\./node_modules' "${package_dir}/${app}"; then
    fail "${app}/ ainda referencia o monorepo (arquivos acima)"
  fi
done

rm -f "${output_zip}"
(cd "${staging}" && zip -rqX "${output_zip}" wise-warrior)

forbidden="$(zipinfo -1 "${output_zip}" | grep -E '(^|/)(node_modules|\.env)(/|$)' || true)"
if [[ -n "${forbidden}" ]]; then
  rm -f "${output_zip}"
  fail "o zip continha node_modules ou .env e foi descartado:
${forbidden}"
fi

printf 'Gerado %s (%s)\n' "${output_zip}" "$(du -h "${output_zip}" | cut -f1)"
