# G-1 x86 merge readiness

## Result

```text
X86_SUMMARY=5/5
```

The x86 checks listed below have no x86-origin failure. The full check still has a legacy DB-lock failure; the same legacy result reproduces on the starting baseline runtime. GitHub's default `master` merge-tree check is clean. Forgejo has a separate `master` tip with five merge conflicts; no merge was performed.

## 1. Seed

Commands and output:

```text
git show dec63e636a2b1225ba88b8d9b9e3a426e129f6f2:bin/cgc-bin-x86_64-seed-v11 | sha256sum
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -

sha256sum bin/cgc-bin-x86_64-seed-v11
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  bin/cgc-bin-x86_64-seed-v11

git cat-file -p dec63e636a2b1225ba88b8d9b9e3a426e129f6f2:bin/cgc-bin-x86_64-seed-v11 | cmp - bin/cgc-bin-x86_64-seed-v11; echo CMP=$?
CMP=0
```

## 2. Fixed point

Current-HEAD full-check output, path components masked:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

## 3. strace contract

Command:

```text
flock -o -w 3600 /tmp/fl-heavy.lock strace -f -e trace=execve -o <가림> bash tests/run-cgc-symbol-contract.sh
```

Output:

```text
STRACE_CONTRACT_RC=0
PASS slash names and punctuation separation
PASS C symbol collision rejected
PASS invalid generated C rejected
PASS when, ??, and empty? native lowering
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
NODE_EXECUTIONS=0
NPM_EXECUTIONS=0
NPX_EXECUTIONS=0
PYTHON_EXECUTIONS=0
JS_EXECUTIONS=0
```

## 4. Full check and failure classification

Before the heavy full check:

```text
ps -eo pid,ppid,stat,etime,args
OTHER_HEAVY_FOUND=0
```

The saved pre-run `ps` output is retained. Command:

```text
flock -o -w 3600 /tmp/fl-heavy.lock bash tests/run-task949-full-check.sh <가림>
```

Current-HEAD aggregate output:

```text
G1_FULL_CHECK_RC=1
FULL_FAST_RC=1
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
TASK942_LEGACY_RC=1
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
POOL_SUMMARY=8/8
TASK942_POOL_RC=0
TASK946_FAST_SUMMARY=1/2
CGC_SYMBOL_SUMMARY=5/5
TASK920_RC=0
```

Failure table:

| Failed item | Classification | Raw evidence |
|---|---|---|
| `TASK942_LEGACY_RC=1` | DB cause | `LOAD_DATABASE_IS_LOCKED=195`; server log: `db-exec: database is locked (sqlite=5)` |
| `LOAD2_SUMMARY=9/10` | DB cause | `LOAD_DATABASE_IS_LOCKED=195` |
| `FDFIX_SUMMARY=4/5` | DB cause, dependent aggregate | `FDFIX_SUMMARY=4/5` with legacy `LOAD2_SUMMARY=9/10`; pool reaches `FDFIX_SUMMARY=5/5` |
| `TASK946_FAST_SUMMARY=1/2` | DB cause, legacy result propagation | `TASK942_LEGACY_RC=1` and `TASK942_POOL_RC=0` |
| `FULL_FAST_RC=1`, `G1_FULL_CHECK_RC=1` | DB cause, aggregate propagation | `TASK946_FAST_SUMMARY=1/2` |
| fd-limit negative case, not a failed expectation | Test environment | `FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)`; `FDFIX_RECOVERY_RC=0 ROWS=1` |

Baseline comparison used the same legacy load entry point from the starting runtime snapshot `5b620b4ee4f2232da44cc4a88c68879257b34036`, with the current stage2 compiler. `runtime/` has not changed since that baseline (`RUNTIME_DIFF_RC=0`).

```text
BASELINE_LOAD_RC=1
LOAD_FAST_SUITE_RC=1
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
FDFIX_RECOVERY_RC=0 ROWS=1
LOAD_DATABASE_IS_LOCKED=178
LOAD2_SUMMARY=9/10
```

