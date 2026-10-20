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

TASK 9-6 adds Unicode scalar string operations and a FreeLang regex parser/VM.
Load `lib/str/str.fl` or `lib/regex/regex.fl`; module-relative paths are supported
from other working directories. Shared modules are expanded once by lexical
path (symlink identities are not resolved). `lib/unicode/unicode.fl` reuses the
existing `self/stdlib/encoding.fl` implementation.

All new APIs below return `Result<T>`. Counts, widths, match start/end and
indices use Unicode scalar values, not UTF-8 bytes or grapheme clusters.
No normalization is performed. Invalid UTF-8 is rejected. NUL remains unsupported.
Existing built-ins keep their old return contracts when the new module is absent.
When loaded, the new same-named API takes precedence; HTTP/FS internal byte
operations explicitly retain their legacy primitives.

| New API | Arguments → Result value |
|---|---|
| `str-split` | text, separator → list; empty separator splits scalars; preserve trailing empties |
| `str-join` | string list, separator → string |
| `str-trim` | text, `left` / `right` / `both` → Unicode White_Space trimmed string |
| `str-replace` | text, nonempty search, replacement, `all` / `first` → nonoverlapping literal replacement |
| `str-starts?`, `str-ends?`, `str-contains?` | text, needle → boolean |
| `str-index-of` | text, needle → scalar index or -1; empty needle → 0 |
| `str-pad-left`, `str-pad-right` | text, width, nonempty padding → cyclic scalar padding, never truncate |
| `str-repeat` | text, count → string; count/width integer 0..10000 |
| `str-lines` | text → CRLF/CR/LF lines; empty input → []; preserve trailing empty line |
| `str-format` | template, map of strings → literal `{name}` expansion |
| `regex-match?` | pattern, text → any match boolean; use `^...$` for full match |
| `regex-find` | pattern, text → `{start,end,text}` or nil; exclusive end |
| `regex-find-all` | pattern, text → nonoverlapping match list |
| `regex-replace` | pattern, text, literal replacement → replace all |
| `regex-split` | pattern, text → intervening strings, preserve edge empties |
| `regex-find-limit` | pattern, text, limit (integer 1..10000) → find with explicit budget |

String errors: `INVALID_ARGUMENT`, `INVALID_UTF8`, `MISSING_KEY`, `INVALID_FORMAT`.
Format values must be strings; format specifiers and brace escaping are unsupported.

Regex supports literals, `. * + ? | () [a-z] [^...]`, `\d \w \s ^ $`,
`{n}`, `{n,m}`, `{n,}`. Grouping has no capture API. Leftmost start, ordered
alternatives and greedy repetition apply. Dot excludes LF/CR/U+2028/U+2029.
Digit/word classes are ASCII; whitespace uses Unicode White_Space. Empty
matches advance one scalar for the next search, retaining intervening text
in replace/split. Replacement has no backreferences or interpolation.

Lookbehind/lookahead, backreferences, named/noncapturing groups, flags, Unicode
properties and lazy/possessive quantifiers are **unsupported**. Unsupported
constructs return `UNSUPPORTED_SYNTAX`; malformed/duplicate quantifiers may
return `INVALID_PATTERN`. Pattern error positions are scalar indices; inherited
Unicode decoding errors retain their byte position.

Every regex invocation has a shared 10000-transition VM budget across all
search starts and matches, returning `STEP_LIMIT` without partial output on
exhaustion. Parse limits: 256 scalars / 1024 bytes, nesting 32, repetition bound
1000 (`PATTERN_LIMIT`). Input limit: 16384 bytes (`INPUT_LIMIT`). No host regex
engine, JS or new encryption/external component is involved. See
`lib/str/README.md` and `lib/regex/README.md` for examples and exact edge behavior.

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

- 시각의 내부 값 = 유닉스 밀리초 정수(UTC 기준).
- now-ms: 유닉스 밀리초, now-s: 유닉스 초(소수점 버림), now-iso: UTC ISO 문자열(…Z).
- time-format 형식 지정자: YYYY 연, MM 월, DD 일, HH 시(00~23), mm 분, ss 초, SSS 밀리초, Z 시차(+09:00). 그 밖의 글자는 그대로 출력.
- time-parse: ISO 8601(날짜만, 날짜+시각, Z 또는 ±HH:MM 시차). 시차가 없으면 UTC로 본다.
- 시간대: UTC와 고정 시차만. 지역 이름 시간대는 미지원.
- time-add(시각, 수, 단위): 단위는 "s" "m" "h" "d" "month" "year".
  - month/year 덧셈의 월말 규칙: 결과 달에 그 날짜가 없으면 그 달 마지막 날로 맞춘다(1월 31일 + 1달 = 2월 28일 또는 29일).
