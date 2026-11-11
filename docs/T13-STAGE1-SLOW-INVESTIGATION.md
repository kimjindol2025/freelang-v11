# T-13 stage1 self-compile slow-path investigation

Date: 2026-11-11

## Scope

This investigation starts at `03f705d`.  It does not change the 60 second
test timeout, test sources, the seed, or the runner.

## Unbounded baseline

Command:

```text
node --stack-size=65536 bootstrap.js run self/all.fl self/all.fl <output>
```

The command completed in **474.429 seconds** with exit status 0.  It produced
a 9,837-byte output file.  Direct RSS observations while it was running were
about 220--225 MB.  The first wrapper sampled its `timeout` parent rather than
the Node child, so its reported peak is intentionally discarded.

The same command under V8 CPU profiling completed in **737.733 seconds**.
Its actual Node-child peak RSS was **276,812 KB**.  The profiler changes
runtime materially, so its elapsed time is profiling evidence, not the
baseline performance result.  Both generated outputs had SHA-256:

```text
4053379447bc04159ca70dea0b67dfbfc6e13d9bd08f21e0b77d86015dc8e6ed
```

## CPU sample evidence

V8 was run with a 1 second sample interval so profiling itself remained within
the memory budget.  The 736.628 second sample timeline shows recursive
interpreter dispatch, rather than I/O or a blocked handle, as the hot path.

| Function | Generated source location | Inclusive sample share |
|---|---:|---:|
| `eval` | `bootstrap.js:38900` | 16.14% |
| `evalSExpr` | `bootstrap.js:39054` | 16.09% |
| `evalSpecialForm` | `bootstrap.js:4381` | 12.36% |
| `callUserFunction` | `bootstrap.js:21669` | 6.38% |
| `evalLet` | `bootstrap.js:6008` | 6.25% |

Garbage collection accounts for 6.35% of leaf samples.  Recursive frames mean
these inclusive rows overlap and must not be summed.

## Input-size attempt

Top-level-form-boundary prefixes of `self/all.fl` were built as valid syntax:

| Source size | Definition-load time | Result |
|---|---:|---|
| 14,480 bytes (about 1/4) | 0.478 s | completed |
| 26,853 bytes (about 1/2) | 0.548 s | completed |
| 56,210 bytes (full) | 0.778 s | completed |

Those figures measure parsing and registering definitions only, not the
self-compile work.  Running the 1/4 prefix through the actual compiler path
exceeded 226.908 seconds before it was stopped.  The prefix lacks the later
code-generator definitions, so it follows a different path and cannot be
used to infer a proportional, quadratic, or other growth curve.  No growth
classification is claimed.

## Conclusion

The stage1 timeout is caused by repeated recursive interpreter dispatch while
the bootstrap interpreter evaluates the self-hosted compiler's code-generation
path (`eval` -> `evalSExpr` -> special forms -> user-function calls), with
non-trivial allocation and garbage collection.  It is CPU-bound; it is not an
open-handle wait.

The evidence does not isolate a single small source-level operation that can
be changed without redesigning interpreter dispatch or self-host compiler
execution.  Therefore T-13 makes no source change and does not rerun the full
test suite.
