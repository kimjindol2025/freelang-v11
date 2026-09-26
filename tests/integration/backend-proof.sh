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
jq -e '.ok == false and .data == null and .error.code == "UNAUTHORIZED"' "${proof_tmp}/unauthorized.json" >/dev/null

wrong_token_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'authorization: Bearer wrong-token' http://127.0.0.1:40117/api/items)"
[[ "${wrong_token_status}" == "401" ]]

unauthorized_write_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST -H 'content-type: application/json' --data '{"name":"blocked"}' \
  http://127.0.0.1:40117/api/items)"
[[ "${unauthorized_write_status}" == "401" ]]

before_create="$(curl -fsS -H "${auth_header}" http://127.0.0.1:40117/api/items)"
jq -e '.ok == true and .error == null and (.data.items | length) == 0' <<<"${before_create}" >/dev/null

invalid_json_status="$(curl -sS -o "${proof_tmp}/invalid-json.json" -w '%{http_code}' \
  -X POST -H "${auth_header}" -H 'idempotency-key: invalid-json' -H 'content-type: application/json' \
  --data '{"name":' http://127.0.0.1:40117/api/items)"
[[ "${invalid_json_status}" == "400" ]]
jq -e '.ok == false and .data == null and .error.code == "INVALID_JSON"' \
  "${proof_tmp}/invalid-json.json" >/dev/null

missing_name_status="$(curl -sS -o "${proof_tmp}/missing-name.json" -w '%{http_code}' \
  -X POST -H "${auth_header}" -H 'idempotency-key: missing-name' -H 'content-type: application/json' \
  --data '{}' http://127.0.0.1:40117/api/items)"
[[ "${missing_name_status}" == "400" ]]
jq -e '.error.code == "INVALID_INPUT"' "${proof_tmp}/missing-name.json" >/dev/null

blank_name_status="$(curl -sS -o "${proof_tmp}/blank-name.json" -w '%{http_code}' \
  -X POST -H "${auth_header}" -H 'idempotency-key: blank-name' -H 'content-type: application/json' \
  --data '{"name":"   "}' http://127.0.0.1:40117/api/items)"
[[ "${blank_name_status}" == "400" ]]
jq -e '.error.code == "INVALID_INPUT"' "${proof_tmp}/blank-name.json" >/dev/null

for operation in get update delete; do
  case "${operation}" in
    get)
      method=GET
      body_args=()
      ;;
    update)
      method=PUT
      body_args=(-H 'content-type: application/json' --data '{"name":"missing","version":1}')
      ;;
    delete)
      method=DELETE
      body_args=()
      ;;
  esac
  not_found_status="$(curl -sS -o "${proof_tmp}/not-found-${operation}.json" -w '%{http_code}' \
    -X "${method}" -H "${auth_header}" "${body_args[@]}" \
    http://127.0.0.1:40117/api/items/999999)"
  [[ "${not_found_status}" == "404" ]]
  jq -e '.ok == false and .data == null and .error.code == "NOT_FOUND"' \
    "${proof_tmp}/not-found-${operation}.json" >/dev/null
done

after_failures="$(curl -fsS -H "${auth_header}" http://127.0.0.1:40117/api/items)"
jq -e '(.data.items | length) == 0' <<<"${after_failures}" >/dev/null

missing_key_status="$(curl -sS -o "${proof_tmp}/missing-key.json" -w '%{http_code}' \
  -X POST -H "${auth_header}" -H 'content-type: application/json' \
  --data '{"name":"first"}' http://127.0.0.1:40117/api/items)"
[[ "${missing_key_status}" == "400" ]]
jq -e '.error.code == "IDEMPOTENCY_KEY_REQUIRED"' "${proof_tmp}/missing-key.json" >/dev/null

mkdir "${proof_tmp}/concurrent"
request_pids=()
for request_no in $(seq 1 20); do
  curl -fsS -X POST -H "${auth_header}" -H 'idempotency-key: concurrent-create-1' \
    -H 'content-type: application/json' --data '{"name":"first"}' \
    http://127.0.0.1:40117/api/items >"${proof_tmp}/concurrent/${request_no}.json" &
  request_pids+=("$!")
done
for request_pid in "${request_pids[@]}"; do
  wait "${request_pid}"
done

