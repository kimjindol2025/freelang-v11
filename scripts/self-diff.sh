#!/data/data/com.termux/files/usr/bin/bash
# P00/07: TS 구현과 self (FL) 구현 출력 동등성 비교.
# Phase 01~09 각 단계 완료 시 실행하여 diff 0 을 보장.
#
# 사용:
#   bash scripts/self-diff.sh lex    # self/fixtures/lex/*.fl 전수
#   bash scripts/self-diff.sh parse  # self/fixtures/parse/*.fl 전수
#   bash scripts/self-diff.sh eval   # self/fixtures/eval/*.fl 전수
#   bash scripts/self-diff.sh all    # 전부
#
# 출력:
#   selfdiff kind=lex total=N pass=N fail=N
#   selfdiff kind=parse total=N pass=N fail=N
#   ...
#   selfdiff result=ok|fail

set -e
cd "$(dirname "$0")/.."

MODE="${1:-all}"
TOTAL_FAIL=0

run_kind() {
  local kind="$1"
  local dir="self/fixtures/$kind"
  if [ ! -d "$dir" ]; then
    echo "selfdiff kind=$kind status=skipped reason=no_fixtures"
    return 0
  fi
  local total=0 pass=0 fail=0
  local fails=()
  for f in "$dir"/*.fl; do
    [ -f "$f" ] || continue
    total=$((total + 1))
    local expected="${f%.fl}.expected.json"

    # TS 구현으로 참값 생성 또는 비교
    local ts_out
    case "$kind" in
      lex)   ts_out=$(node bootstrap.js lex-json "$f" 2>&1 || echo "ERR") ;;
      parse) ts_out=$(node bootstrap.js parse-json "$f" 2>&1 || echo "ERR") ;;
      eval)  ts_out=$(node bootstrap.js run "$f" 2>&1 || echo "ERR") ;;
    esac

    # self 구현 출력 (Phase 01~09 진행되면서 추가)
    local self_out=""
    case "$kind" in
      lex)   [ -f self/lexer.fl ] && self_out=$(node bootstrap.js run self/test-lex.fl "$f" 2>&1 || true) ;;
      parse) [ -f self/parser.fl ] && self_out=$(node bootstrap.js run self/test-parse.fl "$f" 2>&1 || true) ;;
      eval)  [ -f self/main.fl ] && self_out=$(node bootstrap.js run self/main.fl "$f" 2>&1 || true) ;;
    esac

    # 아직 self 구현이 없으면 skip (Phase 진행 전)
    if [ -z "$self_out" ]; then
      continue
    fi

    if [ "$ts_out" = "$self_out" ]; then
      pass=$((pass + 1))
    else
      fail=$((fail + 1))
      fails+=("$f")
    fi
  done
  echo "selfdiff kind=$kind total=$total pass=$pass fail=$fail"
  if [ "$fail" -gt 0 ]; then
    for f in "${fails[@]}"; do
      echo "selfdiff kind=$kind failed=$f" >&2
    done
    TOTAL_FAIL=$((TOTAL_FAIL + fail))
  fi
}

case "$MODE" in
  lex)   run_kind lex ;;
  parse) run_kind parse ;;
  eval)  run_kind eval ;;
  all)
    run_kind lex
    run_kind parse
    run_kind eval
    ;;
  *)
    echo "usage: $0 {lex|parse|eval|all}" >&2
    exit 1
    ;;
esac

if [ "$TOTAL_FAIL" -eq 0 ]; then
  echo "selfdiff result=ok"
  exit 0
else
  echo "selfdiff result=fail total_fail=$TOTAL_FAIL" >&2
  exit 1
fi
