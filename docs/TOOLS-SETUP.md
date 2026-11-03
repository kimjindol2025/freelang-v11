# Native `freelang-tools` setup for v11 checks

The v11 quick checks require the sibling repository `freelang-tools`. Use the credential-free clone URL below; authenticate through the machine's configured Git credential helper if needed. Do not put credentials in the URL.

```sh
git clone https://github.com/kimjindol2025/freelang-tools.git freelang-tools
git -C freelang-tools checkout --detach 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
test "$(git -C freelang-tools rev-parse HEAD)" = 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
test -x freelang-tools/scripts/cgc-native
test -x freelang-tools/scripts/fl-cgc-run
sha256sum freelang-tools/scripts/cgc-native freelang-tools/scripts/fl-cgc-run
```

Expected executable hashes at the pinned commit:

- `cgc-native`: `b9681984c7b92d581da56bf73af84053817efc5a618192ab5c9586a58c91e814`
- `fl-cgc-run`: `55321a11271135b3c27bc1a4e6cd393e6a812de5b208db47884afb7c0e5cd16c`

The repository's native scripts are already present at this commit. No package installation or generated JavaScript is part of preparation. From the v11 checkout, select the clone explicitly if it is not at the default sibling location:

```sh
export FL_TOOLS_ROOT="/path/to/freelang-tools"
```

The v11 quick-check entry point verifies that `FL_TOOLS_ROOT` (or the default sibling repository) is at the pinned commit before running the dependent checks. The setup was verified from a separate fresh clone: checkout `5bbfb771e5f9c83f0b9664e306ff143a0a2b556c`, both scripts executable, and both hashes matched the values above.

## Prepare the test compiler

The compiler argument for `tests/run-task946-full.sh`, `tests/run-task938-load.sh`, and `tests/run-task942-pool.sh` must be the native stage2 compiler binary. Do not pass `bin/cgc-bin-x86_64-seed-v11` directly as the suite compiler. Build stage2 from the repository seed and compiler source:

```sh
WORK="$(mktemp -d)"
bin/cgc-bin-x86_64-seed-v11 self/cgc-main.fl "$WORK/stage2.c"
bash scripts/build-cgc-native.sh "$WORK/stage2.c" "$WORK/stage2-bin"
COMPILER="$WORK/stage2-bin"
test -x "$COMPILER"
```

## Prepare the native project detector

At this pinned tools commit, `scripts/fl-test` calls `scripts/fl-detect`, which needs the generated native executable `scripts/detect-core-native`. A fresh Git clone does not contain that build output. Build it with the native stage2 compiler and the v11 runtime; this creates an untracked native executable inside the tools clone and does not change its Git HEAD:

```sh
FREELANG_V11_RUNTIME="/path/to/freelang-v11/runtime"
"$COMPILER" "$FL_TOOLS_ROOT/native/detect-core.fl" "$WORK/detect-core-native.c"
gcc -w -I "$FREELANG_V11_RUNTIME" -o "$FL_TOOLS_ROOT/scripts/detect-core-native" \
  "$WORK/detect-core-native.c" \
  "$FREELANG_V11_RUNTIME/core.c" "$FREELANG_V11_RUNTIME/collection.c" \
  "$FREELANG_V11_RUNTIME/io.c" "$FREELANG_V11_RUNTIME/math.c" \
  "$FREELANG_V11_RUNTIME/error.c" "$FREELANG_V11_RUNTIME/process.c" \
  "$FREELANG_V11_RUNTIME/json.c" "$FREELANG_V11_RUNTIME/cgc-bridge.c" -lm
test -x "$FL_TOOLS_ROOT/scripts/detect-core-native"
"$FL_TOOLS_ROOT/scripts/fl-detect" "$FL_TOOLS_ROOT" > "$WORK/tools-detect.log"
grep -Fx 'DIALECT=TOOLS' "$WORK/tools-detect.log"
grep -F "$FL_TOOLS_ROOT/scripts/fl-tools" "$WORK/tools-detect.log"
test "$(git -C "$FL_TOOLS_ROOT" rev-parse HEAD)" = 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
```

The native workflow adapter fixture also needs six native helpers, which are generated outputs absent from a fresh clone:

```sh
for helper in workflow-core workflow-blocked workflow-plan workflow-config workflow-list workflow-report; do
  "$COMPILER" "$FL_TOOLS_ROOT/native/$helper.fl" "$WORK/$helper.c"
  gcc -w -I "$FREELANG_V11_RUNTIME" -o "$FL_TOOLS_ROOT/scripts/$helper-native" \
    "$WORK/$helper.c" \
    "$FREELANG_V11_RUNTIME/core.c" "$FREELANG_V11_RUNTIME/collection.c" \
    "$FREELANG_V11_RUNTIME/io.c" "$FREELANG_V11_RUNTIME/math.c" \
    "$FREELANG_V11_RUNTIME/error.c" "$FREELANG_V11_RUNTIME/process.c" \
    "$FREELANG_V11_RUNTIME/json.c" "$FREELANG_V11_RUNTIME/cgc-bridge.c" -lm
done
for helper in workflow-core workflow-blocked workflow-plan workflow-config workflow-list workflow-report; do
  test -x "$FL_TOOLS_ROOT/scripts/$helper-native"
done
(cd "$FL_TOOLS_ROOT" && "$FL_TOOLS_ROOT/scripts/fl-cgc-run" \
  "$FL_TOOLS_ROOT/tests/native-workflow-adapter.test.fl")
test "$(git -C "$FL_TOOLS_ROOT" rev-parse HEAD)" = 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
```

The tools test suite also needs `scripts/test-result-native`:

