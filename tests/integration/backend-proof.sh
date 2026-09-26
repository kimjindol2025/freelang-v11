#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
proof_tmp="$(mktemp -d /tmp/freelang-backend-proof.XXXXXX)"
proof_db="${proof_tmp}/proof.sqlite"
server_pid=""

cleanup() {
  if [[ -n "${server_pid}" ]]; then
    kill "${server_pid}" 2>/dev/null || true
    wait "${server_pid}" 2>/dev/null || true
  fi
  case "${proof_tmp}" in
    /tmp/freelang-backend-proof.*) rm -rf -- "${proof_tmp}" ;;
  esac
}
trap cleanup EXIT

start_server() {
  FL_BACKEND_PROOF_DB="${proof_db}" \
    node "${repo_dir}/bootstrap.js" run "${repo_dir}/examples/backend-proof/app.fl" \
    >"${proof_tmp}/server.log" 2>&1 &
  server_pid=$!

  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS http://127.0.0.1:40117/health >/dev/null; then
      return 0
    fi
    sleep 0.2
  done

  cat "${proof_tmp}/server.log"
  return 1
}

stop_server() {
  kill "${server_pid}"
  wait "${server_pid}" 2>/dev/null || true
  server_pid=""
}

start_server

created="$(curl -fsS -X POST -H 'content-type: application/json' \
  --data '{"name":"first"}' http://127.0.0.1:40117/api/items)"
item_id="$(jq -er '.item.id' <<<"${created}")"
jq -e '.ok == true and .item.name == "first"' <<<"${created}" >/dev/null

updated="$(curl -fsS -X PUT -H 'content-type: application/json' \
  --data '{"name":"updated"}' "http://127.0.0.1:40117/api/items/${item_id}")"
jq -e '.ok == true and .item.name == "updated"' <<<"${updated}" >/dev/null

stop_server
start_server

after_restart="$(curl -fsS http://127.0.0.1:40117/api/items)"
jq -e --argjson id "${item_id}" \
  '.ok == true and (.items | length) == 1 and .items[0].id == $id and .items[0].name == "updated"' \
  <<<"${after_restart}" >/dev/null

deleted="$(curl -fsS -X DELETE "http://127.0.0.1:40117/api/items/${item_id}")"
jq -e '.ok == true and .deleted == 1' <<<"${deleted}" >/dev/null

final="$(curl -fsS http://127.0.0.1:40117/api/items)"
jq -e '.ok == true and (.items | length) == 0' <<<"${final}" >/dev/null

printf '%s\n' \
  'BACKEND_PROOF=PASS' \
  'CREATE=PASS' \
  'READ=PASS' \
  'UPDATE=PASS' \
  'RESTART_PERSISTENCE=PASS' \
  'DELETE=PASS'
