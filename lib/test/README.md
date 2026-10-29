# Test v0.1

Load `lib/test/test.fl` relative to the source module.

```clojure
(load "../../lib/test/test.fl")
(test-report (test-run [
  {"name" "sum" "run" (fn [] (assert-eq 3 (+ 1 2) "sum"))}
  {"name" "boolean" "run" (fn [] (assert-true true "boolean"))}]))
```

`assert-error(code, callback, name)` accepts thrown maps with `code` or
`{ok:false,error:{code:...}}` results. Failures retain name, expected, actual.
Each callback runs in a child process with a 10-second limit and 1MiB result
limit. Exceptions, fatal errors, signals, early exit and missing results fail;
later tests continue. Child memory mutations do not propagate to the parent;
external side effects are not rolled back. An empty suite fails.

`test-run` returns passed, failed, failed-names and failures. `test-report`
prints `PASS n/m`, then failure details, and terminates with 0 or 1.

Run the native FreeLang contract supervisor from the repository root:

```sh
repo_root=$(pwd)
native_compiler=$(realpath bin/cgc-bin) # or another native compiler
runner_work=$(mktemp -d)
"$native_compiler" "$repo_root/tests/lib-contract/run-test-evidence.fl" "$runner_work/runner.c"
gcc -I runtime -o "$runner_work/runner" "$runner_work/runner.c" \
  runtime/core.c runtime/collection.c runtime/io.c runtime/math.c \
  runtime/error.c runtime/process.c runtime/json.c runtime/db.c \
  runtime/http_server.c runtime/cgc-bridge.c -lm -lsqlite3
"$runner_work/runner" --compiler "$native_compiler" --root "$repo_root"
runner_code=$?
rm -r -- "$runner_work"
(exit "$runner_code")
```

The executable accepts `--compiler PATH` and optional `--root PATH`. Without
`--root`, it discovers the repository with `git rev-parse --show-toplevel`;
pass an absolute root when running outside the checkout. Source compilation
and each contract run use a separate temporary working directory. Every
external command has a 60-second timeout (with a five-second kill grace).
The supervisor rejects compiler diagnostics even when compilation exits 0,
checks all three contract outputs/exits through `test-run`, and independently
checks the hash fixture with `sha256sum`. It needs the native compiler, GCC,
SQLite development files and the standard `timeout`, `mktemp`, `realpath`,
`sha256sum`, `sh`, and `rm` utilities; Git is needed only for root discovery.
