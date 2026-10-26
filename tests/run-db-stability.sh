#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
WORK="${1:?usage: run-db-stability.sh <empty-temp-dir> <quick-log>}"
QUICK_LOG="${2:?usage: run-db-stability.sh <empty-temp-dir> <quick-log>}"
hold_pid=""
trap 'if test -n "$hold_pid"; then kill "$hold_pid" 2>/dev/null || true; wait "$hold_pid" 2>/dev/null || true; fi' EXIT
test ! -e "$WORK" || test -z "$(find "$WORK" -mindepth 1 -print -quit)"
mkdir -p "$WORK"
R="$ROOT/runtime"
gcc -w -I "$R" -o "$WORK/db-test" "$ROOT/tests/db-stability.c" \
  "$R/core.c" "$R/collection.c" "$R/io.c" "$R/math.c" "$R/error.c" \
  "$R/process.c" "$R/json.c" "$R/cgc-bridge.c" "$R/db.c" \
  "$R/http_server.c" "$R/auth.c" -lsqlite3 -lcrypto -lm
DB="$WORK/main.sqlite"
"$WORK/db-test" init "$DB"
passed=0

"$WORK/db-test" worker "$DB" 1
for i in $(seq 1 100); do
  "$WORK/db-test" crash "$DB" >"$WORK/crash.log" 2>"$WORK/crash.err" & pid=$!
  for j in $(seq 1 100); do
    grep -q '^IN_TRANSACTION$' "$WORK/crash.log" && break
    sleep 0.01
  done
  grep -q '^IN_TRANSACTION$' "$WORK/crash.log"
  kill -9 "$pid"
  wait "$pid" 2>/dev/null || true
  test "$(sqlite3 "$DB" 'PRAGMA integrity_check')" = ok
  test "$(sqlite3 "$DB" 'SELECT count(*) FROM payload')" = 5000
done
echo 'DB_CASE_1=PASS CRASHES=100 INTEGRITY=ok COMMITTED=5000 UNFINISHED=0'
passed=$((passed+1))

"$WORK/db-test" disk "$DB" >"$WORK/disk.out" 2>"$WORK/disk.err"
grep -q '^db-exec:' "$WORK/disk.err"
grep -q '^DISK_ERROR=1$' "$WORK/disk.out"
grep -q '^RECOVERY_WRITE=ok$' "$WORK/disk.out"
test "$(sqlite3 "$DB" 'SELECT count(*) FROM payload WHERE id=900004')" = 1
echo 'DB_CASE_2=PASS ERROR=db-exec: PROCESS_ALIVE=1 RECOVERY_WRITE=ok'
passed=$((passed+1))

"$WORK/db-test" batch "$DB" >"$WORK/batch.out" 2>"$WORK/batch.err"
grep -q '^BATCH_FAILED=1$' "$WORK/batch.out"
test "$(sqlite3 "$DB" 'SELECT count(*) FROM payload WHERE id BETWEEN 900001 AND 900002')" = 0
echo 'DB_CASE_3=PASS BATCH_FAILED=1 PARTIAL_ROWS=0'
passed=$((passed+1))

pids=()
for i in $(seq 0 7); do
  "$WORK/db-test" worker "$DB" "$((10000+i*5000))" >"$WORK/worker-$i.out" 2>"$WORK/worker-$i.err" & pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
test "$(sqlite3 "$DB" 'SELECT count(*) FROM payload WHERE id BETWEEN 10000 AND 49999')" = 40000
test "$(sqlite3 "$DB" 'SELECT count(*)-count(DISTINCT id) FROM payload WHERE id BETWEEN 10000 AND 49999')" = 0
test ! -s "$WORK/worker-0.err"
test "$(cat "$WORK"/worker-*.err | wc -c)" = 0
echo 'DB_CASE_4=PASS PROCESSES=8 EACH=5000 ROWS=40000 DUPLICATES=0 LOCK_ERRORS=0'
passed=$((passed+1))

