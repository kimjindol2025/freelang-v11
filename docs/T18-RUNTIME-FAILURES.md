# T18 remaining failures

Baseline: `437f56e`, GitHub run `43172989703`: 1,419 passed,
13 failed, 0 skipped (1,432 assertions). Existing test sources, expectations,
timeouts, seeds and runners remain unchanged. GitHub delivery only.

Plan:

1. Implement capacity enforcement and access ordering in `stdlib/cache.fl`.
   Check the existing 29-test library suite and independent FreeLang LRU probes.
2. Investigate the nine chained self-hosting failures and the stage1 equivalence
   failure. Change source only when the root cause is demonstrated; preserve
   compilation semantics and check generated output, not just execution time.
3. Build determinism expects legacy output from a native-proof redirect.
   Changes to tests/runners are prohibited, so do not hide this with fake output.
   L2 fails to link case-05-functions because the native parser replaces an
   expression in callee position with `unknown`. Preserve that AST: the existing
   `cgc-sexpr` already lowers expression callees via `cgc-fncall`.
4. Compare all assertion names against the baseline after changes. Stop after
   three unsuccessful fixes for the same problem and retain the evidence.

LRU diagnosis: `cache-create` stores `max`, but neither write path checks it.
Successful reads do not record access ordering. Implement a per-cache logical
clock and entry access sequence so eviction is independent of wall-clock ties.

## Demonstrated runtime defects

- `src/interpreter.ts`, `evalSExpr`: the dispatch adapter invocation was inside
  the resolution fallback catch. A resolved function throwing an error was
  executed again by the legacy path. An independent counter probe changed from
  `ERROR_CALL_COUNT=2` to `ERROR_CALL_COUNT=1` after moving invocation outside
  that catch. This prevents duplicate side effects as well as repeated work.
- Removing that retry exposed an existing adapter error:
  `src/adapter-builtin-to-funcdef.ts` imported nonexistent `_enforceEffect` from
  `effect-enforcer`. Use the actual `enforceCall` API with the function name,
  effects and source span; do not suppress effect errors.
- `src/eval-call-function.ts`: `MAX_TCO_ITERATIONS=10` rejected an ordinary
  20-step recursive countdown. Use the existing 5,000 call-depth safety budget
  for tail-call iterations too, and report the actual bound in the exception.
  The countdown now returns zero; the existing errors suite still terminates
  and passes. No Jest timeout was changed.
- Four constant dispatch Sets in `evalSExpr` are now allocated once at module
  scope, with unchanged members. This removes repeated allocations but is not
  by itself evidence that self-compilation meets the 60-second test limit.

## Local evidence

- Existing targeted suites: **83 passed / 0 failed** in 70.426 seconds:
  `errors.test.ts` 38, `effect-enforcement-c4-2.test.ts` 7,
  `effect-enforcement-c4-3.test.ts` 9, `stdlib-new.test.ts` 29.
- Independent FreeLang probes: duplicate-call count 1, recursive countdown 0,
  LRU read recency/overwrite/TTL-capacity/delete/clear/zero-capacity pass.
- Modified native compiler source parses successfully (257 top-level forms).
  Native executable verification is deferred to GitHub's x86-64 runner because
  the local runtime is ARM64; syntax parsing alone is not native validation.
- A Sets-only diagnostic reached 10,727 lexer tokens in 100.798 seconds and
  hit the external 180-second watchdog before parsing completed. A prior
  baseline diagnostic also timed out without a completed phase measurement.
  Those runs do not provide a valid before/after speed ratio.

## First integrated verification

Commit `c04d507`, GitHub run `43179332770`:

- Exact assertion-name comparison: **1,421 passed / 11 failed / 0 skipped**,
  1,432 total, with no missing assertions. Three baseline failures passed: LRU,
  stage1 self-compile, and stage1 determinism. One new failure was large-data
  encryption; the other ten failures were already present in the baseline.
- Stage1 self-compile took **11.332 seconds**; its deterministic rerun took
  **11.319 seconds**, both within the unchanged 60-second limit.
- Native fixed-point, nightly native fixed-point, and let/codegen regressions
  passed. Native L2 progressed beyond case 05, then failed linking case 09:
  `str-upper` lacked the alias to existing `str_to_upper`. Map both upper/lower
  aliases to the existing C runtime implementations; do not add stubs.
- The local equivalent self-compile completed in **146 seconds**, parsed 222
  nodes and wrote 56,455 bytes. However, `node --check` failed on duplicate
  `_p__anon` parameters. Completion and determinism alone do not prove the
  generated compiler is usable. No speed ratio is inferred across machines or
  from the earlier incomplete baseline.
- Non-tail recursion probe `(f 10)` returned **55**.

## Second verification and common scope defect

- An interim change routed `loop` through the generic S-expression branch.
  It removed duplicate parameters in a small probe, but did not address the
  underlying fault: the resulting compiler next failed because `-1` was
  lexed as a Symbol and emitted as `_1`. **The interim parser change was
  reverted. Final `self/all.fl` is identical to the baseline.**
- `src/stdlib-collection.ts`: two duplicate `str-repeat` entries accepted only
  string-first calls, while the encryption test passes `(str-repeat 1000
  "data")`. Previously the dispatch fallback concealed the TypeError by
  returning an empty string. A single implementation accepts both argument
  orders and produces the real repeated input. Existing string-first behavior
  and negative-count clamping are preserved.
