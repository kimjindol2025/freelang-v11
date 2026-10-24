#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
TOOLS="${FL_TOOLS_ROOT:-$(cd -- "$ROOT/../freelang-tools" && pwd -P)}"
COMPILER="${1:?usage: run-task920.sh <stage2-compiler> <work-dir>}"
WORK="${2:?usage: run-task920.sh <stage2-compiler> <work-dir>}"
RUNTIME="$ROOT/runtime"
mkdir -p "$WORK"
export FL_TOOLS_DISPATCH_ROOT="$TOOLS" FREELANG_V11_RUNTIME="$RUNTIME" FL_TEST_CONTINUE=1
export FREELANG_TESTER_REGISTRY="$TOOLS/scripts/tester-registry-native"

for name in time str-regex fs test-evidence; do
  "$TOOLS/scripts/cgc-native" "$ROOT/tests/lib-contract/run-$name.fl" "$WORK/$name.c" >"$WORK/$name.compile" 2>&1
  if grep -E '\[CGC-ERR\]|\[load\] 파일 없음' "$WORK/$name.compile"; then exit 1; fi
  gcc -Wno-unused -I "$RUNTIME" -o "$WORK/$name" "$WORK/$name.c" \
    "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
    "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/db.c" \
    "$RUNTIME/http_server.c" "$RUNTIME/cgc-bridge.c" -lm -lsqlite3 >"$WORK/$name.build" 2>&1
  "$WORK/$name" --root "$ROOT" --compiler "$TOOLS/scripts/cgc-native" >"$WORK/$name.log" 2>&1
done

for spec in 'unicode tests/lib/unicode.test.fl' 'json tests/lib-json/json.test.fl' \
  'collections tests/lib-contract/collections.test.fl' 'files tests/lib-contract/files.test.fl' \
  'errors tests/lib-contract/errors.test.fl' 'communication tests/lib-contract/communication.test.fl' \
  'time tests/lib-contract/time.test.fl' 'modules tests/lib-contract/modules.test.fl' \
  'json-large tests/lib-json/json-large.test.fl'; do
  read -r label source <<<"$spec"
  "$TOOLS/scripts/fl-cgc-run" "$ROOT/$source" >"$WORK/area-$label.log" 2>&1
done

"$TOOLS/scripts/cgc-native" "$ROOT/tests/lib-contract/run-http.fl" "$WORK/http-runner.c" >"$WORK/http-runner.compile" 2>&1
gcc -Wno-unused -I "$RUNTIME" -o "$WORK/http-runner" "$WORK/http-runner.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/db.c" \
  "$RUNTIME/http_server.c" "$RUNTIME/cgc-bridge.c" -lm -lsqlite3
"$WORK/http-runner" --root "$ROOT" --compiler "$TOOLS/scripts/cgc-native" >"$WORK/http.log" 2>&1
"$TOOLS/scripts/cgc-native" "$ROOT/tests/lib-contract/tcp.test.fl" "$WORK/tcp.c" >"$WORK/tcp.compile" 2>&1
gcc -Wno-unused -I "$RUNTIME" -o "$WORK/tcp" "$WORK/tcp.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/cgc-bridge.c" -lm
"$WORK/tcp" >"$WORK/tcp.log" 2>&1
"$TOOLS/scripts/fl-test" "$TOOLS" >"$WORK/existing41.log" 2>&1

"$TOOLS/scripts/fl-native-tester-audit" --run --output "$WORK/audit-results.json" >"$WORK/audit.log"
bash "$ROOT/tests/run-cgc-symbol-contract.sh" >"$WORK/symbol.log" 2>&1

sources=(core.c collection.c io.c math.c error.c process.c json.c cgc-bridge.c db.c http_server.c auth.c)
link_sources=(); for name in "${sources[@]}"; do link_sources+=("$RUNTIME/$name"); done
"$COMPILER" "$ROOT/examples/erp-vendors/app.fl" "$WORK/app.c" >"$WORK/app.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/app" "$WORK/app.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm
"$COMPILER" "$ROOT/examples/erp-vendors/create-user.fl" "$WORK/create-user.c" >"$WORK/create-user.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/create-user" "$WORK/create-user.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/cgc-bridge.c" \
  "$RUNTIME/db.c" "$RUNTIME/auth.c" -lsqlite3 -lcrypto -lm

for spec in 'erp test.fl' 'erp2 test2.fl' 'erp3 test3.fl' 'conc test-concurrency.fl' 'auth test-auth.fl'; do
  read -r label source <<<"$spec"
  "$COMPILER" "$ROOT/examples/erp-vendors/$source" "$WORK/$label.c" >"$WORK/$label.compile" 2>&1
  gcc -w -I "$RUNTIME" -o "$WORK/$label" "$WORK/$label.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm
  mkdir -p "$WORK/$label-run"
  "$WORK/$label" "$WORK/$label-run" "$WORK/app" "$WORK/create-user" >"$WORK/$label.log" 2>&1
done

WARN_COUNT=0
for name in loop-binding function-parameter let-local; do
  if ! "$COMPILER" "$ROOT/tests/task920/$name.fl" "$WORK/$name.c" >"$WORK/$name.log" 2>&1; then
    cat "$WORK/$name.log"; exit 1
  fi
  count="$(grep -c '정의되지 않은 이름' "$WORK/$name.log" || true)"
  test "$count" -eq 0 || { cat "$WORK/$name.log"; exit 1; }
  WARN_COUNT=$((WARN_COUNT + 1))
done
if ! "$COMPILER" "$ROOT/tests/task920/undefined-name.fl" "$WORK/undefined-name.c" >"$WORK/undefined-name.log" 2>&1; then
  cat "$WORK/undefined-name.log"; exit 1
fi
count="$(grep -c '정의되지 않은 이름' "$WORK/undefined-name.log" || true)"
test "$count" -eq 1 || { cat "$WORK/undefined-name.log"; exit 1; }
WARN_COUNT=$((WARN_COUNT + 1))
printf 'WARN_SUMMARY=%s/4\n' "$WARN_COUNT"

grep -E '^FL_TEST_SUMMARY ' "$WORK/existing41.log"
grep -hE '^TEST_EVIDENCE_SUMMARY=|^TCP_SUMMARY=|^HTTP_SUMMARY=' "$WORK/test-evidence.log" "$WORK/tcp.log" "$WORK/http.log"
printf 'AUDIT_SUMMARY='; sed -n 's/.*"expectedCount":\([0-9]*\),"resultCount":\([0-9]*\).*/\1\/\2/p' "$WORK/audit-results.json"
grep -E '^NATIVE_FORMS_SUMMARY=|^CGC_SYMBOL_SUMMARY=' "$WORK/symbol.log"
grep -hE '^(ERP_SUMMARY|ERP2_SUMMARY|ERP3_SUMMARY|CONC_SUMMARY|AUTH_SUMMARY)=' "$WORK"/{erp,erp2,erp3,conc,auth}.log
