#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
TOOLS="${FL_TOOLS_ROOT:-$(cd -- "$ROOT/../freelang-tools" && pwd -P)}"
COMPILER="${1:?usage: run-task920.sh <stage2-compiler> <work-dir>}"
WORK="${2:?usage: run-task920.sh <stage2-compiler> <work-dir>}"
RUNTIME="$ROOT/runtime"
mkdir -p "$WORK"
export FL_TOOLS_DISPATCH_ROOT="$TOOLS" FREELANG_V11_RUNTIME="$RUNTIME" FL_TEST_CONTINUE=1
export FREELANG_TESTER_REGISTRY="$WORK/tester-registry-native"

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

"$TOOLS/scripts/cgc-native" "$TOOLS/native/tester-registry.fl" "$WORK/tr.c" >"$WORK/tester-registry.compile" 2>&1
gcc -Wno-unused -I "$RUNTIME" -o "$FREELANG_TESTER_REGISTRY" "$WORK/tr.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/cgc-bridge.c" -lm
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

bash "$ROOT/examples/erp-vendors/test-pages.sh" "$WORK/app" "$WORK/create-user" >"$WORK/pages.log" 2>&1

NAME_COUNT=0
for source in auth-random-token auth-pbkdf2 auth-constant-time-equal tcp-bind tcp-listen tcp-accept tcp-close tcp-local-port vec-push; do
  "$COMPILER" "$ROOT/tests/task922/$source.fl" "$WORK/$source.c" >"$WORK/$source.compile" 2>&1
  gcc -w -I "$RUNTIME" -o "$WORK/$source" "$WORK/$source.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm
  "$WORK/$source" >"$WORK/$source.log" 2>&1
  grep -q "^PASS $source$" "$WORK/$source.log"
  NAME_COUNT=$((NAME_COUNT + 1))
done
printf 'NAME_SUMMARY=%s/9\n' "$NAME_COUNT"
alias_prefix='-D'
if rg -n --glob '*.sh' -- "$alias_prefix"'(auth_|tcp_)[A-Za-z0-9_]+=fl_' "$ROOT"; then
  echo 'compiler alias remains in build scripts' >&2
  exit 1
fi

WARN_COUNT=0
for name in loop-binding function-parameter let-local; do
  if ! "$COMPILER" "$ROOT/tests/task920/$name.fl" "$WORK/$name.c" >"$WORK/$name.log" 2>&1; then
    cat "$WORK/$name.log"; exit 1
  fi
  count="$(grep -c '정의되지 않은 이름' "$WORK/$name.log" || true)"
  test "$count" -eq 0 || { cat "$WORK/$name.log"; exit 1; }
  WARN_COUNT=$((WARN_COUNT + 1))
done
"$COMPILER" "$ROOT/tests/task920/undefined-name.fl" "$WORK/undefined-name.c" >"$WORK/undefined-name.log" 2>&1 || true
count="$(grep -c '정의되지 않은 이름' "$WORK/undefined-name.log" || true)"
test "$count" -eq 1 || { cat "$WORK/undefined-name.log"; exit 1; }
grep -q '\[CGC-ERR\] generated C failed gcc -fsyntax-only:' "$WORK/undefined-name.log"
WARN_COUNT=$((WARN_COUNT + 1))
printf 'WARN_SUMMARY=%s/4\n' "$WARN_COUNT"

"$ROOT/tests/run-cgc-builtin-abi.sh" "$COMPILER" "$WORK/abi" >"$WORK/abi.log" 2>&1
grep -E '^(BUILTINS_TOTAL|MATCHED|MISSING_IN_RUNTIME|UNUSED_RUNTIME|ABI_MAPPED|COMPILER_LOWERED|ABI_HOLD|MISSING_IN_RUNTIME_ITEMS|ABI_SUMMARY)=' "$WORK/abi.log"

"$COMPILER" "$ROOT/tests/task924/builtins.fl" "$WORK/builtins2.c" >"$WORK/builtins2.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/builtins2" "$WORK/builtins2.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm
"$WORK/builtins2" >"$WORK/builtins2.log" 2>&1
BUILTIN2_COUNT="$(grep -c '^PASS ' "$WORK/builtins2.log")"
test "$BUILTIN2_COUNT" -eq 14
grep -Fx '&lt;script&gt;&quot;&#x27;&amp;' "$WORK/builtins2.log"
if "$COMPILER" "$ROOT/tests/task924/held-auth.fl" "$WORK/held-auth.c" >"$WORK/held-auth.log" 2>&1; then
  echo 'held builtin unexpectedly compiled' >&2; exit 1