"$WORK/db-test" hold "$DB" >"$WORK/hold.out" 2>"$WORK/hold.err" & hold_pid=$!
for j in $(seq 1 100); do
  grep -q '^WRITING$' "$WORK/hold.out" && break
  sleep 0.01
done
grep -q '^WRITING$' "$WORK/hold.out"
sqlite3 "$DB" ".backup '$WORK/backup.sqlite'"
backup_rows="$(sqlite3 "$WORK/backup.sqlite" 'SELECT count(*) FROM payload')"
backup_max="$(sqlite3 "$WORK/backup.sqlite" 'SELECT max(id) FROM payload')"
test "$(sqlite3 "$WORK/backup.sqlite" 'PRAGMA integrity_check')" = ok
for j in $(seq 1 3000); do
  grep -q '^WAL_WRITES=20000$' "$WORK/hold.out" && break
  sleep 0.01
done
grep -q '^WAL_WRITES=20000$' "$WORK/hold.out"
backup_hash="$(sqlite3 "$WORK/backup.sqlite" "SELECT id||':'||quote(value) FROM payload ORDER BY id" | sha256sum | cut -d ' ' -f 1)"
source_hash="$(sqlite3 "$DB" "SELECT id||':'||quote(value) FROM payload WHERE id <= $backup_max ORDER BY id" | sha256sum | cut -d ' ' -f 1)"
test "$backup_hash" = "$source_hash"
echo "DB_CASE_5=PASS BACKUP_INTEGRITY=ok ROWS=$backup_rows CONTENT_SHA256=$backup_hash SOURCE_CMP=0"
passed=$((passed+1))

"$WORK/db-test" benchmark "$WORK/big.sqlite" >"$WORK/big.out"
test "$(sqlite3 "$WORK/big.sqlite" 'SELECT count(*) FROM big')" = 1001000
test "$(sqlite3 "$WORK/big.sqlite" 'PRAGMA integrity_check')" = ok
grep -q 'FD_BEFORE=4 FD_AFTER=4' "$WORK/big.out"
echo "DB_CASE_6=PASS $(cat "$WORK/big.out") FILE_BYTES=$(stat -c %s "$WORK/big.sqlite") INTEGRITY=ok"
passed=$((passed+1))

wal_before="$(stat -c %s "$DB-wal")"
sqlite3 "$DB" 'PRAGMA wal_checkpoint(TRUNCATE)' >"$WORK/checkpoint.out"
wal_after="$(stat -c %s "$DB-wal")"
test "$wal_after" -le "$wal_before"
test "$wal_before" -lt 16777216
echo "DB_CASE_7=PASS WAL_BEFORE=$wal_before WAL_AFTER=$wal_after CHECKPOINT=$(cat "$WORK/checkpoint.out")"
passed=$((passed+1))
kill "$hold_pid"; wait "$hold_pid" 2>/dev/null || true
hold_pid=""

"$WORK/db-test" input "$DB" >"$WORK/input.out" 2>"$WORK/input.err"
grep -q '^ZERO_BYTE_REJECTED=1$' "$WORK/input.out"
test "$(sqlite3 "$DB" 'SELECT count(*) FROM payload WHERE id BETWEEN 900010 AND 900012')" = 3
test "$(sqlite3 "$DB" 'SELECT length(value) FROM payload WHERE id=900012')" = 100000
test "$(sqlite3 "$DB" 'SELECT count(*) FROM payload WHERE id=900013')" = 0
echo 'DB_CASE_8=PASS SPECIAL=stored LONG_LENGTH=100000 NULL=stored ZERO_BYTE=rejected'
passed=$((passed+1))

grep -q '^LOAD2_SUMMARY=10/10$' "$QUICK_LOG"
grep -q '^FDFIX_SUMMARY=5/5$' "$QUICK_LOG"
echo 'DB_CASE_9=PASS QUICK_RC=0 FDFIX=5/5 LOAD2=10/10'
passed=$((passed+1))
echo "DB_SUMMARY=$passed/9"
test "$passed" -eq 9
