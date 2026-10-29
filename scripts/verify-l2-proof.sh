#!/usr/bin/env bash
# Native L2 proof: compare each test's output from two seed-derived compilers.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
SEED="$ROOT/bin/cgc-bin-x86_64-seed-v11"
RUN_ID="${GITHUB_RUN_ID:-${UID}}"
WORK_DIR="${FL_NATIVE_L2_WORK_DIR:-${TMPDIR:-/tmp}/freelang-v11-native-l2-${RUN_ID}}"
MARKER="$WORK_DIR/.native-l2-proof"
TEST_DIR="$ROOT/tests/l2"

prepare() {
  if [[ -e "$WORK_DIR" && ! -f "$MARKER" ]]; then
    echo 'L2_PROOF=BLOCKED'
    echo 'CAUSE=work-directory-not-owned'
    return 2
  fi
  mkdir -p "$WORK_DIR"
  : > "$MARKER"
  if [[ ! -x "$SEED" ]]; then
    echo 'L2_PROOF=BLOCKED'
    echo 'CAUSE=seed-compiler-missing'
    return 2
  fi
  "$SEED" "$ROOT/self/cgc-main.fl" "$WORK_DIR/stage2.c"
  bash "$SCRIPT_DIR/build-cgc-native.sh" "$WORK_DIR/stage2.c" "$WORK_DIR/stage2-bin" >/dev/null
  "$WORK_DIR/stage2-bin" "$ROOT/self/cgc-main.fl" "$WORK_DIR/stage3.c"
  bash "$SCRIPT_DIR/build-cgc-native.sh" "$WORK_DIR/stage3.c" "$WORK_DIR/stage3-bin" >/dev/null
  echo 'L2_PROOF_PREPARE=PASS'
}

run_tests() {
  if [[ ! -x "$WORK_DIR/stage2-bin" || ! -x "$WORK_DIR/stage3-bin" ]]; then
    prepare
  fi
  local total=0 passed=0 failed=0
  local test_file name compiler source_c binary output
  while IFS= read -r -d '' test_file; do
    name="$(basename "$test_file" .fl)"
    total=$((total + 1))
    for compiler in stage2 stage3; do
      source_c="$WORK_DIR/${name}-${compiler}.c"
      binary="$WORK_DIR/${name}-${compiler}"
      output="$WORK_DIR/${name}-${compiler}.out"
      "$WORK_DIR/${compiler}-bin" "$test_file" "$source_c"
      gcc -I "$ROOT/runtime" -o "$binary" "$source_c" \
        "$ROOT/runtime/core.c" "$ROOT/runtime/collection.c" "$ROOT/runtime/io.c" \
        "$ROOT/runtime/math.c" "$ROOT/runtime/error.c" "$ROOT/runtime/process.c" \
        "$ROOT/runtime/json.c" "$ROOT/runtime/cgc-bridge.c" -lm
      "$binary" > "$output"
    done
    if cmp -s "$WORK_DIR/${name}-stage2.out" "$WORK_DIR/${name}-stage3.out"; then
      passed=$((passed + 1))
      echo "L2_CASE=PASS name=$name"
    else
      failed=$((failed + 1))
      echo "L2_CASE=FAIL name=$name"
      diff -u "$WORK_DIR/${name}-stage2.out" "$WORK_DIR/${name}-stage3.out" | head -20 || true
    fi
  done < <(find "$TEST_DIR" -maxdepth 1 -type f -name '*.fl' -print0 | sort -z)
  local pass_rate=0
  if [[ "$total" -gt 0 ]]; then pass_rate=$((passed * 100 / total)); fi
  jq -n --argjson total "$total" --argjson passed "$passed" \
    --argjson failed "$failed" --argjson pass_rate "$pass_rate" \
    '{total:$total,passed:$passed,failed:$failed,pass_rate:$pass_rate}' \
    > "$ROOT/L2-PROOF-RESULTS.json"
  printf 'L2_SUMMARY total=%s passed=%s failed=%s\n' "$total" "$passed" "$failed"
  if [[ "$failed" -eq 0 && "$total" -gt 0 ]]; then
    echo 'L2_PROOF=PASS'
  else
    echo 'L2_PROOF=FAIL'
    return 1
  fi
}

clean() {
  if [[ -f "$MARKER" ]]; then
    rm -rf -- "$WORK_DIR"
    echo 'L2_PROOF_CLEAN=PASS'
  else
    echo 'L2_PROOF_CLEAN=BLOCKED'
    echo 'CAUSE=work-directory-not-owned'
    return 2
  fi
}

case "${1:---run}" in
  --prepare) prepare ;;
  --run) run_tests ;;
  --clean) clean ;;
  *) echo 'usage: verify-l2-proof.sh --prepare|--run|--clean' >&2; exit 2 ;;
esac