The matching legacy DB-lock result is `9/10` on both runtimes (`195` current and `178` baseline lock messages). The baseline's separate `LOAD_FAST_SUITE_RC=1` did not occur in the current run (`LOAD_FAST_SUITE_RC=0`) and is not the matched load2 failure. No DB code was changed. No x86 cause was found: `CGC_SYMBOL_SUMMARY=5/5`, `TASK920_RC=0`, fixed-point outputs match, and the DB-lock result reproduces on the baseline.

## 5. App route and one-fix log

The 128-worker setting remains at `examples/erp-vendors/app.fl:340`.

The committed regression ran before the route change:

```text
APP_START=PASS
ABOUT_HTTP=404
ABOUT_BODY_FIRST_LINE={"error":"not found"}ABOUT_TEST_RC=1
```

Change log:

| Commit | Change and reason | Result |
|---|---|---|
| `bed128ce16dbbe39946947315af13ecdd8a09fe9` | Added `tests/run-g1-app-about.sh` first to reproduce the missing public liveness route. | `ABOUT_HTTP=404` |
| `7a45c1c1fcca4388c863a8b09fddbe63f9fbbca3` | Added a static `/about` route at `examples/erp-vendors/app.fl:329`; it was absent from the ERP app route table. Kept worker limit 128. | `APP_START=PASS`, `ABOUT_HTTP=200` |

Post-fix app output:

```text
APP_START=PASS
ABOUT_HTTP=200
ABOUT_BODY_FIRST_LINE=<!doctype html>
```

Current-HEAD full check's ERP concurrency output:

```text
CONC_SUMMARY=8/8
```

## 6. Pre-merge inspection

GitHub repository default branch is `master`; no `main` ref exists. No merge was run.

```text
GITHUB_MERGE_TREE_RC=0
FORGEJO_MERGE_TREE_RC=1
CONFLICT (content): Merge conflict in .gitignore
CONFLICT (content): Merge conflict in README.md
CONFLICT (add/add): Merge conflict in bootstrap.js
CONFLICT (content): Merge conflict in runtime/cgc-bridge.c
CONFLICT (content): Merge conflict in src/interpreter.ts
```

GitHub `master` is the target default branch and merges cleanly with this branch. Forgejo's separate `master` has the five conflicts listed above; it was only inspected. The full `git diff --name-status origin/master...HEAD` file list follows.

### GitHub master to x86 branch: changed-file list

