#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
WORK="${1:?usage: run-task943-perf.sh <empty-work-dir>}"
DURATION="${2:-60}"
[[ "$DURATION" =~ ^[0-9]+$ ]] && (( DURATION >= 1 && DURATION <= 60 )) || exit 2
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'task 9-43 work directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK/public"
printf 'LOAD_STATIC_EXAMPLE_OK\n' >"$WORK/public/sample.txt"

parse_cpus() {
  local part first last cpu
  IFS=',' read -r -a parts <<<"$1"
  for part in "${parts[@]}"; do
    if [[ "$part" == *-* ]]; then
      first="${part%-*}"; last="${part#*-}"
      for ((cpu=first; cpu<=last; cpu++)); do printf '%s\n' "$cpu"; done
    else
      printf '%s\n' "$part"
    fi
  done
}
mapfile -t ALLOWED_CPUS < <(parse_cpus "$(awk '/Cpus_allowed_list:/ {print $2}' /proc/self/status)")
mapfile -t ONLINE_CPUS < <(parse_cpus "$(cat /sys/devices/system/cpu/online)")
declare -A ONLINE_SET=() ALLOWED_SET=() USED_CORES=()
for cpu in "${ONLINE_CPUS[@]}"; do ONLINE_SET["$cpu"]=1; done
for cpu in "${ALLOWED_CPUS[@]}"; do [[ -n "${ONLINE_SET[$cpu]:-}" ]] && ALLOWED_SET["$cpu"]=1; done
mapfile -t USABLE_CPUS < <(printf '%s\n' "${!ALLOWED_SET[@]}" | sort -n)
(( ${#USABLE_CPUS[@]} >= 2 )) || { echo 'PERF_CPU_SEPARATION=FAIL fewer than 2 online allowed CPUs'; exit 2; }
SERVER_CPU="${USABLE_CPUS[0]}"
SERVER_SIBLINGS="$(tr -d '[:space:]' <"/sys/devices/system/cpu/cpu${SERVER_CPU}/topology/thread_siblings_list")"
USED_CORES["$SERVER_SIBLINGS"]=1
CLIENT_CPUS=""
for cpu in "${USABLE_CPUS[@]}"; do
  siblings="$(tr -d '[:space:]' <"/sys/devices/system/cpu/cpu${cpu}/topology/thread_siblings_list")"
  [[ "$siblings" == "$SERVER_SIBLINGS" || -n "${USED_CORES[$siblings]:-}" ]] && continue
  CLIENT_CPUS+="${CLIENT_CPUS:+,}${cpu}"
  USED_CORES["$siblings"]=1
  [[ "${#USED_CORES[@]}" -ge 8 ]] && break
done
[[ -n "$CLIENT_CPUS" ]] || { echo 'PERF_CPU_SEPARATION=FAIL no distinct physical client core'; exit 2; }
IFS=',' read -r -a CLIENT_CPU_LIST <<<"$CLIENT_CPUS"
printf 'PERF_SERVER_CPU=%s\nPERF_SERVER_CORE_SIBLINGS=%s\nPERF_CLIENT_CPUS=%s\nPERF_CLIENT_PHYSICAL_CORES=%s\nPERF_CPU_CORE_SEPARATED=1\n' \
  "$SERVER_CPU" "$SERVER_SIBLINGS" "$CLIENT_CPUS" "${#CLIENT_CPU_LIST[@]}"
printf 'PERF_CPU_ONLINE=%s\n' "$(getconf _NPROCESSORS_ONLN)"
printf 'PERF_CPU_ALLOWED_COUNT=%s\n' "${#USABLE_CPUS[@]}"
if [[ -r /sys/fs/cgroup/cpu.max ]]; then printf 'PERF_CPU_QUOTA='; cat /sys/fs/cgroup/cpu.max; fi

SEED="$ROOT/bin/cgc-bin-x86_64-seed-v11"
"$SEED" "$ROOT/self/cgc-main.fl" "$WORK/stage2.c"
bash "$ROOT/scripts/build-cgc-native.sh" "$WORK/stage2.c" "$WORK/stage2-bin" >"$WORK/stage2.build"
"$WORK/stage2-bin" "$ROOT/tests/task936/soak-server.fl" "$WORK/server.c"
gcc -w -DFL_HTTP_PERF_DIAGNOSTICS -I "$ROOT/runtime" -o "$WORK/server" "$WORK/server.c" \
  "$ROOT/runtime/core.c" "$ROOT/runtime/collection.c" "$ROOT/runtime/io.c" "$ROOT/runtime/math.c" \
  "$ROOT/runtime/error.c" "$ROOT/runtime/process.c" "$ROOT/runtime/json.c" "$ROOT/runtime/db.c" \
  "$ROOT/runtime/http_server.c" "$ROOT/runtime/auth.c" "$ROOT/runtime/cgc-bridge.c" \
  -lsqlite3 -lcrypto -lm
gcc -std=c11 -O2 -Wall -Wextra -Werror -pthread -o "$WORK/load-client" "$ROOT/tests/task938/load-client.c"

stage=94200
for workers in 0 2 4 8 16; do
  for route in ok mixed; do
    stage=$((stage + 1))
    label="w${workers}-${route}"
    db="$WORK/$label.sqlite"
    log="$WORK/$label.server.log"
    FL_HTTP_WORKERS="$workers" FL_HTTP_PORT=0 MIXSOAK_DB="$db" \
      taskset -c "$SERVER_CPU" "$WORK/server" "$WORK/public" >"$log" 2>&1 &
    SERVER_PID=$!
    cleanup() { kill -TERM "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; }
    trap cleanup EXIT INT TERM
    port=""
    for _ in $(seq 1 200); do
      port="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$log" | head -n 1)"
      test -n "$port" && break
      kill -0 "$SERVER_PID"
      sleep 0.05
    done
    test -n "$port"
    : >"$WORK/$label.acks.sql"
    taskset -c "$CLIENT_CPUS" "$WORK/load-client" "$port" 1000 "$DURATION" "$stage" \
      "$WORK/$label.acks.sql" "$route" >"$WORK/$label.client.log" 2>&1 &
    CLIENT_PID=$!
    pidstat -u -p "$CLIENT_PID" 1 "$DURATION" >"$WORK/$label.pidstat" 2>&1 &
    PIDSTAT_PID=$!
    wait "$CLIENT_PID"
    wait "$PIDSTAT_PID" || true
    printf 'PERF_RESULT workers=%s route=%s ' "$workers" "$route"
    sed -n 's/^LOAD_STAGE /LOAD_STAGE /p' "$WORK/$label.client.log"
    printf 'PERF_CLIENT_CPU_BEGIN workers=%s route=%s\n' "$workers" "$route"
    cat "$WORK/$label.pidstat"
    printf 'PERF_CLIENT_CPU_END workers=%s route=%s\n' "$workers" "$route"
    kill -TERM "$SERVER_PID"
    wait "$SERVER_PID"
    grep '^HTTP_PERF_WORKER ' "$log" || true
    trap - EXIT INT TERM
  done
done
