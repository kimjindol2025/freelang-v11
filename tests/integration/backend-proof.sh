#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
proof_tmp="$(mktemp -d /tmp/freelang-backend-proof.XXXXXX)"
proof_db="${proof_tmp}/proof.sqlite"
proof_token="proof-token-40117"
server_pid=""
auth_header="authorization: Bearer ${proof_token}"

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
  FL_BACKEND_PROOF_TOKEN="${proof_token}" \
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

unauthorized_status="$(curl -sS -o "${proof_tmp}/unauthorized.json" -w '%{http_code}' \
  http://127.0.0.1:40117/api/items)"
[[ "${unauthorized_status}" == "401" ]]
jq -e '.ok == false and .error == "UNAUTHORIZED"' "${proof_tmp}/unauthorized.json" >/dev/null

wrong_token_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'authorization: Bearer wrong-token' http://127.0.0.1:40117/api/items)"
[[ "${wrong_token_status}" == "401" ]]

unauthorized_write_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST -H 'content-type: application/json' --data '{"name":"blocked"}' \
  http://127.0.0.1:40117/api/items)"
[[ "${unauthorized_write_status}" == "401" ]]

before_create="$(curl -fsS -H "${auth_header}" http://127.0.0.1:40117/api/items)"
jq -e '.ok == true and (.items | length) == 0' <<<"${before_create}" >/dev/null

created="$(curl -fsS -X POST -H "${auth_header}" -H 'content-type: application/json' \
  --data '{"name":"first"}' http://127.0.0.1:40117/api/items)"
item_id="$(jq -er '.item.id' <<<"${created}")"
jq -e '.ok == true and .item.name == "first"' <<<"${created}" >/dev/null

updated="$(curl -fsS -X PUT -H "${auth_header}" -H 'content-type: application/json' \
  --data '{"name":"updated"}' "http://127.0.0.1:40117/api/items/${item_id}")"
jq -e '.ok == true and .item.name == "updated"' <<<"${updated}" >/dev/null

stop_server
start_server

after_restart="$(curl -fsS -H "${auth_header}" http://127.0.0.1:40117/api/items)"
jq -e --argjson id "${item_id}" \
  '.ok == true and (.items | length) == 1 and .items[0].id == $id and .items[0].name == "updated"' \
  <<<"${after_restart}" >/dev/null

deleted="$(curl -fsS -X DELETE -H "${auth_header}" "http://127.0.0.1:40117/api/items/${item_id}")"
jq -e '.ok == true and .deleted == 1' <<<"${deleted}" >/dev/null

final="$(curl -fsS -H "${auth_header}" http://127.0.0.1:40117/api/items)"
jq -e '.ok == true and (.items | length) == 0' <<<"${final}" >/dev/null

printf '%s\n' \
  'BACKEND_PROOF=PASS' \
  'NO_TOKEN_BLOCKED=PASS' \
  'WRONG_TOKEN_BLOCKED=PASS' \
  'UNAUTHORIZED_MUTATION_BLOCKED=PASS' \
  'VALID_TOKEN_ALLOWED=PASS' \
  'CREATE=PASS' \
  'READ=PASS' \
  'UPDATE=PASS' \
  'RESTART_PERSISTENCE=PASS' \
  'DELETE=PASS'
