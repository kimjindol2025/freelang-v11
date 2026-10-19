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
| `char-from-byte` | new | integer-valued number 1..255 → `Result<string>` with one byte | `BYTE_RANGE` otherwise; byte 0 returns `UNSUPPORTED_NUL` |
| `utf8-encode` | new | Unicode scalar integer → `Result<string>` containing UTF-8 bytes | `INVALID_CODEPOINT`, `SURROGATE`, or `UNSUPPORTED_NUL` |
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
| `json-parse` | replace existing | JSON text → `Result<nil, boolean, number, string, list, or ordered map>` | error code, message, and byte position |
| `json-stringify` | replace existing | JSON value → `Result<string>` | `JSON_TYPE`, `JSON_KEY`, or `JSON_UNICODE` |
| `json-get` | replace existing | value, key or key-path list → `Result<value>` | `JSON_PATH` for a missing/invalid path |
| `json-valid?` | new | text → boolean | malformed JSON is `false`; non-string input is `false` |

Parsing is strict: no trailing data, malformed escapes, invalid numbers, or
unpaired UTF-16 surrogates. Object insertion order is preserved. Escaped NUL
uses the character contract above and is reported as unsupported if the runtime
truncates strings at NUL.

## ③ Collections: lists and maps

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `length`, `get`, `first`, `last`, `rest`, `push`, `pop` | exists | collection and operation arguments → collection/value | existing type behavior (`0`, `nil`, or empty list) |
| `keys`, `entries` | exists | map → list | existing type behavior |
| `take`, `drop` | new | integer count, list → list; negative counts clamp to zero | invalid collection → empty list; reuse native-compat wrappers |
| `values` | new | map → values in insertion order | invalid map → empty list |
| `has-key?` | new | map, key → boolean; nil/false values still count as present | invalid map → false |
| `map-set`, `map-delete` | new | map, key[, value] → new map; source is unchanged | invalid map → empty map |
| `merge` | new | left map, right map → new map; right wins, key order retained | invalid operands treated as empty maps |

Load `stdlib/collections.fl` for the seven new public operations. `take` and
`drop` reuse the existing `native-compat.fl` implementations and have separate
contract assertions. Map operations are implemented in FreeLang.

## ④ Files and directories

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `file-read`, `file-write`, `file-append`, `file-exists?`, `file-delete`, `file-copy`, `file-rename`, `file-size`, `file-modified`, `file-mkdir`, `file-rmdir`, `file-list`, `file-is-file?`, `file-is-dir?` | exists | path and optional content/path → string, boolean, integer, or path list | legacy builtins return `nil`/`false` on OS failure |

## ⑤ Error handling

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `error-message`, `error-type`, `is-error?`, `error-stack`, `error-cause` | exists | error-like value → string, boolean, or cause | safe defaults (`"unknown error"`, `false`, `""`, `nil`) |

## ⑥ Communication: HTTP and process execution

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `http-get`, `http-post`, `http-put`, `http-patch`, `http-delete`, `http-head`, `http-status`, `http-header`, `http-post-json`, `http-put-json` | exists | URL and optional body/header → response text/status/header | legacy HTTP error value |
| `process-run`, `process-run-args`, `process-exec`, `process-exec-args`, `process-spawn`, `process-kill`, `process-exists?`, `process-wait`, `shell-run`, `shell-pipe` | exists | command/arguments/process id → result/output/id/boolean | legacy process error value |

## ⑦ Time

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `now`, `now-ms`, `now-s`, `time-diff-ms`, `time-elapsed`, `date-parts`, `ts-to-s`, `s-to-ts`, `time-ago` | exists | no input or timestamp(s) → number/map/string | invalid timestamps return `nil` or `INVALID_TIME` in result wrappers |

## ⑧ Modules

| Public function/directive | State | Input → output | Failure |
|---|---|---|---|
| `load` directive | exists | source module path → declarations in current compilation unit | compiler diagnostic with source position |

## Compatibility and implementation notes

- FreeLang implementations are preferred. `char-from-byte` is the sole C
  addition in area ① because the runtime can read an existing byte but cannot
  construct a one-byte string from an integer.
- Area ③ adds the seven collection operations above; areas ④–⑧ document
  existing public functions.
- The test suite records supported behavior. An unsupported capability is
  reported as such and is never represented by a passing placeholder test.
