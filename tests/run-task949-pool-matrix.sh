#!/usr/bin/env bash
set -u

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task949-pool-matrix.sh <stage2-compiler> <record-dir>}"
WORK="${2:?usage: run-task949-pool-matrix.sh <stage2-compiler> <record-dir>}"
RUNTIME="$ROOT/runtime"
mkdir -p "$WORK"

"$COMPILER" "$ROOT/tests/task936/soak-server.fl" "$WORK/pool-server.c" >"$WORK/pool-server.compile" 2>&1 || exit 2
gcc -w -I "$RUNTIME" -o "$WORK/pool-server" "$WORK/pool-server.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/db.c" \
  "$RUNTIME/http_server.c" "$RUNTIME/auth.c" "$RUNTIME/cgc-bridge.c" -lsqlite3 -lcrypto -lm \
  >"$WORK/pool-server.build" 2>&1 || exit 2
gcc -std=c11 -O2 -Wall -Wextra -Werror -pthread -o "$WORK/load-client" "$ROOT/tests/task938/load-client.c" \
  >"$WORK/load-client.build" 2>&1 || exit 2
mkdir -p "$WORK/public"
printf 'LOAD_STATIC_EXAMPLE_OK\n' >"$WORK/public/sample.txt"

failures=0
for mode in standalone pool; do
  for traced in no-strace strace; do
    for repeat in 1 2 3; do
      name="$mode-$traced-$repeat"
      run="$WORK/$name"
      log="$WORK/$name.log"
      trace="$WORK/$name.strace"
      rc=0
      if [[ "$mode" == standalone ]]; then
        if [[ "$traced" == strace ]]; then
          strace -f -e trace=execve -o "$trace" timeout --signal=TERM --kill-after=10s 900s \
            bash "$ROOT/tests/run-task944-worker16-ok.sh" "$ROOT/bin/cgc-bin-x86_64-seed-v11" "$run" >"$log" 2>&1 || rc=$?
        else
          timeout --signal=TERM --kill-after=10s 900s \
            bash "$ROOT/tests/run-task944-worker16-ok.sh" "$ROOT/bin/cgc-bin-x86_64-seed-v11" "$run" >"$log" 2>&1 || rc=$?
        fi
        grep '^LOAD_STAGE stage=94401 ' "$log" || true
      else
        mkdir -p "$run"
        FL_HTTP_WORKERS=16 FL_HTTP_PORT=0 MIXSOAK_DB="$run/bench.sqlite" \
          "$WORK/pool-server" "$WORK/public" >"$run/server.log" 2>&1 &
        server_pid=$!
        port=""
        for _ in $(seq 1 100); do
          port="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$run/server.log" | head -n 1)"
          test -n "$port" && break
          kill -0 "$server_pid" 2>/dev/null || break
          sleep 0.05
        done
        if test -n "$port"; then
          : >"$run/acks.sql"
          if [[ "$traced" == strace ]]; then
            strace -f -e trace=execve -o "$trace" timeout --signal=TERM --kill-after=10s 900s \
              "$WORK/load-client" "$port" 1000 60 94901 "$run/acks.sql" ok >"$log" 2>&1 || rc=$?
          else
            timeout --signal=TERM --kill-after=10s 900s \
              "$WORK/load-client" "$port" 1000 60 94901 "$run/acks.sql" ok >"$log" 2>&1 || rc=$?
          fi
        else
          rc=1
          printf 'POOL_SERVER_START_FAILED\n' >"$log"
        fi
        kill -TERM "$server_pid" 2>/dev/null || true
        wait "$server_pid" 2>/dev/null || true
        grep '^LOAD_STAGE stage=94901 ' "$log" || true
      fi
      printf 'MATRIX condition=%s-%s repeat=%s rc=%s\n' "$mode" "$traced" "$repeat" "$rc"
      if (( rc != 0 )); then
        failures=$((failures + 1))
        printf 'MATRIX_LOG_TAIL_BEGIN condition=%s-%s repeat=%s\n' "$mode" "$traced" "$repeat"
        tail -n 30 "$log"
        printf 'MATRIX_LOG_TAIL_END condition=%s-%s repeat=%s\n' "$mode" "$traced" "$repeat"
      fi
    done
  done
done
printf 'MATRIX_COMPLETED=%s/12\n' "$((12 - failures))"
(( failures == 0 ))