jq -s -e \
  'length == 20 and all(.[]; .ok == true and .data.item.name == "first") and (map(.data.item.id) | unique | length) == 1' \
  "${proof_tmp}"/concurrent/*.json >/dev/null
item_id="$(jq -er '.data.item.id' "${proof_tmp}/concurrent/1.json")"

replayed="$(curl -fsS -X POST -H "${auth_header}" -H 'idempotency-key: concurrent-create-1' \
  -H 'content-type: application/json' --data '{"name":"first"}' \
  http://127.0.0.1:40117/api/items)"
jq -e --argjson id "${item_id}" '.data.item.id == $id' <<<"${replayed}" >/dev/null

conflict_status="$(curl -sS -o "${proof_tmp}/conflict.json" -w '%{http_code}' \
  -X POST -H "${auth_header}" -H 'idempotency-key: concurrent-create-1' \
  -H 'content-type: application/json' --data '{"name":"different"}' \
  http://127.0.0.1:40117/api/items)"
[[ "${conflict_status}" == "409" ]]
jq -e '.error.code == "IDEMPOTENCY_CONFLICT"' "${proof_tmp}/conflict.json" >/dev/null

after_concurrency="$(curl -fsS -H "${auth_header}" http://127.0.0.1:40117/api/items)"
jq -e --argjson id "${item_id}" \
  '(.data.items | length) == 1 and .data.items[0].id == $id and .data.items[0].name == "first"' \
  <<<"${after_concurrency}" >/dev/null

read_one="$(curl -fsS -H "${auth_header}" "http://127.0.0.1:40117/api/items/${item_id}")"
jq -e --argjson id "${item_id}" '.data.item.id == $id and .data.item.name == "first" and .data.item.version == 1' <<<"${read_one}" >/dev/null

missing_version_status="$(curl -sS -o "${proof_tmp}/missing-version.json" -w '%{http_code}' \
  -X PUT -H "${auth_header}" -H 'content-type: application/json' \
  --data '{"name":"updated"}' "http://127.0.0.1:40117/api/items/${item_id}")"
[[ "${missing_version_status}" == "400" ]]
jq -e '.error.code == "INVALID_INPUT"' "${proof_tmp}/missing-version.json" >/dev/null

update_pids=()
for variant in a b; do
  curl -sS -o "${proof_tmp}/update-${variant}.json" -w '%{http_code}' \
    -X PUT -H "${auth_header}" -H 'content-type: application/json' \
    --data "{\"name\":\"updated-${variant}\",\"version\":1}" \
    "http://127.0.0.1:40117/api/items/${item_id}" >"${proof_tmp}/update-${variant}.status" &
  update_pids+=("$!")
done
for update_pid in "${update_pids[@]}"; do
  wait "${update_pid}"
done

status_a="$(cat "${proof_tmp}/update-a.status")"
status_b="$(cat "${proof_tmp}/update-b.status")"
if [[ "${status_a}" == "200" && "${status_b}" == "409" ]]; then
  winner_file="${proof_tmp}/update-a.json"
  loser_file="${proof_tmp}/update-b.json"
elif [[ "${status_a}" == "409" && "${status_b}" == "200" ]]; then
  winner_file="${proof_tmp}/update-b.json"
  loser_file="${proof_tmp}/update-a.json"
else
  printf 'unexpected CAS statuses: a=%s b=%s\n' "${status_a}" "${status_b}" >&2
  exit 1
fi

jq -e '.ok == true and .data.item.version == 2' "${winner_file}" >/dev/null
jq -e '.ok == false and .error.code == "VERSION_CONFLICT"' "${loser_file}" >/dev/null
winning_name="$(jq -er '.data.item.name' "${winner_file}")"

stale_status="$(curl -sS -o "${proof_tmp}/stale-update.json" -w '%{http_code}' \
  -X PUT -H "${auth_header}" -H 'content-type: application/json' \
  --data '{"name":"stale-overwrite","version":1}' \
  "http://127.0.0.1:40117/api/items/${item_id}")"
[[ "${stale_status}" == "409" ]]
jq -e '.error.code == "VERSION_CONFLICT"' "${proof_tmp}/stale-update.json" >/dev/null

stop_server
start_server

after_restart="$(curl -fsS -H "${auth_header}" http://127.0.0.1:40117/api/items)"
jq -e --argjson id "${item_id}" --arg name "${winning_name}" \
  '.ok == true and (.data.items | length) == 1 and .data.items[0].id == $id and .data.items[0].name == $name and .data.items[0].version == 2' \
  <<<"${after_restart}" >/dev/null

deleted="$(curl -fsS -X DELETE -H "${auth_header}" "http://127.0.0.1:40117/api/items/${item_id}")"
jq -e '.ok == true and .data.deleted == 1' <<<"${deleted}" >/dev/null

final="$(curl -fsS -H "${auth_header}" http://127.0.0.1:40117/api/items)"
jq -e '.ok == true and (.data.items | length) == 0' <<<"${final}" >/dev/null

printf '%s\n' \
  'BACKEND_PROOF=PASS' \
  'NO_TOKEN_BLOCKED=PASS' \
  'WRONG_TOKEN_BLOCKED=PASS' \
  'UNAUTHORIZED_MUTATION_BLOCKED=PASS' \
  'VALID_TOKEN_ALLOWED=PASS' \
  'INVALID_JSON=PASS' \
  'INVALID_INPUT=PASS' \
  'NOT_FOUND_GET_UPDATE_DELETE=PASS' \
  'FAILED_REQUEST_DB_MUTATION=0' \
  'IDEMPOTENCY_KEY_REQUIRED=PASS' \
  'SAME_KEY_CONCURRENCY=20/20_PASS' \
  'SAME_KEY_SINGLE_ROW=PASS' \
  'SAME_KEY_REPLAY=PASS' \
  'IDEMPOTENCY_CONFLICT=PASS' \
  'VERSION_REQUIRED=PASS' \
  'SAME_VERSION_CONCURRENCY=1_SUCCESS_1_CONFLICT' \
  'STALE_WRITE_BLOCKED=PASS' \
  'FINAL_VERSION=2' \
  'CREATE=PASS' \
  'READ=PASS' \
  'UPDATE=PASS' \
  'RESTART_PERSISTENCE=PASS' \
  'DELETE=PASS'
