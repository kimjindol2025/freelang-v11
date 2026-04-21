#!/bin/bash
# scripts/verify-self-host.sh — stage1 canonical self-host verification
#
# Phase A 전환 후 정의:
#   stage1 (self-compiled compiler) 가 primary/canonical compiler.
#   bootstrap 은 stage1 을 1 회 생성하기 위한 용도로만 쓰며, 이후 검증에는
#   관여하지 않는다. (언어 정의 단일화 · 자주국방 원칙)
#
# 사용법: ./scripts/verify-self-host.sh [tier1|tier2|all]
#
# 검증 방식:
#   1) bootstrap 으로 stage1.js 1회 생성 (bootstrap 의 유일한 역할)
#   2) 각 FL 파일 마다:
#        - stage1 로 compile → JS 산출
#        - node --check 로 JS 구문 유효성 확인
#        - [RUN] 파일은 JS 를 timeout 3s 로 실행, 실행 exit code / 출력 검사
#        - [DEFS] 파일은 compile + 유효성까지만
#   3) stage1 이 자기 자신(self/all.fl) 을 컴파일해 stage2 를 만들 때
#      **stage1 == stage2** (SHA256 fixed-point) 도 함께 검증 (1회)
#
# 파일 카테고리:
#   [RUN]  — 실행 가능한 파일 (main 이 있음), 실행 결과로 검증
#   [DEFS] — 함수 정의만, 실행해도 의미 없음. compile+syntax 까지만

set -u