fi
grep -E '^\[FL Error\] 아직 네이티브로 구현되지 않은 내장 함수: auth-jwt-sign \(line [0-9]+\)$' "$WORK/held-auth.log"
BUILTIN2_COUNT=$((BUILTIN2_COUNT + 2))
printf 'BUILTIN2_SUMMARY=%s/16\n' "$BUILTIN2_COUNT"

"$COMPILER" "$ROOT/tests/task925/hof.fl" "$WORK/hof.c" >"$WORK/hof.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/hof" "$WORK/hof.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm
"$WORK/hof" >"$WORK/hof.log" 2>&1
HOF_COUNT="$(grep -c '^PASS ' "$WORK/hof.log")"
for spec in 'str-repeat-0' 'str-repeat-negative' 'str-repeat-million' 'repeat-million'; do
  "$COMPILER" "$ROOT/tests/task925/$spec.fl" "$WORK/$spec.c" >"$WORK/$spec.compile" 2>&1
  gcc -w -I "$RUNTIME" -o "$WORK/$spec" "$WORK/$spec.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm
  if test "$spec" = repeat-million; then
    /usr/bin/time -f 'REPEAT_VECTOR_MAX_RSS_KB=%M' -o "$WORK/$spec.time" "$WORK/$spec" >"$WORK/$spec.log" 2>&1
    cat "$WORK/$spec.time"
  else
    "$WORK/$spec" >"$WORK/$spec.log" 2>&1
  fi
  printf '%s_RC=0\n' "$spec"
  HOF_COUNT=$((HOF_COUNT + 1))
done
test "$HOF_COUNT" -eq 25
grep -E '^(STR_REPEAT_ZERO_LEN|STR_REPEAT_NEG_LEN|STR_REPEAT_MILLION_LEN|REPEAT_MILLION_LEN)=' "$WORK"/{str-repeat-0,str-repeat-negative,str-repeat-million,repeat-million}.log
printf 'HOF_SUMMARY=%s/25\n' "$HOF_COUNT"

grep -E '^FL_TEST_SUMMARY ' "$WORK/existing41.log"
grep -hE '^TEST_EVIDENCE_SUMMARY=|^TCP_SUMMARY=|^HTTP_SUMMARY=' "$WORK/test-evidence.log" "$WORK/tcp.log" "$WORK/http.log"
sed -n 's/.*"expectedCount":\([0-9]*\),"resultCount":\([0-9]*\).*/AUDIT_SUMMARY=\1\/\2/p' "$WORK/audit.log"
grep -E '^NATIVE_FORMS_SUMMARY=|^CGC_SYMBOL_SUMMARY=' "$WORK/symbol.log"
grep -hE '^(ERP_SUMMARY|ERP2_SUMMARY|ERP3_SUMMARY|CONC_SUMMARY|AUTH_SUMMARY)=' "$WORK"/{erp,erp2,erp3,conc,auth}.log
grep -E '^PAGE_SUMMARY=' "$WORK/pages.log"
grep '^PASS ' "$WORK/builtins2.log"
grep '^PASS ' "$WORK/hof.log" "$WORK"/{str-repeat-0,str-repeat-negative,str-repeat-million,repeat-million}.log

bash "$ROOT/tests/run-task926.sh" "$COMPILER" "$WORK/net2" >"$WORK/net2.log" 2>&1
grep -E '^(PASS |UUID_COUNT=|UUID_UNIQUE=|UUID_REGEX_MATCH=|UUID_VERSION_4=|UUID_VARIANT_VALID=|NET2_SUMMARY=)' "$WORK/net2.log"
sed -n '/^RAW_POST_BEGIN$/,/^RAW_POST_END$/p' "$WORK/net2.log"
sed -n '/^RAW_HEADER_BEGIN$/,/^RAW_HEADER_END$/p' "$WORK/net2.log"

"$COMPILER" "$ROOT/tests/task927/password.fl" "$WORK/password.c" >"$WORK/password.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/password" "$WORK/password.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm
"$WORK/password" >"$WORK/password.log" 2>&1
grep -E '^(PW_FORMAT_EXAMPLE|PW_SUMMARY)=' "$WORK/password.log"
test "$(grep -c '^PASS ' "$WORK/password.log")" -eq 10
grep '^PASS ' "$WORK/password.log"
"$COMPILER" "$ROOT/tests/task927/hash-once.fl" "$WORK/hash-once.c" >"$WORK/hash-once.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/hash-once" "$WORK/hash-once.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm
/usr/bin/time -f '%e' -o "$WORK/hash-once.seconds" "$WORK/hash-once" >"$WORK/hash-once.log" 2>&1
awk '{printf "PW_HASH_ONCE_MS=%.0f\n", $1 * 1000}' "$WORK/hash-once.seconds"
grep '^PASS password hash timing$' "$WORK/hash-once.log"
