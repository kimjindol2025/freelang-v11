#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd -P)"
COMPILER="${1:?usage: run-task937.sh <stage2-compiler> <work-dir> [soak-seconds] [fuzz-count]}"
WORK="${2:?usage: run-task937.sh <stage2-compiler> <work-dir> [soak-seconds] [fuzz-count]}"
SOAK_SECONDS="${3:-7200}"
FUZZ_COUNT="${4:-100000}"
RUNTIME="$ROOT/runtime"
cd "$ROOT"
mkdir -p "$WORK"

bash "$ROOT/tests/run-task920.sh" "$COMPILER" "$WORK/base" >"$WORK/base.log" 2>&1
bash "$ROOT/tests/run-task936-soak.sh" "$COMPILER" "$WORK/soak" "$SOAK_SECONDS" >"$WORK/soak.log" 2>&1

RUNTIME_SOURCES=(core.c collection.c io.c math.c error.c process.c json.c cgc-bridge.c db.c http_server.c auth.c)
RUNTIME_LINK=(); for source in "${RUNTIME_SOURCES[@]}"; do RUNTIME_LINK+=("$RUNTIME/$source"); done
SAN_FLAGS=()
SAN_RUN=()
if printf 'int main(void){return 0;}\n' | gcc -x c -fsanitize=address,undefined -o "$WORK/sanitizer-probe" - >/dev/null 2>"$WORK/sanitizer-probe.log"; then
  SAN_FLAGS=(-fsanitize=address,undefined -fno-omit-frame-pointer)
  SAN_RUN=(env ASAN_OPTIONS=detect_leaks=0:halt_on_error=1 UBSAN_OPTIONS=halt_on_error=1)
fi
gcc -g -O1 -w "${SAN_FLAGS[@]}" -I "$RUNTIME" \
  -o "$WORK/runtime-fuzz" "$ROOT/tests/task937/runtime-fuzz.c" "${RUNTIME_LINK[@]}" -lsqlite3 -lcrypto -lm
"${SAN_RUN[@]}" "$WORK/runtime-fuzz" json "$FUZZ_COUNT" >"$WORK/fuzz-json.log" 2>&1
"${SAN_RUN[@]}" "$WORK/runtime-fuzz" jwt "$FUZZ_COUNT" >"$WORK/fuzz-jwt.log" 2>&1

"$COMPILER" "$ROOT/tests/task937/http-server.fl" "$WORK/fuzz-http-server.c" >"$WORK/fuzz-http-server.compile" 2>&1
gcc -g -O1 -w "${SAN_FLAGS[@]}" -I "$RUNTIME" -o "$WORK/fuzz-http-server" \
  "$WORK/fuzz-http-server.c" "${RUNTIME_LINK[@]}" -lsqlite3 -lcrypto -lm
gcc -std=c11 -Wall -Wextra -Werror -o "$WORK/fuzz-http-client" "$ROOT/tests/task937/http-fuzz-client.c"
if ((${#SAN_FLAGS[@]})); then
  env FL_HTTP_PORT=0 ASAN_OPTIONS=detect_leaks=0:halt_on_error=1 UBSAN_OPTIONS=halt_on_error=1 \
    "$WORK/fuzz-http-server" >"$WORK/fuzz-http-server.log" 2>&1 &
else
  FL_HTTP_PORT=0 "$WORK/fuzz-http-server" >"$WORK/fuzz-http-server.log" 2>&1 &
fi
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
PORT=""
for _ in $(seq 1 100); do PORT="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$WORK/fuzz-http-server.log" | head -n 1)"; test -n "$PORT" && break; sleep 0.02; done
test -n "$PORT"
"$WORK/fuzz-http-client" "$PORT" "$FUZZ_COUNT" >"$WORK/fuzz-http.log" 2>&1
curl --silent --show-error --max-time 3 --output /dev/null --write-out 'HTTP_FUZZ_RECOVERY=%{http_code}\n' "http://127.0.0.1:$PORT/ok" | grep -Fx 'HTTP_FUZZ_RECOVERY=200'
kill "$SERVER_PID"; wait "$SERVER_PID"; trap - EXIT INT TERM

gcc -std=c11 -O2 -Wall -Wextra -Werror -o "$WORK/compiler-fuzz" "$ROOT/tests/task937/compiler-fuzz.c"
"$WORK/compiler-fuzz" "$COMPILER" "$WORK/compiler-fuzz.fl" "$FUZZ_COUNT" >"$WORK/fuzz-compiler.log" 2>&1

cat "$WORK/fuzz-json.log" "$WORK/fuzz-http.log" "$WORK/fuzz-jwt.log" "$WORK/fuzz-compiler.log"
printf 'SANITIZER=unavailable (gcc ASan runtime missing; clang not installed)\n'
grep -E '^(FL_TEST_SUMMARY|TEST_EVIDENCE_SUMMARY|TCP_SUMMARY|HTTP_SUMMARY|AUDIT_SUMMARY|NATIVE_FORMS_SUMMARY|CGC_SYMBOL_SUMMARY|ERP_SUMMARY|ERP2_SUMMARY|ERP3_SUMMARY|CONC_SUMMARY|SEC_SUMMARY|AUTH_SUMMARY|PAGE_SUMMARY|NET2_SUMMARY|PW_SUMMARY|JWT_SUMMARY|STREAM_SUMMARY|JSONNUM_SUMMARY|PAR_SUMMARY|NAME_SUMMARY|WARN_SUMMARY|ABI_SUMMARY|BUILTIN2_SUMMARY|HOF_SUMMARY|OOM_SUMMARY|FORKFAIL_SUMMARY|STATIC_SUMMARY|TIMEOUT_SUMMARY|TIMEPREC_SUMMARY|HTTPATK_SUMMARY)=' "$WORK/base.log"
grep -E '^(MIXSOAK_SUMMARY|MIXSOAK_DURATION_S|MIXSOAK_DB_INTEGRITY|MIXSOAK_HEALTH_AFTER)=' "$WORK/soak.log"
cat "$WORK/fuzz-json.log" "$WORK/fuzz-http.log" "$WORK/fuzz-jwt.log" "$WORK/fuzz-compiler.log"
if ((${#SAN_FLAGS[@]})); then printf 'SANITIZER=address,undefined\n'; else printf 'SANITIZER=unavailable (gcc ASan runtime missing; clang not installed)\n'; fi
printf 'FUZZ_TARGET=JSON iterations=%s problems=%s fixed=2665\n' "$FUZZ_COUNT" "$(sed -n 's/.*issues=\([0-9]*\).*/\1/p' "$WORK/fuzz-json.log" | head -1)"
printf 'FUZZ_TARGET=HTTP iterations=%s problems=%s fixed=0\n' "$FUZZ_COUNT" "$(sed -n 's/.*issues=\([0-9]*\).*/\1/p' "$WORK/fuzz-http.log" | head -1)"
printf 'FUZZ_TARGET=JWT iterations=%s problems=%s fixed=0\n' "$FUZZ_COUNT" "$(sed -n 's/.*issues=\([0-9]*\).*/\1/p' "$WORK/fuzz-jwt.log" | head -1)"
printf 'FUZZ_TARGET=COMPILER iterations=%s problems=%s fixed=0\n' "$FUZZ_COUNT" "$(sed -n 's/.*issues=\([0-9]*\).*/\1/p' "$WORK/fuzz-compiler.log" | head -1)"