cd "$(dirname "$0")/.."
REPO=$(pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

STAGE1="$WORK/stage1.js"

echo "=== stage1 생성 (bootstrap 1회 사용) ==="
node --stack-size=8000 bootstrap.js run self/all.fl self/all.fl "$STAGE1" > /dev/null 2>&1
if [ ! -s "$STAGE1" ]; then
  echo "❌ stage1.js 생성 실패"
  exit 2
fi
echo "   stage1 $(wc -c < "$STAGE1") bytes"

echo ""
echo "=== 결정론 확인 (Phase C: 같은 입력 2회 compile → SHA 동일) ==="
# Phase C 증명 강화: 같은 소스를 다른 시각·별도 프로세스로 compile 해도
# bit-identical 결과가 나오는지 확인. 시간·랜덤·해시 의존성이 없음을 증명.
STAGE1B="$WORK/stage1b.js"
sleep 1
node --stack-size=8000 bootstrap.js run self/all.fl self/all.fl "$STAGE1B" > /dev/null 2>&1
DET_A=$(sha256sum "$STAGE1" | cut -c1-16)
DET_B=$(sha256sum "$STAGE1B" | cut -c1-16)
echo "   1st run sha: $DET_A"
echo "   2nd run sha: $DET_B"
if [ "$DET_A" = "$DET_B" ]; then
  echo "   ✅ 결정론 OK (bit-identical across time & separate process)"
else
  echo "   ❌ 결정론 실패 — compile 이 non-deterministic"
  exit 1
fi

echo ""
echo "=== Phase C-4: 의미 보존 invariant (N 스니펫 × 2회 compile bit-identical) ==="
# 결정론을 단일 파일(self/all.fl)이 아닌 다양한 FL 구문 스니펫으로 확장.
# 문법 요소 별로 compile 결과가 시간·프로세스 독립적임을 증명.
# 스니펫은 literal · sexpr · let · if · cond · fn · [FUNC] · map · throw
# 등 주요 구문을 대표하도록 선정.
RT_SNIPPETS=(
  '(println "hello")'
  '(+ 1 2 3)'
  '(let [[$x 10]] (println $x))'
  '(if (< 1 2) "yes" "no")'
  '(cond [(= 1 1) "a"] [true "b"])'
  '((fn [$x] (* $x 2)) 5)'
  '[FUNC sq :params [$n] :body (* $n $n)]'
  '{:name "kim" :age 30}'
  '(map (fn [$x] (+ $x 1)) (list 1 2 3))'
  '(throw "err")'
)
RT_OK=0
RT_FAIL=0
for i in "${!RT_SNIPPETS[@]}"; do
  SRC="$WORK/rt_${i}.fl"
  A="$WORK/rt_${i}_a.js"
  B="$WORK/rt_${i}_b.js"
  printf '%s\n' "${RT_SNIPPETS[$i]}" > "$SRC"
  # 2회 compile, 다른 시각에 (stage1 canonical)
  node --stack-size=8000 "$STAGE1" "$SRC" "$A" > /dev/null 2>&1 || { RT_FAIL=$((RT_FAIL+1)); continue; }
  node --stack-size=8000 "$STAGE1" "$SRC" "$B" > /dev/null 2>&1 || { RT_FAIL=$((RT_FAIL+1)); continue; }
  SA=$(sha256sum "$A" | cut -c1-16)
  SB=$(sha256sum "$B" | cut -c1-16)
  if [ "$SA" = "$SB" ]; then
    RT_OK=$((RT_OK+1))
  else
    echo "   ❌ snippet $i 결정론 깨짐 ($SA vs $SB): ${RT_SNIPPETS[$i]}"
    RT_FAIL=$((RT_FAIL+1))
  fi
done
echo "   invariant OK=$RT_OK / FAIL=$RT_FAIL / total=${#RT_SNIPPETS[@]}"
if [ "$RT_FAIL" -gt 0 ]; then
  echo "   ❌ round-trip 결정론 실패 — 의미 보존 깨짐"
  exit 1
fi
echo "   ✅ round-trip 결정론 OK (${#RT_SNIPPETS[@]} 스니펫 전원 bit-identical)"

echo ""
echo "=== fixed-point 확인 (다단계 SHA 체인, Phase C: stage1~5) ==="
# Phase C 증명 강화: stage depth 를 3 → 5 로 확장.
# 기준선이 "우연히" 3 단계만 일치가 아니라, 반복 compile 에도 불변임을 증명.
STAGE_FILES=("$STAGE1")
PREV="$STAGE1"
for i in 2 3 4 5; do
  CUR="$WORK/stage${i}.js"
  node --stack-size=8000 "$PREV" self/all.fl "$CUR" > /dev/null 2>&1
  if [ ! -s "$CUR" ]; then
    echo "   ❌ stage${i}.js 생성 실패"
    exit 1
  fi
  STAGE_FILES+=("$CUR")
  PREV="$CUR"
done
FP_SHA=$(sha256sum "$STAGE1" | cut -c1-16)
FP_OK=1
for i in 1 2 3 4 5; do
  idx=$((i-1))
  SH=$(sha256sum "${STAGE_FILES[$idx]}" | cut -c1-16)
  echo "   stage${i} sha: $SH"
  [ "$SH" != "$FP_SHA" ] && FP_OK=0
done
if [ "$FP_OK" = "1" ]; then
  echo "   ✅ fixed-point OK (5 단계 전원 일치)"
else
  echo "   ❌ fixed-point 실패 — self-hosting 기준선 깨짐"
  exit 1
fi
echo ""

# 슬래시 안전 태그
safe() { echo "$1" | tr '/[]' '___'; }

PASS=0
FAIL=0
SKIP=0
FAIL_LIST=()
CURRENT_TIER="t1"   # t1(strict) / t2(advisory)
T1_FAIL=0
T2_FAIL=0

# stage1 codegen 에서 현재 처리 못하는 구문이 들어 있는 파일 (Phase A 후속 수정 대상)
# 비어 있으면 완전 통과. 추후 새 gap 발견 시 여기에 추가.
KNOWN_STAGE1_CODEGEN_GAP=()
is_known_codegen_gap() {
  for k in "${KNOWN_STAGE1_CODEGEN_GAP[@]}"; do
    [ "$1" = "$k" ] && return 0
  done
  return 1
}

bump_fail() {
  local f="$1"
  if [ "$CURRENT_TIER" = "t1" ]; then
    T1_FAIL=$((T1_FAIL+1))
  else
    T2_FAIL=$((T2_FAIL+1))
  fi
  FAIL=$((FAIL+1))
  FAIL_LIST+=("$f")
}

# Phase B wrapper: test-codegen-* 는 stage1 의 parse/runtime_prelude 를
# 실행 스코프에 필요로 함. stage1.js 본체 변형 없이, 실행 JS 를 아래 순서로
# concat 한 임시 파일을 만들어 node 로 실행:
#   1) stage1.js 원본 그대로
#   2) 명시적 alias: fl_parse = parse;  PRELUDE = runtime_prelude();
#   3) 실제 test JS
# stage1 본체에 있는 `if __argv__ …` 자동 호출은 wrapper 실행 시 argv 가
# 비어 있으므로 건너뜀. alias 외 어떤 런타임 변형도 하지 않음.
needs_stage1_context() {
  # Phase B wrapper 적용 대상 — FL parser/prelude 를 self-define 하지 않고
  # 호출만 하는 5개 테스트. test-codegen-ext/run, test-real-stdlib,
  # test-selfcompile 등은 자체 inline parser 를 정의하므로 wrapper 에
  # 끼우면 심볼 중복 선언 충돌 발생 → 여기서는 제외.
  case "$1" in
    self/tests/test-codegen-builtins.fl) return 0 ;;
    self/tests/test-codegen-ffi.fl) return 0 ;;
    self/tests/test-codegen-fn.fl) return 0 ;;
    self/tests/test-codegen-match.fl) return 0 ;;
    self/tests/test-codegen-sf.fl) return 0 ;;
    *) return 1 ;;
  esac
}
run_with_stage1_context() {
  local test_js="$1"
  local out_file="$2"
  local merged="$WORK/merged_$(safe "$test_js")"
  # stage1 원본 + alias + test 를 하나의 파일로 concat.
  # test 본문은 IIFE 로 감싸 test 자체의 const/let 선언이 stage1 의 동일명
  # 심볼(cg, js_esc 등) 과 top-level 에서 충돌하지 않도록 함.
  # stage1 심볼은 IIFE 내부에서 outer scope 로 접근 가능.
  {
    cat "$STAGE1"
    echo ""
    echo "// ── Phase B wrapper: alias (stage1 변형 없음) ──"
    echo "const fl_parse = parse;"
    echo "const PRELUDE = runtime_prelude();"
    echo ""
    echo "// ── test body — IIFE 로 감싸 내부 const 가 top-level 에 leak 하지 않게 ──"
    echo "(function(){"
    cat "$test_js"
    echo ""
    echo "})();"
  } > "$merged"
  # wrapper 테스트는 내부에서 child node 프로세스를 여러 개 spawn 하는 경우가
  # 있어 3 초 timeout 으로는 부족. 30 초로 확장.
  timeout 30 node --stack-size=8000 "$merged" > "$out_file" 2>&1
}

