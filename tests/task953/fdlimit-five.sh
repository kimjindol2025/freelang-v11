#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
COMPILER="${1:?usage: fdlimit-five.sh <compiler> <record-dir>}"
WORK="${2:?usage: fdlimit-five.sh <compiler> <record-dir>}"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'record directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK"
"$COMPILER" "$ROOT/tests/task931/disk.fl" "$WORK/disk.c" >"$WORK/compile.log" 2>&1
gcc -w -I "$ROOT/runtime" -o "$WORK/disk" "$WORK/disk.c" \
  "$ROOT/runtime/core.c" "$ROOT/runtime/collection.c" "$ROOT/runtime/io.c" \
  "$ROOT/runtime/math.c" "$ROOT/runtime/error.c" "$ROOT/runtime/process.c" \
  "$ROOT/runtime/json.c" "$ROOT/runtime/db.c" "$ROOT/runtime/http_server.c" \
  "$ROOT/runtime/auth.c" "$ROOT/runtime/cgc-bridge.c" -lsqlite3 -lcrypto -lm \
  >"$WORK/build.log" 2>&1

for attempt in 1 2 3 4 5; do
  case_dir="$WORK/case-$attempt"
  mkdir -m 700 "$case_dir"
  db="$case_dir/probe.sqlite"
  sqlite3 "$db" 'CREATE TABLE payload(value TEXT);'
  printf 'FDFIX_ATTEMPT=%s\n' "$attempt"
  stat -c 'TEMP_DIR_MODE=%a TEMP_DIR_TYPE=%F' "$case_dir"
  stat -c 'DB_MODE=%a DB_TYPE=%F DB_SIZE=%s' "$db"
  set +e
  (
    fds=("/proc/$BASHPID"/fd/*)
    printf 'REQUESTED_NOFILE=4 TRACER_PREEXEC_FD_COUNT=%s\n' "${#fds[@]}"
    exec strace -f -qq -yy -e trace=open,openat,openat2,close,fcntl,dup,dup2,dup3 \
      -o "$case_dir/fd.trace" prlimit --nofile=4:4 "$WORK/disk" db "$db"
  ) >"$case_dir/stdout.log" 2>"$case_dir/stderr.log"
  rc=$?
  set -e
  error="$(grep -o 'db-exec: .*' "$case_dir/stderr.log" | tail -n 1 || true)"
  printf 'FDFIX_CASE=fd-limit RC=%s ERROR=%s\n' "$rc" "$error"
  test -s "$case_dir/fd.trace"
  test "$rc" -eq 1
  grep -q 'db-exec:' "$case_dir/stderr.log"
  find "$case_dir" -mindepth 1 -maxdepth 1 -printf 'TEMP_ENTRY=%f MODE=%m TYPE=%y SIZE=%s\n' | sort
  printf 'EMFILE_EVENTS='; grep -c 'EMFILE' "$case_dir/fd.trace" || true
done
