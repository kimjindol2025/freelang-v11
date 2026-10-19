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
| `file-read`, `file-write`, `file-append`, `file-exists?`, `file-delete`, `file-copy`, `file-rename`, `file-size`, `file-modified`, `file-mkdir`, `file-rmdir`, `file-list`, `file-is-file?`, `file-is-dir?` | exists | path and optional content/path → string, boolean, integer, or path list | legacy OS failures use `nil`, `false`, `-1`, `0`, or empty lists; some operations throw |

The legacy table describes historical wrappers, some of which may throw on
failure. TASK 9-5 adds a checked API by loading `lib/fs/fs.fl`; the two APIs are
separate module choices and must not be loaded together. Existing JSON helpers
`file-json`, `file-json-write`, and `file-lines` are also legacy wrappers; their
native JSON/error behavior was not a checked filesystem contract.

| Public function (`lib/fs/fs.fl`) | State | Success value inside `Result` | Failure |
|---|---|---|---|
| `file-read`, `file-write`, `file-append`, `file-exists?`, `file-size` | checked variants reusing public names | string, true, boolean, bytes | `{ok:false,error:{code,message,path}}` |
| `file-read-lines`, `file-write-atomic` | new | line list, true | same checked error |
| `dir-list`, `dir-walk`, `dir-make`, `dir-remove` | new checked folder API | immediate names, descendant paths, true, true | same checked error; remove requires empty directory |
| `path-join`, `path-base`, `path-dir`, `path-ext`, `path-normalize` | new | normalized path/component/suffix | `INVALID_PATH` or `PATH_ESCAPE`, with message/path |
| `file-mtime` | new | Unix epoch milliseconds | checked OS error |
| `file-read-json`, `file-write-json` | new | JSON value, true | existing JSON error plus path, or checked I/O error |

Missing before TASK 9-5: reliable code/message/path errors, atomic writes,
recursive mkdir/walk, lexical path helpers, and checked line/JSON convenience
functions. Existing native `dir-list` can throw and is preserved when the new
module is not loaded. Low-level OS operations use a private checked primitive;
FreeLang owns path processing, recursion, line splitting and JSON composition.
`lib/json/json.fl` is the module entry for the existing FreeLang JSON code.

`path-normalize` rejects leading `..` above the lexical root. Normalize an
untrusted relative path before joining it to a trusted base. This is not symlink
confinement. `dir-walk` includes directories and symlinks but does not descend
into symlinks (maximum directory depth 128). `dir-list`/walk preserve OS order.
Atomic writes use same-directory mkstemp/write/fsync/close/rename, returning an
error on every checked failure, then attempt to clean up the private temporary
file. Destination visibility is atomic; power-loss durability is not promised.
New/replaced atomic files have mode 0600. No recursive deletion is provided.
See [full API contract](../lib/fs/README.md).

## ⑤ Error handling

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `error-message`, `error-type`, `is-error?`, `error-stack`, `error-cause` | exists | error-like value → string, boolean, or cause | safe defaults (`"unknown error"`, `false`, `""`, `nil`) |

## ⑥ Communication: HTTP and process execution

| Public function | State | Input → output | Failure |
|---|---|---|---|
| `http-get`, `http-post`, `http-request`, `http-json` (`lib/http/http.fl`) | new in TASK 9-4 | URL/method/header/body/options → `{ok,status,headers,body}`; JSON body is decoded with FreeLang JSON | `{ok:false,error:{code,message}}`; JSON errors retain the JSON contract |
| Other wrappers in `self/stdlib/http.fl` | legacy, not the v0.1 native client | historical builtin wrappers; not validated as native v0.1 APIs | legacy behavior |
| `process-run`, `process-run-args`, `process-exec`, `process-exec-args`, `process-spawn`, `process-kill`, `process-exists?`, `process-wait`, `shell-run`, `shell-pipe` | exists | command/arguments/process id → result/output/id/boolean | legacy process error value |

HTTP v0.1: **HTTPS 미지원**. Default deadline is 5000 ms, including DNS,
connect, send and receive. Request and response limits default to 1048576 bytes
each, including headers. Options `timeout-ms` (1–60000), `max-request-bytes`
and `max-response-bytes` (1–16777216) are integers. 404/500 are responses with
`ok=false`, preserving status/headers/body. Redirects, IPv6, binary NUL and
transfer encodings (including chunked) are unsupported. See
[`lib/http/README.md`](../lib/http/README.md) for signatures and limits.

Native communication research: `runtime/process.c` previously exposed only
unbounded plain-HTTP GET, plus process execution. `runtime/http_server.c` owns
the private POSIX socket/listen/accept/recv/send/close calls for the loopback
server; those are not public FreeLang socket functions. Compiler references to
`fxb-net-*` do not supply a linked implementation in this runtime. There is no
TLS implementation or TLS link dependency. The sole new C primitive
`_fl_http_exchange` supplies bounded raw socket I/O, which FreeLang cannot do;
HTTP and JSON logic remain in FreeLang.

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