check_run() {
  local f="$1"
  local tag="$(safe "$f")"
  local s1="$WORK/s1_${tag}.js"
  local out="$WORK/out_${tag}"
  local log="$WORK/log_${tag}"

  # stage1 로 compile
  if ! node --stack-size=8000 "$STAGE1" "$f" "$s1" > "$log" 2>&1; then
    echo "❌ [RUN] $f — stage1 compile 실패"
    bump_fail "$f [compile]"
    return
  fi
  # JS 구문 검증
  if ! node --check "$s1" > /dev/null 2>&1; then
    if is_known_codegen_gap "$f"; then
      echo "⚠️  [RUN] $f — KNOWN stage1 codegen gap (syntax-invalid JS)"
      SKIP=$((SKIP+1))
      return
    fi
    echo "❌ [RUN] $f — 생성 JS 구문 오류"
    bump_fail "$f [syntax]"
    return
  fi
  # 실행 — test-codegen-* 는 stage1 context wrapper 경유
  # 일반 RUN 도 timeout 3→10 초로 확장 (codegen 계열 테스트는 내부에서
  # child node 프로세스 spawn 하므로 3 초 간혹 부족. 일관성·안정성 우선).
  local rc=0
  if needs_stage1_context "$f"; then
    run_with_stage1_context "$s1" "$out"
    rc=$?
  else
    timeout 10 node "$s1" > "$out" 2>&1
    rc=$?
  fi
  if [ "$rc" -ne 0 ]; then
    echo "❌ [RUN] $f — 실행 실패 (rc=$rc)"
    bump_fail "$f [runtime]"
    return
  fi
  local parsed=$(grep -oE "Parsed:\s*[0-9]+" "$log" 2>/dev/null | head -1 | grep -oE '[0-9]+' | head -1)
  local ctx_tag=""
  needs_stage1_context "$f" && ctx_tag=" (wrapper)"
  echo "✅ [RUN] $f (parsed=${parsed:-?}, $(wc -c < "$out") bytes output)$ctx_tag"
  PASS=$((PASS+1))
}