```text
M	.github/workflows/phase-c-full-slack.yml
M	.github/workflows/phase-c-full.yml
M	.github/workflows/phase-c-scan.yml
M	.gitignore
M	Makefile
M	README.md
A	bin/cgc-bin-x86_64-seed-v11
A	docs/9-42-worker-pool.md
A	docs/9-43-pool-perf.md
A	docs/9-44-x86-backend.md
A	docs/9-45-x86-runtime.md
A	docs/9-46-x86-runtime.md
A	docs/9-47-x86-regress.md
A	docs/9-48-x86-pool.md
A	docs/9-49-app-gcc.md
A	docs/9-50-app-externs.md
A	docs/9-51-app-source.md
A	docs/9-52-full-pass.md
A	docs/9-53-fdlimit-gcc.md
A	docs/9-54-symbol-init.md
A	docs/9-55-recount.md
A	docs/9-56-gcc-zero.md
A	docs/9-57-app-start.md
A	docs/9-58-ok-route.md
A	docs/9-59-post-loss.md
A	docs/9-60-task946.md
A	docs/DB_CONTRACT.md
A	docs/FIXPOINT_LOG.md
A	docs/HTTP_SERVER_NATIVE.md
A	docs/HTTP_WORKERS.md
A	docs/RUN_PARALLEL.md
M	docs/SECURITY.md
A	docs/STDLIB_CONTRACT.md
M	docs/STDLIB_REFERENCE.md
A	docs/V11_COMPLETE.md
M	examples/backend-proof/app.fl
A	examples/erp-vendors/app.fl
A	examples/erp-vendors/create-user.fl
A	examples/erp-vendors/test-auth-helper.fl
A	examples/erp-vendors/test-auth.fl
A	examples/erp-vendors/test-concurrency.fl
A	examples/erp-vendors/test-observe.fl
A	examples/erp-vendors/test-observe.sh
A	examples/erp-vendors/test-pages.sh
A	examples/erp-vendors/test-soak.fl
A	examples/erp-vendors/test-soak.sh
A	examples/erp-vendors/test.fl
A	examples/erp-vendors/test2.fl
A	examples/erp-vendors/test3.fl
A	examples/static-files.fl
M	freelang.c
R098	scripts/bench.sh	legacy/scripts/bench.sh
R099	scripts/benchmark.sh	legacy/scripts/benchmark.sh
R098	scripts/build-all-c.sh	legacy/scripts/build-all-c.sh
R098	scripts/build-binary.sh	legacy/scripts/build-binary.sh
R097	scripts/build-runtime.sh	legacy/scripts/build-runtime.sh
R098	scripts/build-stage1-final.sh	legacy/scripts/build-stage1-final.sh
R094	scripts/build-standalone.sh	legacy/scripts/build-standalone.sh
R097	scripts/check-ports.sh	legacy/scripts/check-ports.sh
R099	scripts/cron-daily-verify.sh	legacy/scripts/cron-daily-verify.sh
R098	scripts/deploy.sh	legacy/scripts/deploy.sh
R096	scripts/dev.sh	legacy/scripts/dev.sh
R090	scripts/fl-compile.sh	legacy/scripts/fl-compile.sh
R095	scripts/fl-fixpoint.sh	legacy/scripts/fl-fixpoint.sh
R096	scripts/measure-baseline.sh	legacy/scripts/measure-baseline.sh
R098	scripts/rebuild-native-cgc.sh	legacy/scripts/rebuild-native-cgc.sh
R098	scripts/run-jest-shard.sh	legacy/scripts/run-jest-shard.sh
R096	scripts/safe-push.sh	legacy/scripts/safe-push.sh
R094	scripts/scan-for-fl-tokens.sh	legacy/scripts/scan-for-fl-tokens.sh
R098	scripts/self-diff.sh	legacy/scripts/self-diff.sh
R097	scripts/test-l2-fixpoint.sh	legacy/scripts/test-l2-fixpoint.sh
R099	scripts/verify-c7-bootstrap.sh	legacy/scripts/verify-c7-bootstrap.sh
R099	scripts/verify-c8-fixed-point-simple.sh	legacy/scripts/verify-c8-fixed-point-simple.sh
R099	scripts/verify-c8-fixed-point.sh	legacy/scripts/verify-c8-fixed-point.sh
R099	scripts/verify-c9-fuzzing.sh	legacy/scripts/verify-c9-fuzzing.sh
R097	scripts/verify-l3-proof.sh	legacy/scripts/verify-l3-proof.sh
A	legacy/scripts/verify-l4-fixpoint-js.sh
R099	self/all-c.fl	legacy/self/all-c.fl
R096	self/s32-verify.sh	legacy/self/s32-verify.sh
R098	self/test-harness.sh	legacy/self/test-harness.sh
R095	tests/parity/01-app-router-static.sh	legacy/tests/parity/01-app-router-static.sh
R096	tests/parity/02-app-router-dynamic.sh	legacy/tests/parity/02-app-router-dynamic.sh
R095	tests/parity/03-layout-children.sh	legacy/tests/parity/03-layout-children.sh
R096	tests/parity/04-not-found.sh	legacy/tests/parity/04-not-found.sh
R097	tests/parity/05-ssg.sh	legacy/tests/parity/05-ssg.sh
R096	tests/parity/06-parallel-render.sh	legacy/tests/parity/06-parallel-render.sh
R095	tests/parity/07-markdown.sh	legacy/tests/parity/07-markdown.sh
R096	tests/parity/08-rss-atom.sh	legacy/tests/parity/08-rss-atom.sh
R097	tests/parity/09-sitemap-robots.sh	legacy/tests/parity/09-sitemap-robots.sh
R095	tests/parity/10-jsonld.sh	legacy/tests/parity/10-jsonld.sh
R097	tests/parity/11-blog-helpers.sh	legacy/tests/parity/11-blog-helpers.sh
R097	tests/parity/12-api-routes.sh	legacy/tests/parity/12-api-routes.sh
R097	tests/parity/_lib.sh	legacy/tests/parity/_lib.sh
R098	tests/parity/run-all.sh	legacy/tests/parity/run-all.sh
R094	tests/parity/score.sh	legacy/tests/parity/score.sh
R097	tests/property-testing.sh	legacy/tests/property-testing.sh
R098	tests/test-security-c2-path.sh	legacy/tests/test-security-c2-path.sh
A	lib/db/db.fl
A	lib/db/sqlite-store-compat.fl
A	lib/evidence/README.md
A	lib/evidence/evidence.fl
A	lib/fs/README.md
A	lib/fs/fs.fl
A	lib/http/README.md
A	lib/http/http.fl
A	lib/json/json.fl
A	lib/regex/README.md
A	lib/regex/regex.fl
A	lib/str/README.md
A	lib/str/str.fl
A	lib/test/README.md
A	lib/test/test.fl
A	lib/time/README.md
A	lib/time/time.fl
A	lib/unicode/unicode.fl
M	package.json
A	runtime/auth.c
M	runtime/cgc-bridge.c
M	runtime/collection.c
M	runtime/core.c
A	runtime/db.c
M	runtime/error.c
A	runtime/fs_io.inc
A	runtime/http_server.c
A	runtime/http_transport.inc
M	runtime/io.c
M	runtime/json.c
M	runtime/math.c
M	runtime/process.c
M	runtime/runtime.h
M	scripts/build-general-program.sh
M	scripts/build-stage1.sh
M	scripts/ci-run-check.sh
D	scripts/ci-write-result.js
A	scripts/ci-write-result.sh
M	scripts/fl-repl.sh
M	scripts/fl-run.sh
M	scripts/fl-serve.sh
A	scripts/rebuild-task951-app-source.sh
A	scripts/recount-task955-app-gcc.sh
M	scripts/verify-all.sh
M	scripts/verify-build-deterministic.sh
M	scripts/verify-fixed-point-deep.sh
M	scripts/verify-fixed-point.sh
M	scripts/verify-l2-proof.sh
M	scripts/verify-l4-fixpoint.sh
A	scripts/verify-native-fixed-point.sh
M	scripts/verify-self-host.sh
M	self/cgc-main.fl
M	self/stdlib/encoding.fl
M	self/stdlib/file.fl
M	self/stdlib/json.fl
M	src/__tests__/self-hosting.test.ts
A	stdlib/collections.fl
A	stdlib/native-compat.fl
A	tests/cgc-invalid-c.fl
A	tests/cgc-native-forms.fl
A	tests/cgc-symbol-collision.fl
A	tests/cgc-symbols.fl
A	tests/fuzz-crashers/README.md
A	tests/fuzz-crashers/compiler-first.fl
A	tests/fuzz-crashers/json-0001.bin
A	tests/fuzz-crashers/json-0002.bin
A	tests/fuzz-crashers/json-0003.bin
A	tests/fuzz-crashers/json-0005.bin
A	tests/fuzz-crashers/json-0006.bin
A	tests/fuzz-crashers/json-0007.bin
A	tests/fuzz-crashers/json-0008.bin
A	tests/fuzz-crashers/json-0009.bin
A	tests/fuzz-crashers/json-0012.bin
A	tests/fuzz-crashers/json-0050.bin
A	tests/fuzz-crashers/json-0081.bin
A	tests/fuzz-crashers/json-0148.bin
A	tests/fuzz-crashers/json-0172.bin
A	tests/fuzz-crashers/json-0197.bin
A	tests/fuzz-crashers/json-0226.bin
A	tests/fuzz-crashers/json-0294.bin
A	tests/fuzz-crashers/json-depth-10000.json
M	tests/integration/backend-proof.sh
A	tests/lib-contract/collections.test.fl
A	tests/lib-contract/communication.test.fl
A	tests/lib-contract/errors.test.fl
A	tests/lib-contract/files.test.fl
A	tests/lib-contract/fs-atomic-failure.test.fl
A	tests/lib-contract/fs.test.fl
A	tests/lib-contract/http-server.fl
A	tests/lib-contract/http.test.fl
A	tests/lib-contract/modules.test.fl
A	tests/lib-contract/regex.test.fl
A	tests/lib-contract/run-fs.fl
A	tests/lib-contract/run-http.fl
A	tests/lib-contract/run-str-regex.fl
A	tests/lib-contract/run-test-evidence.fl
A	tests/lib-contract/run-time.fl
A	tests/lib-contract/str-integration.test.fl
A	tests/lib-contract/str-legacy.test.fl
A	tests/lib-contract/str.test.fl
A	tests/lib-contract/tcp-accept.test.fl
A	tests/lib-contract/tcp.test.fl
A	tests/lib-contract/test-evidence.test.fl
A	tests/lib-contract/test-report-fail.test.fl
A	tests/lib-contract/test-report-pass.test.fl
A	tests/lib-contract/time-legacy.test.fl
A	tests/lib-contract/time-library.test.fl
A	tests/lib-contract/time.test.fl
A	tests/lib-json/json-large.test.fl
A	tests/lib-json/json.test.fl
A	tests/lib/unicode.test.fl
A	tests/run-cgc-builtin-abi.sh
A	tests/run-cgc-symbol-contract.sh
A	tests/run-g1-app-about.sh
A	tests/run-task920.sh
A	tests/run-task926.sh
A	tests/run-task931.sh
A	tests/run-task934.sh
A	tests/run-task935.sh
A	tests/run-task936-soak.sh
A	tests/run-task937.sh
A	tests/run-task938-load.sh
A	tests/run-task942-all.sh
A	tests/run-task942-pool.sh
A	tests/run-task943-perf.sh
A	tests/run-task944-backend.sh
A	tests/run-task944-worker16-ok.sh
A	tests/run-task945-runtime.sh
A	tests/run-task946-full.sh
A	tests/run-task946-helpers.sh
A	tests/run-task948-pool-matrix.sh
A	tests/run-task949-full-check.sh
A	tests/run-task949-pool-matrix.sh
A	tests/run-task958-wildcard.sh
A	tests/run-task959-concurrency-evidence.sh
M	tests/runners/run-e2e.sh
M	tests/runners/run-unit.sh
A	tests/task920/function-parameter.fl
A	tests/task920/let-local.fl
A	tests/task920/loop-binding.fl
A	tests/task920/undefined-name.fl
A	tests/task922/auth-constant-time-equal.fl
A	tests/task922/auth-pbkdf2.fl
A	tests/task922/auth-random-token.fl
A	tests/task922/tcp-accept.fl
A	tests/task922/tcp-bind.fl
A	tests/task922/tcp-close.fl
A	tests/task922/tcp-listen.fl
A	tests/task922/tcp-local-port.fl
A	tests/task922/vec-push.fl
A	tests/task923/abi-hold.tsv
A	tests/task923/abi-lowered.tsv
A	tests/task923/dissoc.fl
A	tests/task923/drop.fl
A	tests/task923/entries.fl
A	tests/task923/float-p.fl
A	tests/task923/obj-values.fl
A	tests/task923/str-to-lower.fl
A	tests/task923/take.fl
A	tests/task923/vals.fl
A	tests/task924/builtins.fl
A	tests/task924/held-auth.fl
A	tests/task925/hof.fl
A	tests/task925/repeat-million.fl
A	tests/task925/str-repeat-0.fl
A	tests/task925/str-repeat-million.fl
A	tests/task925/str-repeat-negative.fl
A	tests/task926/guard.fl
A	tests/task926/net-client.fl
A	tests/task926/net-server.fl
A	tests/task927/hash-once.fl
A	tests/task927/password.fl
A	tests/task928/jwt.fl
A	tests/task928/rfc7515-vector.c
A	tests/task929/chunk-server.c
A	tests/task929/jsonnum.fl
A	tests/task929/stream.fl
A	tests/task930/parallel.fl
A	tests/task931/disk.fl
A	tests/task931/memory.fl
A	tests/task931/parallel.fl
A	tests/task931/server.fl
A	tests/task932/forkfail.fl
A	tests/task934/http-attack-client.c
A	tests/task934/http-attack-server.fl
A	tests/task934/http-attack.fl
A	tests/task935/static-client.c
A	tests/task935/timeout-client.c
A	tests/task935/timeout-server.fl
A	tests/task936/soak-server.fl
A	tests/task937/compiler-fuzz.c
A	tests/task937/http-fuzz-client.c
A	tests/task937/http-server.fl
A	tests/task937/runtime-fuzz.c
A	tests/task938/load-client.c
A	tests/task944/closure-call.expected
A	tests/task944/closure-call.fl
A	tests/task944/destructured-lambda.expected
A	tests/task944/destructured-lambda.fl
A	tests/task944/dollar-function.expected
A	tests/task944/dollar-function.fl
A	tests/task944/dollar-global-function.expected
A	tests/task944/dollar-global-function.fl
A	tests/task944/dollar-lambda-param.expected
A	tests/task944/dollar-lambda-param.fl
A	tests/task944/dollar-param.expected
A	tests/task944/dollar-param.fl
A	tests/task944/duplicate-defn.expected
A	tests/task944/duplicate-defn.fl
A	tests/task944/env-alias.expected
A	tests/task944/env-alias.fl
A	tests/task944/float.expected
A	tests/task944/float.fl
A	tests/task944/global-function-value.expected
A	tests/task944/global-function-value.fl
A	tests/task944/global-function.expected
A	tests/task944/global-function.fl
A	tests/task944/h-short.expected
A	tests/task944/h-short.fl
A	tests/task944/h-varargs.expected
A	tests/task944/h-varargs.fl
A	tests/task944/json-parse-alias.expected
A	tests/task944/json-parse-alias.fl
A	tests/task944/native-time-query-underscore.expected
A	tests/task944/native-time-query-underscore.fl
A	tests/task944/native-time-query.expected
A	tests/task944/native-time-query.fl
A	tests/task944/parse-date.expected
A	tests/task944/parse-date.fl
A	tests/task944/random-int.expected
A	tests/task944/random-int.fl
A	tests/task944/s-varargs.expected
A	tests/task944/s-varargs.fl
A	tests/task944/str-count.expected
A	tests/task944/str-count.fl
A	tests/task944/str-replace-regex.expected
A	tests/task944/str-replace-regex.fl
A	tests/task944/swap-fn.expected
A	tests/task944/swap-fn.fl
A	tests/task944/symbol-collision.expected
A	tests/task944/symbol-collision.fl
A	tests/task944/symbol.expected
A	tests/task944/symbol.fl
A	tests/task944/task956-db-default-params.expected
A	tests/task944/task956-db-default-params.fl
A	tests/task944/task956-reduce-callables.expected
A	tests/task944/task956-reduce-callables.fl
A	tests/task944/task956-reduce-max.expected
A	tests/task944/task956-reduce-max.fl
A	tests/task944/task956-validate-calls.expected
A	tests/task944/task956-validate-calls.fl
A	tests/task944/task956-validate-reject.expected
A	tests/task944/task956-validate-reject.fl
A	tests/task944/task957-server-route-capacity.expected
A	tests/task944/task957-server-route-capacity.fl
A	tests/task944/task957-server-route-handler.expected
A	tests/task944/task957-server-route-handler.fl
A	tests/task944/template-global-function.expected
A	tests/task944/template-global-function.fl
A	tests/task944/template.expected
A	tests/task944/template.fl
A	tests/task944/triple-string.expected
A	tests/task944/triple-string.fl
A	tests/task944/try.expected
A	tests/task944/try.fl
A	tests/task944/type-alias.expected
A	tests/task944/type-alias.fl
A	tests/task945/assoc.expected
A	tests/task945/assoc.fl
A	tests/task945/conj.expected
A	tests/task945/conj.fl
A	tests/task945/dissoc.expected
A	tests/task945/dissoc.fl
A	tests/task945/doseq-callback.expected
A	tests/task945/doseq-callback.fl
A	tests/task945/doseq.expected
A	tests/task945/doseq.fl
A	tests/task945/js_keys.expected
A	tests/task945/js_keys.fl
A	tests/task945/json_str.expected
A	tests/task945/json_str.fl
A	tests/task945/min.expected
A	tests/task945/min.fl
A	tests/task945/mod.expected
A	tests/task945/mod.fl
A	tests/task945/quot.expected
A	tests/task945/quot.fl
A	tests/task945/reduce-min.expected
A	tests/task945/reduce-min.fl
A	tests/task945/swap-assoc.expected
A	tests/task945/swap-assoc.fl
A	tests/task945/swap-conj.expected
A	tests/task945/swap-conj.fl
A	tests/task946/crypto-vectors.expected
A	tests/task946/crypto-vectors.fl
A	tests/task946/http-response-helpers.expected
A	tests/task946/http-response-helpers.fl
A	tests/task946/request-helpers.expected
A	tests/task946/request-helpers.fl
A	tests/task948/symbol-hyphen-underscore.expected
A	tests/task948/symbol-hyphen-underscore.fl
A	tests/task950/aes-decrypt.c
A	tests/task950/aes-decrypt.expected
A	tests/task950/aes-encrypt.c
A	tests/task950/aes-encrypt.expected
A	tests/task950/base64-app.c
A	tests/task950/base64-app.expected
A	tests/task950/db-one.c
A	tests/task950/db-one.expected
A	tests/task950/format-date.c
A	tests/task950/format-date.expected
A	tests/task950/hmac-sha256.c
A	tests/task950/hmac-sha256.expected
A	tests/task950/http-get-json.c
A	tests/task950/http-get-json.expected
A	tests/task950/http-head-delete.c
A	tests/task950/http-head-delete.expected
A	tests/task950/http-ok-p.c
A	tests/task950/http-ok-p.expected
A	tests/task950/http-post-form.c
A	tests/task950/http-post-form.expected
A	tests/task950/http-post-json.c
A	tests/task950/http-post-json.expected
A	tests/task950/http-put.c
A	tests/task950/http-put.expected
A	tests/task950/js-keys.c
A	tests/task950/js-keys.expected
A	tests/task950/json-str.c
A	tests/task950/json-str.expected
A	tests/task950/measure-time.c
A	tests/task950/measure-time.expected
A	tests/task950/random-bytes.c
A	tests/task950/random-bytes.expected
A	tests/task950/redirect-cookie.c
A	tests/task950/redirect-cookie.expected
A	tests/task950/run-aes-decrypt.sh
A	tests/task950/run-aes-encrypt.sh
A	tests/task950/run-base64-app.sh
A	tests/task950/run-db-one.sh
A	tests/task950/run-format-date.sh
A	tests/task950/run-hmac-sha256.sh
A	tests/task950/run-http-get-json.sh
A	tests/task950/run-http-head-delete.sh
A	tests/task950/run-http-ok-p.sh
A	tests/task950/run-http-post-form.sh
A	tests/task950/run-http-post-json.sh
A	tests/task950/run-http-put.sh
A	tests/task950/run-js-keys.sh
A	tests/task950/run-json-str.sh
A	tests/task950/run-measure-time.sh
A	tests/task950/run-random-bytes.sh
A	tests/task950/run-redirect-cookie.sh
A	tests/task950/run-scrypt-kdf.sh
A	tests/task950/run-shell-exec-stdout.sh
A	tests/task950/run-shell.sh
A	tests/task950/scrypt-kdf.c
A	tests/task950/scrypt-kdf.expected
A	tests/task950/shell-exec-stdout.c
A	tests/task950/shell-exec-stdout.expected
A	tests/task950/shell.c
A	tests/task950/shell.expected
A	tests/task952/run-style-random.sh
A	tests/task952/style-random.expected
A	tests/task952/style-random.fl
A	tests/task953/fdlimit-five.sh
A	tests/task958/wildcard.fl
M	tests/unit/stdlib/array.test.fl
M	tests/unit/stdlib/map.test.fl
M	tests/unit/stdlib/math.test.fl
M	tests/unit/stdlib/string.test.fl

```
