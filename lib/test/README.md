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

Run the native contract supervisor:
`python3 tests/lib-contract/run-test-evidence.py --compiler <native-compiler>`.
