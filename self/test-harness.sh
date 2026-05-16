#!/bin/bash
# S33 pre-flight test harness
# 3개 테스트: compile | output-diff | runtime-sanity
set -e
cd /root/kim/freelang-v11

PASS=0; FAIL=0
ok()   { echo "PASS [$1]"; PASS=$((PASS+1)); }
fail() { echo "FAIL [$1]: $2"; FAIL=$((FAIL+1)); }

# ── Test 1: compile test ──────────────────────────────────────────────
# all.fl → C → gcc → cgc-bin 성공 여부
T1() {
  node bootstrap.js run self/run-cgc.fl self/cgc-main.fl /tmp/th_cgc.c 2>/dev/null \
    || { fail "compile" "run-cgc 실패"; return; }
  gcc -o /tmp/th_cgc_bin /tmp/th_cgc.c \
      -I./runtime ./runtime/runtime.c -lm 2>/dev/null \
    || { fail "compile" "gcc 실패"; return; }
  ok "compile"
}
T1

# ── Test 2: output diff test ──────────────────────────────────────────
# 같은 입력 2회 → C 출력 동일한지
T2() {
  node bootstrap.js run self/run-cgc.fl self/cgc-main.fl /tmp/th_r1.c 2>/dev/null
  node bootstrap.js run self/run-cgc.fl self/cgc-main.fl /tmp/th_r2.c 2>/dev/null
  H1=$(sha256sum /tmp/th_r1.c | cut -d' ' -f1)
  H2=$(sha256sum /tmp/th_r2.c | cut -d' ' -f1)
  if [ "$H1" = "$H2" ]; then
    ok "output-diff (SHA256=$H1)"
  else
    fail "output-diff" "비결정론: $H1 != $H2"
  fi
}
T2

# ── Test 3: runtime sanity test ──────────────────────────────────────
# (println (+ 1 2)) → C → 실행 → "3" 출력 확인
T3() {
  echo '(println (+ 1 2))' > /tmp/th_sanity.fl
  node bootstrap.js run self/run-cgc.fl /tmp/th_sanity.fl /tmp/th_sanity.c 2>/dev/null \
    || { fail "runtime-sanity" "codegen 실패"; return; }
  gcc -o /tmp/th_sanity_bin /tmp/th_sanity.c \
      -I./runtime ./runtime/runtime.c -lm 2>/dev/null \
    || { fail "runtime-sanity" "gcc 실패"; return; }
  RESULT=$(/tmp/th_sanity_bin 2>&1)
  if [ "$RESULT" = "3" ]; then
    ok "runtime-sanity (output=$RESULT)"
  else
    fail "runtime-sanity" "기대 '3', 실제 '$RESULT'"
  fi
}
T3

# ── 결과 ─────────────────────────────────────────────────────────────
echo "---"
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] && echo "ALL PASS" && exit 0 || exit 1