```sh
"$COMPILER" "$FL_TOOLS_ROOT/native/test-result.fl" "$WORK/test-result.c"
gcc -w -I "$FREELANG_V11_RUNTIME" -o "$FL_TOOLS_ROOT/scripts/test-result-native" \
  "$WORK/test-result.c" \
  "$FREELANG_V11_RUNTIME/core.c" "$FREELANG_V11_RUNTIME/collection.c" \
  "$FREELANG_V11_RUNTIME/io.c" "$FREELANG_V11_RUNTIME/math.c" \
  "$FREELANG_V11_RUNTIME/error.c" "$FREELANG_V11_RUNTIME/process.c" \
  "$FREELANG_V11_RUNTIME/json.c" "$FREELANG_V11_RUNTIME/cgc-bridge.c" -lm
test -x "$FL_TOOLS_ROOT/scripts/test-result-native"
test "$(git -C "$FL_TOOLS_ROOT" rev-parse HEAD)" = 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
```

The v11 full check's tester audit also needs the native tester runner. Build it from the pinned source:

```sh
"$COMPILER" "$FL_TOOLS_ROOT/native/tester-runner.fl" "$WORK/tester-runner.c"
gcc -w -I "$FREELANG_V11_RUNTIME" -o "$FL_TOOLS_ROOT/scripts/tester-runner-native" \
  "$WORK/tester-runner.c" \
  "$FREELANG_V11_RUNTIME/core.c" "$FREELANG_V11_RUNTIME/collection.c" \
  "$FREELANG_V11_RUNTIME/io.c" "$FREELANG_V11_RUNTIME/math.c" \
  "$FREELANG_V11_RUNTIME/error.c" "$FREELANG_V11_RUNTIME/process.c" \
  "$FREELANG_V11_RUNTIME/json.c" "$FREELANG_V11_RUNTIME/cgc-bridge.c" -lm
test -x "$FL_TOOLS_ROOT/scripts/tester-runner-native"
test -f "$FL_TOOLS_ROOT/scripts/fl-probe-check"
test "$(git -C "$FL_TOOLS_ROOT" rev-parse HEAD)" = 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
```

The same audit checks the probe with two native executables. Build both from the pinned sources:

```sh
for helper in script-check arity-check; do
  "$COMPILER" "$FL_TOOLS_ROOT/native/$helper.fl" "$WORK/$helper.c"
  gcc -w -I "$FREELANG_V11_RUNTIME" -o "$FL_TOOLS_ROOT/scripts/$helper-native" \
    "$WORK/$helper.c" \
    "$FREELANG_V11_RUNTIME/core.c" "$FREELANG_V11_RUNTIME/collection.c" \
    "$FREELANG_V11_RUNTIME/io.c" "$FREELANG_V11_RUNTIME/math.c" \
    "$FREELANG_V11_RUNTIME/error.c" "$FREELANG_V11_RUNTIME/process.c" \
    "$FREELANG_V11_RUNTIME/json.c" "$FREELANG_V11_RUNTIME/cgc-bridge.c" -lm
done
test -x "$FL_TOOLS_ROOT/scripts/script-check-native"
test -x "$FL_TOOLS_ROOT/scripts/arity-check-native"
test "$(git -C "$FL_TOOLS_ROOT" rev-parse HEAD)" = 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
```

Keep the generated helper as native C output. This preparation does not run Node, npm, npx, or JavaScript.

`scripts/fl-test` also calls `scripts/fl-native-test-plan`, which requires the generated `scripts/test-plan-native` executable. Build and verify it the same way from `native/test-plan.fl`:

```sh
"$COMPILER" "$FL_TOOLS_ROOT/native/test-plan.fl" "$WORK/test-plan-native.c"
gcc -w -I "$FREELANG_V11_RUNTIME" -o "$FL_TOOLS_ROOT/scripts/test-plan-native" \
  "$WORK/test-plan-native.c" \
  "$FREELANG_V11_RUNTIME/core.c" "$FREELANG_V11_RUNTIME/collection.c" \
  "$FREELANG_V11_RUNTIME/io.c" "$FREELANG_V11_RUNTIME/math.c" \
  "$FREELANG_V11_RUNTIME/error.c" "$FREELANG_V11_RUNTIME/process.c" \
  "$FREELANG_V11_RUNTIME/json.c" "$FREELANG_V11_RUNTIME/cgc-bridge.c" -lm
test -x "$FL_TOOLS_ROOT/scripts/test-plan-native"
"$FL_TOOLS_ROOT/scripts/fl-native-test-plan" "$FL_TOOLS_ROOT" "$FL_TOOLS_ROOT/tests" > "$WORK/tools-test-plan.log"
grep -F 'PLAN_SCHEMA=freelang.test-plan' "$WORK/tools-test-plan.log"
test "$(git -C "$FL_TOOLS_ROOT" rev-parse HEAD)" = 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
```

## Check settings before running

Set `FL_TOOLS_ROOT` to the fresh, pinned tools clone and `COMPILER` to the executable native stage2 binary. Confirm the tools revision and both executable paths before starting a suite:

```sh
TOOLS_HEAD="$(git -C "$FL_TOOLS_ROOT" rev-parse HEAD)"
test "$TOOLS_HEAD" = 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
test -x "$FL_TOOLS_ROOT/scripts/cgc-native"
test -x "$FL_TOOLS_ROOT/scripts/fl-cgc-run"
test -x "$COMPILER"
printf 'FL_TOOLS_ROOT=<가림>\nCOMPILER=<가림>\nTOOLS_HEAD=%s\n' "$TOOLS_HEAD"
```

Use the same `FL_TOOLS_ROOT` and `COMPILER` values for every full, LOAD2, and pool run. Record the two paths as `<가림>` in reports; keep the exact `TOOLS_HEAD` value.