- time-diff(a, b): a − b, 밀리초 정수(음수 가능).
- weekday(시각): 0=일요일 … 6=토요일, UTC 기준. leap-year?(연): 참/거짓. days-in-month(연, 월).
- duration-format(밀리초, 모양): "ko" → "1시간 2분 3초", "short" → "1h2m3s". 0인 단위는 뺀다.
- stopwatch-start → 시작 값, stopwatch-elapsed(시작 값) → 지난 밀리초 정수.
- 실패 시 code·message·위치 정보를 담은 오류값을 돌려주고, 프로그램이 비정상 종료하지 않을 것.


### 공개 API와 실패 계약

| 함수 | 반환값 |
|---|---|
| `now-ms()` | 유닉스 밀리초 정수, 기존 기본 함수 |
| `now-s()` | 현재 유닉스 초 정수, 소수점 버림 |
| `now-iso()` | UTC `YYYY-MM-DDTHH:mm:ss.SSSZ` 문자열 |
| `time-parse(text)` | Result(UTC 밀리초) |
| `time-format(t, pattern, offsetMinutes)` | Result(문자열) |
| `time-add(t, n, unit)` | Result(밀리초), n은 -1000000000..1000000000 정수 |
| `time-diff(a, b)` | Result(a − b 밀리초), 음수 허용 |
| `weekday(t)` | Result(0=일요일 … 6=토요일), UTC |
| `leap-year?(year)` | Result(참/거짓) |
| `days-in-month(year, month)` | Result(해당 월의 일수) |
| `duration-format(ms, style)` | Result(문자열) |
| `stopwatch-start()` | 현재 밀리초 시작 값 |
| `stopwatch-elapsed(start)` | Result(지난 밀리초 정수) |

Result는 `{"ok" true "value" 값}` 또는
`{"ok" false "error" {"code" 코드 "message" 설명 "position" 0}}`다.
`INVALID_ARGUMENT`는 연산 인자·단위·형식 오류, `INVALID_TIME`은 잘못된 시각·달력 값(시각 타입 오류 포함)이다.
위치는 현재 전체 입력/호출을 뜻하는 0이며 문자별 진단 위치는 제공하지 않는다.
오류 뒤에도 다음 호출을 실행할 수 있다.

파싱 문법: `YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm:ss[.S|.SS|.SSS]`에
선택적으로 `Z` 또는 `±HH:MM`을 붙인다. 시차가 없으면 UTC다.
날짜만 있는 입력에도 시차 접미사를 허용한다. 대문자 T/Z, 고정 폭 날짜·시각만
지원하며 분수 초가 3자리를 넘거나 윤초·잘못된 날짜가 있으면 오류다.

형식 지정자: `YYYY` 연, `MM` 월, `DD` 일, `HH` 시(00~23), `mm` 분,
`ss` 초, `SSS` 밀리초, `Z` 시차(`+09:00`). 다른 글자는 그대로 출력한다.
pattern은 최대 1024바이트다. offsetMinutes=540이면 UTC+09:00이다.

time-add 단위는 `s`, `m`, `h`, `d`, `month`, `year`다.
month/year 덧셈에서 해당 날짜가 없으면 결과 달의 마지막 날로 맞춘다.
예: 2024-01-31 + 1 month = 2024-02-29.
일 덧셈은 86400000밀리초이며 UTC에서 달·해를 넘긴다.

duration-format은 0..253402300799999밀리초를 허용한다. `ko`는
`1시간 2분 3초`, `short`는 `1h2m3s`다. 시간은 24 이상 누적할 수 있다.
0인 단위는 생략하며 모두 0이면 `0초`/`0s`다. 1초 미만은 버린다.

stopwatch는 기존 실시간 시계를 재사용한다. 단조 시계는 아니며 시스템 시계가
뒤로 조정되어 시작 값보다 작아지면 INVALID_TIME을 반환한다.
기존 `self/stdlib/time.fl`의 `now`·`time-diff-ms` 계약은 변경하지 않는다.
같은 공개 이름(now-s)을 정의하므로 두 시간 모듈을 한 파일에 함께 load하지 않는다.


