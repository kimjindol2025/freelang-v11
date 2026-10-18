# FreeLang Standard Library Contract v1

This document is the public contract for the v11 standard library. A successful
operation returns its value. A fallible operation uses the result shape below;
legacy wrappers are identified explicitly and keep their historical return
behavior until migrated.

```text
Result<T> = {"ok": true, "value": T}
          | {"ok": false, "error": {"code": string,
                                      "message": string,
                                      "position"?: integer}}
```

`position` is a zero-based byte offset unless a function explicitly promises a
Unicode character index. Public names are stable; helper names ending in
`-loop`, `-step`, or `-internal` are internal and may change.

## ① Characters and Unicode

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `char-at` | exists | string, byte index → one-byte string | `nil` for invalid index/type |
| `char-code-at` | exists | string, byte index → integer byte | `nil` for invalid index/type |
| `char-from-byte` | new | integer-valued number 0..255 → `Result<string>` with one byte | `BYTE_RANGE` otherwise; NUL behavior is tested before support is claimed |
| `utf8-encode` | new | Unicode scalar integer → UTF-8 byte string | `Result` with `INVALID_CODEPOINT` or `SURROGATE` |
| `utf8-decode` | new | UTF-8 string → scalar integer list | `Result` with `INVALID_UTF8` and byte position |
| `char-count` | new | UTF-8 string → Unicode scalar count | same `INVALID_UTF8` result |
| `char-slice` | new | UTF-8 string, character start, character end → string | same `INVALID_UTF8` result; out-of-range bounds clamp |
| `unicode-upper`, `unicode-lower` | new | string → case-mapped string | invalid UTF-8 returns `INVALID_UTF8`; v1 maps ASCII and preserves other Unicode scalars |

`\u0000` is unsupported if the runtime's string length stops at NUL. In that
case JSON decoding must return `UNSUPPORTED_NUL`, and this limitation remains
explicit; this contract does not authorize a runtime-wide string representation
rewrite.

## ② JSON

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `json-parse` | replace existing | JSON text → `nil`, boolean, number, string, list, or ordered map | `Result` with `JSON_SYNTAX`, message, and byte position |
| `json-stringify` | replace existing | JSON value → JSON text | `Result` with `JSON_TYPE` for unsupported values |
| `json-get` | replace existing | value, key or key-path list → nested value | `Result` with `JSON_PATH` for a missing/invalid path |
| `json-valid?` | new | text → boolean | malformed JSON is `false`; non-string input is `false` |

Parsing is strict: no trailing data, malformed escapes, invalid numbers, or
unpaired UTF-16 surrogates. Object insertion order is preserved. Escaped NUL
uses the character contract above and is reported as unsupported if the runtime
truncates strings at NUL.

## ③ Collections: lists and maps

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `length`, `get`, `first`, `last`, `rest`, `push`, `pop`, `take`, `drop` | exists | collection and operation arguments → collection/value | existing type behavior (`0`, `nil`, or empty list) |
| `keys`, `values`, `entries`, `has-key?`, `map-set`, `map-delete`, `merge` | exists | map and key/value arguments → list/map/boolean | existing type behavior (`nil`, `false`, or empty map) |

## ④ Files and directories

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `file-read`, `file-write`, `file-append`, `file-exists?`, `file-delete`, `file-copy`, `file-rename`, `file-size`, `file-modified`, `file-mkdir`, `file-rmdir`, `file-list`, `file-is-file?`, `file-is-dir?` | exists | path and optional content/path → string, boolean, integer, or path list | legacy builtins return `nil`/`false` on OS failure |
| `file-read-result`, `file-write-result`, `dir-list-result` | new | same filesystem inputs → `Result` | `IO` with operation and message; paths are not echoed into secrets/logs |

## ⑤ Error handling

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `error-message`, `error-type`, `is-error?`, `error-stack`, `error-cause` | exists | error-like value → string, boolean, or cause | safe defaults (`"unknown error"`, `false`, `""`, `nil`) |
| `result-ok`, `result-error` | new | see ③ | `INVALID_ERROR` |
| `result-map`, `result-bind`, `result-value`, `result-error-value` | new | Result and optional function → Result/value | `Result` with `NOT_RESULT` on invalid input |

## ⑥ Communication: HTTP and process execution

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `http-get`, `http-post`, `http-put`, `http-patch`, `http-delete`, `http-head`, `http-status`, `http-header`, `http-post-json`, `http-put-json` | exists | URL and optional body/header → response text/status/header | legacy HTTP error value |
| `process-run`, `process-run-args`, `process-exec`, `process-exec-args`, `process-spawn`, `process-kill`, `process-exists?`, `process-wait`, `shell-run`, `shell-pipe` | exists | command/arguments/process id → result/output/id/boolean | legacy process error value |
| `http-result`, `process-result` | new | HTTP/process operation result → `Result` | `HTTP` or `PROCESS` error with message |

## ⑦ Time

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `now`, `now-ms`, `now-s`, `time-diff-ms`, `time-elapsed`, `date-parts`, `ts-to-s`, `s-to-ts`, `time-ago` | exists | no input or timestamp(s) → number/map/string | invalid timestamps return `nil` or `INVALID_TIME` in result wrappers |
| `time-result` | new | timestamp operation → `Result` | `INVALID_TIME` |

## ⑧ Modules

| Public function/directive | State | Input → output | Failure |
|---|---|---|---|
| `load` directive | exists | source module path → declarations in current compilation unit | compiler diagnostic with source position |
| `module-load`, `module-exports` | new | module path or module value → module map/exports map | `MODULE_NOT_FOUND`, `MODULE_CYCLE`, or `MODULE_EXPORT` in `Result` |

## Compatibility and implementation notes

- FreeLang implementations are preferred. `char-from-byte` is the sole C
  addition in area ① because the runtime can read an existing byte but cannot
  construct a one-byte string from an integer.
- Existing low-level APIs retain their current behavior; the `*-result` APIs
  provide structured failures without silently changing old callers.
- The test suite records supported behavior. An unsupported capability is
  reported as such and is never represented by a passing placeholder test.