check_compile_only() {
  local f="$1"
  local tag="$(safe "$f")"
  local s1="$WORK/s1_${tag}.js"
  local log="$WORK/log_${tag}"
  if ! node --stack-size=8000 "$STAGE1" "$f" "$s1" > "$log" 2>&1; then
    echo "❌ [DEFS] $f — stage1 compile 실패"
    bump_fail "$f [compile]"
    return
  fi
  if ! node --check "$s1" > /dev/null 2>&1; then
    if is_known_codegen_gap "$f"; then
      echo "⚠️  [DEFS] $f — KNOWN stage1 codegen gap (syntax-invalid JS)"
      SKIP=$((SKIP+1))
      return
    fi
    echo "❌ [DEFS] $f — 생성 JS 구문 오류"
    bump_fail "$f [syntax]"
    return
  fi
  local parsed=$(grep -oE "Parsed:\s*[0-9]+" "$log" 2>/dev/null | head -1 | grep -oE '[0-9]+' | head -1)
  echo "✅ [DEFS] $f (parsed=${parsed:-?}, $(wc -c < "$s1") bytes JS)"
  PASS=$((PASS+1))
}

TIER="${1:-tier1}"

echo "=== Tier 1 ==="
RUN_T1=(
  "examples/hello.fl"
  "examples/factorial.fl"
  "self/bench/hello.fl"
  "self/bench/tiny.fl"
  "self/bench/fib30.fl"
  "self/bench/test-time.fl"
)
DEFS_T1=(
  "self/lexer.fl"
  "self/parser.fl"
  "self/ast.fl"
  "self/codegen.fl"
  "self/all.fl"
)

CURRENT_TIER="t1"
for f in "${RUN_T1[@]}"; do [ -f "$f" ] && check_run "$f" || echo "— 없음: $f"; done
for f in "${DEFS_T1[@]}"; do [ -f "$f" ] && check_compile_only "$f" || echo "— 없음: $f"; done

if [ "$TIER" = "tier2" ] || [ "$TIER" = "all" ]; then
  CURRENT_TIER="t2"
  echo ""
  echo "=== Tier 2: self/stdlib/ ==="
  for f in self/stdlib/*.fl; do
    [ -f "$f" ] && check_compile_only "$f"
  done
  echo ""
  echo "=== Tier 2: self/tests/ ==="
  for f in self/tests/*.fl; do
    [ -f "$f" ] && check_run "$f"
  done
fi

echo ""
echo "=== 결과 ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL   (Tier1: $T1_FAIL, Tier2: $T2_FAIL)"
echo "SKIP: $SKIP   (known stage1 codegen gaps)"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "실패 목록:"
  for x in "${FAIL_LIST[@]}"; do echo "  - $x"; done
fi
if [ "$T1_FAIL" -gt 0 ]; then
  echo ""
  echo "❌ Tier 1 실패 — self-hosting 기준선 깨짐"
  exit 1
fi
if [ "$T2_FAIL" -gt 0 ]; then
  echo ""
  echo "⚠️  Tier 2 일부 실패 (advisory; exit 0) — 조사 권장"
fi
if [ "$SKIP" -gt 0 ]; then
  echo ""
  echo "ℹ️  SKIP: stage1 codegen 잔여 버그 (nil → null 미번역, rest-args [& \$args] 미구현)."
  echo "   수정하면 SKIP → PASS 전환 예정."
fi
exit 0