기존 공개 함수 `now`, `time-diff-ms`, `time-elapsed`, `date-parts`, `ts-to-s`, `s-to-ts`, `time-ago`는 `self/stdlib/time.fl`의 기존 계약을 유지한다.
자세한 사용법: [lib/time](../lib/time/README.md).

## ⑧ Modules

| Public function/directive | State | Input → output | Failure |
|---|---|---|---|
| `load` directive | exists | source module path → declarations in current compilation unit | compiler diagnostic with source position |

## ⑨ Test and execution evidence (TASK 9-8)

`load "lib/test/test.fl"` / `load "lib/evidence/evidence.fl"` 경로는 호출
모듈 기준으로 지정한다. assertion·집계·JSON·가림 처리는 FreeLang이 담당한다.

| 함수 | 입력 → 출력 |
|---|---|
| `assert-eq` | expected, actual, name → `{ok:true}` 또는 오류값 |
| `assert-true` | actual, name → 정확히 true일 때만 통과 |
| `assert-error` | code, callback, name → callback의 throw/Result 오류 코드 대조 |
| `test-run` | `[{name,run:callback},…]` → passed, failed, failed-names, failures |
| `test-report` | summary → `PASS n/m` 한 줄과 실패 상세 출력, 전체 통과 0 / 실패 1로 종료 |
| `evidence-run` | command, 문자열 인자 목록 → code, stdout, stderr, signal, duration-ms, command, args |
| `evidence-hash` | path → `{ok:true,value:sha256}` 또는 오류값 |
| `evidence-mask` | value, 민감 문자열 목록 → 중첩 기록을 가림 처리한 값 |
| `evidence-write` | path, record → now-iso timestamp와 가린 record를 JSON 원자 쓰기 |

실패 assertion은 `{ok:false,error:{code,name,expected,actual}}`이다.
빈 시험 목록도 실패다. 각 시험은 별도 자식 프로세스에서 실행하며 throw,
치명 오류·signal·exit·10초 제한·결과 누락을 실패로 집계하고 다음 시험을 계속한다.
자식 메모리 변경은 부모와 공유하지 않으며 파일 등 외부 부작용은 되돌리지 않는다.
결과 전송 한도는 1MiB다. C 추가는 프로세스 격리·종료와 signal 보존에 한정한다.

evidence-run은 셸을 자동으로 끼우지 않고 argv를 전달한다. 인자는 최대 253개다.
없는 실행 파일은 code=127, signal 종료는 code=128+signal이다.
실행 시작 실패는 PROCESS_START, 잘못된 인자는 INVALID_ARGUMENT이다.
출력은 현재 런타임의 텍스트 문자열이며 NUL을 포함한 바이너리 캡처는 지원하지 않는다.
duration-ms는 기존 실시간 시계 차이이며 음수면 0으로 제한한다.
hash는 시스템 sha256sum의 소문자 64자리 값을 그대로 반환하며 실패는 HASH_FAILED다.

가림은 경로·URL·이메일·IP 토큰과 path/account/user 등의 필드를 `<가림>`으로
바꾼다. 일반 문장 속 단독 계정명은 자동 식별할 수 없으므로 민감 문자열 목록으로
지정하거나 account/user 필드로 기록한다. 호스트명도 host 필드로 지정한다.
임의 문자열·키에서 개인정보를 완전 탐지하는 기능은 아니다.
숫자·해시·PASS 3/4 같은 계수는 유지한다. 원본 evidence-run 결과는 자동 가리지
않으므로 외부 보고 전 evidence-mask를 사용한다. evidence-write는 자동 가림 후
9-3 file-write-atomic을 재사용하고 해당 함수의 실패·복구 계약을 유지한다.

## Compatibility and implementation notes

- FreeLang implementations are preferred. `char-from-byte` is the sole C
  addition in area ① because the runtime can read an existing byte but cannot
  construct a one-byte string from an integer.
- Area ③ adds the seven collection operations above. Area ⑦ adds the
  `lib/time/` calendar and formatting API while preserving the legacy module.
- The test suite records supported behavior. An unsupported capability is
  reported as such and is never represented by a passing placeholder test.
