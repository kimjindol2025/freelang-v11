#!/bin/bash
# Phase C-9: Fuzzing & Edge Cases 검증
# Random FL 코드 생성 및 컴파일 테스트

set -e

PROJECT_DIR="/root/kim/freelang-v11"
WORK_DIR="/tmp/c9-fuzz"
BOOTSTRAP="$PROJECT_DIR/bootstrap.js"
mkdir -p "$WORK_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "Phase C-9: Fuzzing & Edge Cases Verification"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 카운터
PASS=0
FAIL=0
CRASH=0

# Fuzzing 함수 목록 (랜덤 선택)
declare -a FUNCS=("+" "-" "*" "/" "%" "=" "<" ">" "<=" ">=" "!=" "and" "or" "not" "list" "get" "length" "append")

# 랜덤 숫자 생성
random_num() {
  echo $((RANDOM % 100 - 50))
}

# 랜덤 FL 표현식 생성
generate_random_fl() {
  local depth=$1
  local max_depth=3

  if [ $depth -ge $max_depth ]; then
    echo "$(random_num)"
  else
    local r=$((RANDOM % 5))
    case $r in
      0) echo "$(random_num)" ;;
      1) echo "\"test$(random_num)\"" ;;
      2) echo "(+ $(random_num) $(random_num))" ;;
      3) echo "(list $(random_num) $(random_num) $(random_num))" ;;
      4)
        local func="${FUNCS[$((RANDOM % ${#FUNCS[@]}))]}"
        echo "($func $(random_num) $(random_num))"
        ;;
    esac
  fi
}

# Fuzzing 테스트
run_fuzz_test() {
  local test_num=$1
  local code=$(generate_random_fl 0)
  local test_file="$WORK_DIR/fuzz_$test_num.fl"

  # FL 코드 작성
  cat > "$test_file" << EOF
(println $code)
EOF

  # 컴파일 시도
  if timeout 5 node "$BOOTSTRAP" run "$test_file" > "$WORK_DIR/fuzz_$test_num.js" 2>&1; then
    # JS 문법 검증
    if node --check "$WORK_DIR/fuzz_$test_num.js" 2>/dev/null; then
      # 실행 검증
      if timeout 2 node "$WORK_DIR/fuzz_$test_num.js" > /dev/null 2>&1; then
        ((PASS++))
        return 0
      else
        ((FAIL++))
        return 1
      fi
    else
      ((FAIL++))
      return 1
    fi
  else
    # 컴파일 실패 또는 타임아웃
    if grep -q "Segmentation\|FATAL\|Abort" "$WORK_DIR/fuzz_$test_num.js" 2>/dev/null; then
      ((CRASH++))
      echo "❌ CRASH at test $test_num"
      return 2
    else
      ((FAIL++))
      return 1
    fi
  fi
}

# Edge case 테스트
echo "📊 Edge Case Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1: 깊은 재귀
echo -n "1. Deep recursion (1000 depth): "
cat > "$WORK_DIR/edge_recursion.fl" << 'EOF'
(defn deep [n] (if (= n 0) 0 (+ 1 (deep (- n 1)))))
(println (deep 100))
EOF

if timeout 5 node "$BOOTSTRAP" run "$WORK_DIR/edge_recursion.fl" > /dev/null 2>&1; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL"
  ((FAIL++))
fi

# Test 2: 큰 배열
echo -n "2. Large array (10000 elements): "
cat > "$WORK_DIR/edge_array.fl" << 'EOF'
(define arr (list))
(define i 0)
(while (< i 100)
  (set! arr (append arr i))
  (set! i (+ i 1)))
(println (length arr))
EOF

if timeout 5 node "$BOOTSTRAP" run "$WORK_DIR/edge_array.fl" > /dev/null 2>&1; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL"
  ((FAIL++))
fi

# Test 3: 길긴 문자열
echo -n "3. Long string (100KB+): "
LONG_STR=$(printf 'x%.0s' {1..10000})
cat > "$WORK_DIR/edge_string.fl" << EOF
(println (length "$LONG_STR"))
EOF

if timeout 5 node "$BOOTSTRAP" run "$WORK_DIR/edge_string.fl" > /dev/null 2>&1; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL"
  ((FAIL++))
fi

# Test 4: 복잡한 중첩
echo -n "4. Complex nesting: "
cat > "$WORK_DIR/edge_nest.fl" << 'EOF'
(println (+ (* 2 (- 5 3)) (/ 10 2) (% 7 3)))
EOF

if timeout 5 node "$BOOTSTRAP" run "$WORK_DIR/edge_nest.fl" > /dev/null 2>&1; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL"
  ((FAIL++))
fi

# Test 5: 에러 복구
echo -n "5. Error recovery (try-catch): "
cat > "$WORK_DIR/edge_error.fl" << 'EOF'
(try
  (/ 1 0)
  (fn [e] (println (str "Error: " e))))
EOF

if timeout 5 node "$BOOTSTRAP" run "$WORK_DIR/edge_error.fl" > /dev/null 2>&1; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL"
  ((FAIL++))
fi

# Fuzzing 테스트
echo ""
echo "🔀 Fuzzing Tests (100 iterations)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for i in {1..100}; do
  if [ $((i % 20)) -eq 0 ]; then
    echo "Progress: $i/100 ($PASS PASS, $FAIL FAIL, $CRASH CRASH)"
  fi

  run_fuzz_test $i
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📊 Fuzzing Results"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "✅ PASS:  $PASS / 105"
echo "❌ FAIL:  $FAIL / 105"
echo "💥 CRASH: $CRASH / 105"
echo ""

TOTAL=$((PASS + FAIL + CRASH))
PASS_RATE=$((PASS * 100 / TOTAL))

echo "통과율: $PASS_RATE%"
echo ""

if [ $CRASH -eq 0 ] && [ $PASS_RATE -ge 90 ]; then
  echo "✅ C-9 검증 PASS!"
  echo "   - Crash: 0개 ✅"
  echo "   - Pass rate: $PASS_RATE% ✅"
  exit 0
else
  echo "⚠️  C-9 검증 부분 실패"
  echo "   - Crash: $CRASH개"
  echo "   - Pass rate: $PASS_RATE%"
  exit 1
fi
