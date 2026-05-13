#!/bin/bash
# C-2 Path Traversal 검증 — FL_FILE_BASE 환경변수 필요
# 실행: bash tests/test-security-c2-path.sh

BOOTSTRAP="node $(dirname "$0")/../bootstrap.js"
PASS=0
FAIL=0

TMPFL=$(mktemp /tmp/fl-sec-XXXXXX.fl)
trap "rm -f $TMPFL" EXIT

check() {
  local label="$1"
  local expected="$2"  # "block" or "allow"
  local code="$3"

  echo "$code" > "$TMPFL"
  result=$(FL_FILE_BASE=/tmp $BOOTSTRAP run "$TMPFL" 2>&1)

  if [ "$expected" = "block" ]; then
    if echo "$result" | grep -q "Path traversal 차단\|차단\|Error\|오류"; then
      echo "  ✅ $label"
      PASS=$((PASS + 1))
    else
      echo "  ❌ FAIL: $label — 차단되지 않음 (output: $result)"
      FAIL=$((FAIL + 1))
    fi
  else
    if echo "$result" | grep -qv "Error\|오류"; then
      echo "  ✅ $label"
      PASS=$((PASS + 1))
    else
      echo "  ❌ FAIL: $label — 허용되어야 하는데 차단됨 (output: $result)"
      FAIL=$((FAIL + 1))
    fi
  fi
}

echo ""
echo "=== C-2 Path Traversal 검증 (FL_FILE_BASE=/tmp) ==="
echo ""

# 정상 경로 — /tmp 내부는 허용
echo "test" > /tmp/fl-sec-test.txt
check "FL_FILE_BASE 내부 읽기 허용" "allow" \
  '(println (file-read "/tmp/fl-sec-test.txt"))'

# 탈출 시도 — 차단되어야 함
check "../../etc/passwd 탈출 차단" "block" \
  '(file-read "../../etc/passwd")'

check "/etc/shadow 절대경로 차단" "block" \
  '(file-read "/etc/shadow")'

check "쓰기 경로 탈출 차단" "block" \
  '(file-write "../../tmp/injected.txt" "evil")'

check "/root/.ssh 접근 차단" "block" \
  '(file-read "/root/.ssh/authorized_keys")'

echo ""
echo "─────────────────────────────────────────────"
echo "결과: $PASS PASS / $FAIL FAIL"

if [ $FAIL -eq 0 ]; then
  echo "✅ C-2 Path Traversal 검증 통과"
  exit 0
else
  echo "❌ $FAIL개 검증 실패"
  exit 1
fi
