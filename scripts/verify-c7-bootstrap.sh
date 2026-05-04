#!/bin/bash
# Phase C-7: Bootstrap 직접 일관성 검증 스크립트
# 모든 L2 test case를 2회 컴파일하여 일관성 검증

set -e

PROJECT_DIR="/root/kim/freelang-v11"
TESTS_DIR="$PROJECT_DIR/tests/l2"
WORK_DIR="/tmp/c7-verify"
RESULTS_FILE="$PROJECT_DIR/C7-VERIFY-RESULTS.json"

# 초기화
mkdir -p "$WORK_DIR"
rm -f "$RESULTS_FILE"

# 결과 저장을 위한 JSON 함수
cat > "$WORK_DIR/results.txt" << 'EOF'
{}
EOF

# 테스트 결과 추적
declare -A TEST_RESULTS
PASS_COUNT=0
FAIL_COUNT=0

echo "═══════════════════════════════════════════════════════════════"
echo "Phase C-7: Bootstrap 직접 일관성 검증"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 각 test case 처리
for test_file in "$TESTS_DIR"/case-*.fl; do
  test_name=$(basename "$test_file" .fl)
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🧪 Testing: $test_name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  OUT1="$WORK_DIR/${test_name}_run1.js"
  OUT2="$WORK_DIR/${test_name}_run2.js"
  RESULT1="$WORK_DIR/${test_name}_result1.txt"
  RESULT2="$WORK_DIR/${test_name}_result2.txt"

  test_status="✅ PASS"
  error_msg=""

  # 1단계: 첫 번째 컴파일
  echo "  1️⃣  첫 번째 컴파일..."
  if ! node "$PROJECT_DIR/bootstrap.js" run "$test_file" > "$OUT1" 2>&1; then
    test_status="❌ FAIL"
    error_msg="Run 1: Compilation failed"
    echo "     ❌ 컴파일 실패"
  else
    # 2단계: 두 번째 컴파일
    echo "  2️⃣  두 번째 컴파일..."
    if ! node "$PROJECT_DIR/bootstrap.js" run "$test_file" > "$OUT2" 2>&1; then
      test_status="❌ FAIL"
      error_msg="Run 2: Compilation failed"
      echo "     ❌ 컴파일 실패"
    else
      # 3단계: JS 파일 일치성 검증
      echo "  3️⃣  JS 파일 일치성 검증..."
      if ! diff -q "$OUT1" "$OUT2" > /dev/null 2>&1; then
        test_status="❌ FAIL"
        error_msg="JS files differ"
        echo "     ❌ 생성된 JS 파일이 다름"
        echo "     차이점:"
        diff "$OUT1" "$OUT2" | head -20 || true
      else
        echo "     ✅ JS 파일 동일"

        # 4단계: JS 문법 검증
        echo "  4️⃣  JS 문법 검증..."
        if ! node --check "$OUT1" 2>&1 > /dev/null; then
          test_status="❌ FAIL"
          error_msg="Invalid JS syntax"
          echo "     ❌ JS 문법 오류"
        else
          echo "     ✅ JS 문법 올바름"

          # 5단계: 실행 검증
          echo "  5️⃣  실행 결과 일관성 검증..."
          if ! node "$OUT1" > "$RESULT1" 2>&1; then
            test_status="❌ FAIL"
            error_msg="Run 1: Execution failed"
            echo "     ❌ 실행 실패 (Run 1)"
          elif ! node "$OUT2" > "$RESULT2" 2>&1; then
            test_status="❌ FAIL"
            error_msg="Run 2: Execution failed"
            echo "     ❌ 실행 실패 (Run 2)"
          elif ! diff -q "$RESULT1" "$RESULT2" > /dev/null 2>&1; then
            test_status="❌ FAIL"
            error_msg="Execution results differ"
            echo "     ❌ 실행 결과가 다름"
            echo "     Run 1 출력:"
            head -5 "$RESULT1" || true
            echo "     Run 2 출력:"
            head -5 "$RESULT2" || true
          else
            echo "     ✅ 실행 결과 동일"
            test_status="✅ PASS"
            error_msg=""
          fi
        fi
      fi
    fi
  fi

  # 결과 기록
  TEST_RESULTS["$test_name"]="$test_status"
  if [ "$test_status" = "✅ PASS" ]; then
    ((PASS_COUNT++))
  else
    ((FAIL_COUNT++))
  fi

  echo "  📌 결과: $test_status"
  if [ -n "$error_msg" ]; then
    echo "     사유: $error_msg"
  fi
  echo ""
done

# 최종 결과
echo "═══════════════════════════════════════════════════════════════"
echo "📊 Phase C-7 검증 결과"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "✅ 통과: $PASS_COUNT/16"
echo "❌ 실패: $FAIL_COUNT/16"
echo ""

# 상세 결과 출력
echo "상세 결과:"
for i in {01..16}; do
  for test_name in "${!TEST_RESULTS[@]}"; do
    if [[ "$test_name" == case-$i-* ]]; then
      result="${TEST_RESULTS[$test_name]}"
      printf "  %-40s %s\n" "$test_name" "$result"
    fi
  done
done

echo ""
if [ $FAIL_COUNT -eq 0 ]; then
  echo "🎉 Phase C-7 완료! 모든 케이스 통과"
  exit 0
else
  echo "⚠️  $FAIL_COUNT개 케이스 실패. 디버깅 필요"
  exit 1
fi