- The existing crypto suite then passed **39/39** locally (101.811 seconds
  including Jest overhead; suite-reported time 89.454 seconds).
- Commit `b538ab8`, GitHub run `43180690175`: **1,423 passed / 9 failed /
  0 skipped**. Native L2 passed after expression-callee and string-alias fixes.
  The local compile took 136 seconds and produced 55,496 bytes. Syntax checking
  passed, but executing that compiler raised `ReferenceError: _1 is not
  defined`; successful syntax checking alone was insufficient.

The common source defect is in `src/eval-call-function.ts`,
`callUserFunctionTCO`, the non-closure function branch. Unlike ordinary global
function calls, it pushed a parameter frame **on the caller's local stack**.
Dollar-prefixed caller locals could win name lookup over callee parameters.
A minimal probe made the behavior observable:

```clojure
(defn own-c [$c] $c)
(defn caller-c [] (let [[$c "outer"]] (cond [true (own-c "inner")])))
(caller-c)
```

Before the fix this returned `"outer"`, not the argument `"inner"`. The TCO
path now uses the same `resetToGlobalFrame` / `restoreStack` boundary as the
ordinary global-function path. The existing `capturedEnv` closure path remains
unchanged. The probe returns `"inner"`; with the **original compiler source**,
`-1` now has Number tokens and numeric AST nodes, and `loop` emits the correct
binding names. Non-tail recursion still returns 55. This replaces the earlier
parser-only explanation rather than treating it as a second independent fix.

The third integrated verification is the last source-fix cycle in this task;
if it still fails, report the remaining failures rather than trying a fourth
unverified change.

## Final verification

Source commit: `4db85e27ec0d5d7d4476293e66db58053566fae4`.
GitHub workflow run: `43181447980` (`phase-c-full-slack.yml`, manually
dispatched on `fix/t18-runtime-failures`). No Slack webhook was configured;
notification steps were skipped. No Forgejo push was performed.

| Measurement | Baseline | Final |
| --- | ---: | ---: |
| Passed assertions | 1,419 | 1,430 |
| Failed assertions | 13 | 2 |
| Skipped assertions | 0 | 0 |
| Total assertions | 1,432 | 1,432 |
| New failures vs baseline | — | 0 |

Comparison uses each assertion's test filename plus full test name, not just
aggregate counts. The sorted assertion inventories are identical, including
duplicates. Eleven baseline failures are now passing. All ten assertions in
`self-hosting.test.ts` passed, including the native fixed-point harness.

- GitHub stage1 self-compile: **8.303 seconds**; deterministic second build:
  **8.329 seconds**. The existing 60-second timeout was not modified.
- Native fixed-point, native L2, nightly native fixed-point, and let/codegen
  regression checks passed. The overall workflow is still **failure** because
  of the two remaining assertions below; it is not reported as green.
- Local ARM64 self-compile: **135 seconds**, 222 nodes, **56,189 bytes**.
  Therefore the local device has **not** been shown to meet 60 seconds.
- Independently generated stage1 through stage10 all passed `node --check`,
  had the same size, and shared SHA-256:
  `f6e0932faea007d4d95e4f6953d6174d31d94c19dda6f615510537d2b70d38b8`.
  These files were produced by successive compiler executions, not copied
  from a cached result or edited manually. Hello printed `hello`.
- Generated flat/nested loop probes returned 45 and 45; a zero-iteration
  probe returned 3. String repetition produced 4,000 characters for
  `(str-repeat 1000 "data")`, `ababab` for `(str-repeat "ab" 3)`, and an
  empty string for a negative count. Non-tail recursion returned 55.
- Full-suite evidence is the existing **three-shard `test:ci-jest` workflow**,
  not a claim that local `test:full` or a new coverage run was executed.
  Test sources, expectations, timeouts, coverage settings, runners and seeds
  are unchanged. Build outputs are restored rather than committed.

### Remaining failures and stopping point

1. `semantic-preservation.test.ts` —
   `stage1.js: bootstrap과 동등성 검증 (file-delete 버그 수정됨)`.
   Its `compileWithStage1` helper requires `stage1.js` at the repository root.
   The checked-in source/build setup does not provide that root artifact;
   the self-hosting suite correctly builds its compiler in its own temporary
   directory. Do not manufacture an artifact or add test-specific side effects
   to production code to make this assertion pass. Test preparation needs an
   explicitly approved follow-up.
2. `build-determinism.test.ts` —
   `scripts/verify-build-deterministic.sh: 2/2 artifacts identical`.
   The test still expects `Build Deterministic` and `2/2 artifacts identical`,
   but the existing script redirects to native fixed-point verification and
   emits `NATIVE_FIXED_POINT=PASS`. Native verification itself passes.
   Updating the test/runner contract is outside the permitted changes; no
   success strings are faked.

Stop after the third integrated source-fix cycle. No fourth fix or verification
rerun is attempted. The remaining failures are recorded, not skipped or deleted.
The final documentation-only commit follows the verified source commit without
changing its source tree. Generated bundles and temporary diagnostic programs
are not committed.
