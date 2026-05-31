#!/bin/bash
# repl.sh — FreeLang Native REPL

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CGC_BIN="$REPO_ROOT/bin/cgc-bin"
RUNTIME_DIR="$REPO_ROOT/runtime"

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

STATE="$HOME/.fl_repl_state_$$.fl"
TMP_C="/tmp/_fl_repl_$$.c"
TMP_BIN="/tmp/_fl_repl_$$"

touch "$STATE"
trap "rm -f '$STATE' '$TMP_C' '$TMP_BIN'" EXIT

# preload
while [[ $# -gt 0 ]]; do
  case "$1" in
    --preload|-l) [[ -f "$2" ]] && cat "$2" >> "$STATE" && echo "loaded: $2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "FreeLang REPL — Ctrl+D 종료, :help"
echo "────────────────────────────────────"

gcc_compile() {
  local src_c="$1" out_bin="$2"
  gcc -O0 -w -I "$RUNTIME_DIR" -o "$out_bin" \
    "$src_c" "${RUNTIME_SOURCES[@]}" \
    -lm -lpthread -ldl -lssl -lcrypto 2>&1
}

run_expr() {
  local fl_src="$1"
  # FL → C
  local cgc_err
  cgc_err=$("$CGC_BIN" "$fl_src" "$TMP_C" 2>&1)
  if [[ $? -ne 0 ]]; then
    echo "$cgc_err" | grep -v "^Compiled" >&2
    return 1
  fi
  # C → ELF
  local build_err
  build_err=$(gcc_compile "$TMP_C" "$TMP_BIN" 2>&1)
  if [[ $? -ne 0 ]]; then
    # FL 관점 에러 변환 (python3)
    local fl_err
    fl_err=$(echo "$build_err" | python3 -c "
import sys, re
shown = set()
for line in sys.stdin:
    m = re.search(r\"error: '([A-Za-z_][A-Za-z0-9_]*)' undeclared\", line)
    if m and m.group(1) not in shown:
        shown.add(m.group(1)); print('[FL Error] 정의되지 않은 이름:', m.group(1).replace('_','-'))
        continue
    m = re.search(r\"error: too few arguments to function '([A-Za-z_][A-Za-z0-9_]*)'\", line)
    if m and m.group(1) not in shown:
        shown.add(m.group(1)); print('[FL Error] 함수 \"'+m.group(1).replace('_','-')+'\": 인자 부족')
        continue
" 2>/dev/null)
    if [[ -n "$fl_err" ]]; then echo "$fl_err" >&2
    else echo "$build_err" | grep "error:" | head -2 >&2; fi
    return 1
  fi
  # 실행
  "$TMP_BIN" 2>&1
}

process_line() {
  local line="$1"
  local trimmed
  trimmed=$(echo "$line" | sed 's/^[[:space:]]*//')

  # definition: state에 추가
  if echo "$trimmed" | grep -qE '^\((defn|define|load) '; then
    echo "$line" >> "$STATE"
    # 검증
    if run_expr "$STATE" > /dev/null 2>&1; then
      echo "  ; ok"
    else
      # rollback
      head -n -1 "$STATE" > "${STATE}.tmp" && mv "${STATE}.tmp" "$STATE"
      # 에러 다시 출력
      {
        cat "$STATE"
        echo "$line"
      } > /tmp/_fl_verify_$$.fl
      run_expr "/tmp/_fl_verify_$$.fl" > /dev/null
      rm -f "/tmp/_fl_verify_$$.fl"
    fi
    return
  fi

  # println이 있으면 그대로, 없으면 감싸기
  local to_run
  if echo "$trimmed" | grep -qE '^\(println '; then
    to_run="$trimmed"
  else
    to_run="(println $trimmed)"
  fi

  {
    cat "$STATE"
    echo "$to_run"
  } > /tmp/_fl_expr_$$.fl
  run_expr "/tmp/_fl_expr_$$.fl"
  rm -f "/tmp/_fl_expr_$$.fl"
}

# REPL 루프
while true; do
  if [[ -t 0 ]]; then
    IFS= read -r -p "fl> " line || break
  else
    IFS= read -r line || break
  fi
  [[ -z "$line" ]] && continue

  case "$line" in
    :q|:quit|:exit) echo "Bye."; break ;;
    :clear|:reset)  > "$STATE"; echo "  ; state cleared" ;;
    :state)
      if [[ -s "$STATE" ]]; then cat "$STATE"
      else echo "  ; (empty)"; fi ;;
    :help)
      echo "  expr            결과 출력"
      echo "  (define x 42)   저장"
      echo "  (defn f [n] ...) 저장"
      echo "  :state          현재 정의"
      echo "  :clear          초기화"
      echo "  :quit           종료"
      ;;
    *) process_line "$line" ;;
  esac
done
echo ""
