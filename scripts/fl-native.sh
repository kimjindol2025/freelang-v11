#!/bin/bash
# fl-native.sh — FreeLang Native Runner (Node.js 없음)
# 사용:
#   fl-native run  <file.fl> [args...]   FL → C → ELF → 실행
#   fl-native build <file.fl> -o <out>  FL → C → ELF (실행 안 함)
#   fl-native compile <file.fl> <out.c> FL → C만
#
# 환경: gcc, cgc-bin 필요. Node.js 불필요.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="$REPO_ROOT/runtime"
CGC_BIN="$REPO_ROOT/bin/cgc-bin"

RUNTIME_SOURCES=(
  "$RUNTIME_DIR/core.c"
  "$RUNTIME_DIR/collection.c"
  "$RUNTIME_DIR/io.c"
  "$RUNTIME_DIR/math.c"
  "$RUNTIME_DIR/error.c"
  "$RUNTIME_DIR/process.c"
  "$RUNTIME_DIR/json.c"
  "$RUNTIME_DIR/http-client.c"
  "$RUNTIME_DIR/crypto.c"
  "$RUNTIME_DIR/http.c"
  "$RUNTIME_DIR/db.c"
  "$RUNTIME_DIR/sqlite3.c"
)

die() { echo "❌ $*" >&2; exit 1; }

check_deps() {
  [[ -x "$CGC_BIN" ]] || die "cgc-bin not found: $CGC_BIN (run: make install-native)"
  command -v gcc >/dev/null 2>&1 || die "gcc not found"
}

compile_fl_to_c() {
  local fl_file="$1"
  local c_file="$2"
  [[ -f "$fl_file" ]] || die "FL 파일 없음: $fl_file"
  "$CGC_BIN" "$fl_file" "$c_file" 2>&1
}

FL_ERROR_PY='
import sys, re
shown = set()
for line in sys.stdin:
    line = line.rstrip()
    m = re.search(r"error: .([A-Za-z_][A-Za-z0-9_]*). undeclared", line)
    if m:
        name = m.group(1).replace("_", "-")
        lm = re.search(r":(\d+):\d+:", line)
        loc = " (line " + lm.group(1) + ")" if lm else ""
        key = "undef:" + name
        if key not in shown:
            shown.add(key)
            print("[FL Error] 정의되지 않은 이름: " + name + loc)
        continue
    m = re.search(r"error: too few arguments to function .([A-Za-z_][A-Za-z0-9_]*)", line)
    if m:
        name = m.group(1).replace("_", "-")
        if "argc:" + name not in shown:
            shown.add("argc:" + name)
            print("[FL Error] 함수 \"" + name + "\": 인자가 부족합니다")
        continue
    m = re.search(r"error: too many arguments to function .([A-Za-z_][A-Za-z0-9_]*)", line)
    if m:
        name = m.group(1).replace("_", "-")
        if "argcm:" + name not in shown:
            shown.add("argcm:" + name)
            print("[FL Error] 함수 \"" + name + "\": 인자가 너무 많습니다")
        continue
    if "incompatible type" in line and "error:" in line:
        lm = re.search(r":(\d+):\d+:", line)
        loc = " (line " + lm.group(1) + ")" if lm else ""
        if "type:" + loc not in shown:
            shown.add("type:" + loc)
            print("[FL Error] 타입 불일치" + loc)
        continue
    m = re.search(r"warning: implicit declaration of function .([A-Za-z_][A-Za-z0-9_]*)", line)
    if m:
        name = m.group(1).replace("_", "-")
        if "impl:" + name not in shown:
            shown.add("impl:" + name)
            print("[FL Error] 알 수 없는 함수: " + name)
        continue
'

fl_error_from_gcc() {
  python3 -c "$FL_ERROR_PY" 2>/dev/null
}
export FL_ERROR_PY
export -f fl_error_from_gcc

compile_c_to_bin() {
  local c_file="$1"
  local bin_file="$2"
  local gcc_out
  gcc_out=$(gcc -O2 -Wall -Wextra \
    -Wno-unused-variable -Wno-unused-parameter \
    -I "$RUNTIME_DIR" \
    -o "$bin_file" \
    "$c_file" \
    "${RUNTIME_SOURCES[@]}" \
    -lm -lpthread -ldl -lssl -lcrypto \
    2>&1)
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    local fl_out
    fl_out=$(echo "$gcc_out" | fl_error_from_gcc 2>/dev/null)
    if [[ -n "$fl_out" ]]; then
      echo "$fl_out" >&2
    else
      echo "$gcc_out" >&2
    fi
    return $rc
  fi
  return 0
}

CMD="${1:-}"
shift || true

case "$CMD" in
  run)
    check_deps
    FL_FILE="${1:-}"
    [[ -n "$FL_FILE" ]] || die "사용: fl-native run <file.fl> [args...]"
    shift || true

    HASH=$(echo "$FL_FILE-$$" | md5sum | cut -c1-8)
    TMP_C="/tmp/fl_${HASH}.c"
    TMP_BIN="/tmp/fl_${HASH}"

    trap "rm -f '$TMP_C' '$TMP_BIN'" EXIT

    compile_fl_to_c "$FL_FILE" "$TMP_C" 2>&1 | grep -v "^Compiled" >&2 || true
    compile_c_to_bin "$TMP_C" "$TMP_BIN" || exit 1
    exec "$TMP_BIN" "$@"
    ;;

  build)
    check_deps
    FL_FILE="${1:-}"
    OUT_BIN="${3:-}"  # -o <out>
    [[ -n "$FL_FILE" ]] || die "사용: fl-native build <file.fl> -o <output>"
    [[ "${2:-}" == "-o" && -n "$OUT_BIN" ]] || die "사용: fl-native build <file.fl> -o <output>"

    TMP_C="/tmp/fl_build_$$.c"
    trap "rm -f '$TMP_C'" EXIT

    echo "🔨 Compiling $FL_FILE → $OUT_BIN"
    compile_fl_to_c "$FL_FILE" "$TMP_C"
    compile_c_to_bin "$TMP_C" "$OUT_BIN"
    echo "✅ $OUT_BIN ($(stat --format=%s "$OUT_BIN") bytes)"
    ;;

  compile)
    check_deps
    FL_FILE="${1:-}"
    OUT_C="${2:-}"
    [[ -n "$FL_FILE" && -n "$OUT_C" ]] || die "사용: fl-native compile <file.fl> <out.c>"
    compile_fl_to_c "$FL_FILE" "$OUT_C"
    echo "✅ $FL_FILE → $OUT_C"
    ;;

  --version|-v)
    echo "fl-native (FreeLang Native Runner)"
    echo "  cgc-bin: $CGC_BIN"
    echo "  runtime: $RUNTIME_DIR"
    ;;

  *)
    echo "사용: fl-native <command> [args]"
    echo ""
    echo "Commands:"
    echo "  run     <file.fl> [args...]   FL 실행 (Node.js 불필요)"
    echo "  build   <file.fl> -o <out>   ELF 바이너리 빌드"
    echo "  compile <file.fl> <out.c>    C 코드만 생성"
    echo "  --version                    버전 정보"
    exit 1
    ;;
esac
