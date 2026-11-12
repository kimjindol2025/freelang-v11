# Self-compile performance closeout

## Status

**Deferred.** The shopping-mall and database work takes priority. This record
closes the current performance-investigation track without changing compiler
source, tests, timeouts, or runners.

## Measurements

| Investigation | Result |
|---|---|
| T-13 self-compile | 474.429 seconds; generated output SHA-256 was identical across the two recorded runs; peak RSS was about 277 MB under the CPU-profiled run. |
| T-15 lexer-only run | 10,772 tokens from `self/all.fl` in 21.481 seconds. |
| T-15 self-compile retry | The same self-compile command did not complete within 15 minutes. |

The approximately eight-minute T-13 result and the 15-minute-or-longer T-15
retry are materially different. Treat the available timing figures as evidence
of an **unstable measurement environment**, not as a reliable before/after
baseline for an optimization claim.

## Bottleneck candidates

| Status | Location | Evidence |
|---|---|---|
| Confirmed | `self/all.fl:60-64`, `self/all.fl:186-194`; `src/eval-builtins.ts:295` | The lexer adds each token with `append`; the runtime implementation copies the existing array. This makes token accumulation repeatedly copy the growing token list. |
| Confirmed | `src/interpreter.ts:1705-1708` | Each S-expression evaluation constructs four dispatch `Set` objects. This is a per-evaluation allocation on the CPU-profiled recursive interpreter path. |
| Likely | `self/all.fl:512-521`, `self/all.fl:600-608`, `self/all.fl:714-895` | Parser and code generator repeatedly use `append` and string accumulator concatenation. Their cost has not been isolated with a stable timing baseline. |

## T-3 tail-call check

The T-3 self-call branch at `src/eval-call-function.ts:146-148` was checked
without source changes. The non-tail-recursive program below returned `55`, as
expected:

```freelang
(defn f [n] (if (= n 0) 0 (+ n (f (- n 1)))))
(f 10)
```

This confirms only the tested result; it is not a broader proof of all
tail-call semantics.

## Resume order

1. Fix the measurement environment first: use the same machine and a known,
   stable background load.
2. Investigate the dispatch-set allocation at `src/interpreter.ts:1705-1708`
   first. It occurs for every evaluated S-expression and therefore has the
   strongest expected impact.
3. Then measure and address the lexer accumulation and parser/code-generator
   accumulation candidates separately.
