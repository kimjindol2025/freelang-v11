# 9-58 `/ok` 라우트 확인

기준 브랜치: `v11-x86-seed-public`, 시작 HEAD `801edbab`. seed는 변경하지 않았다. 앱 확인은 9-57에서 보존한 동일 generated-C 앱을 사용해 최신 runtime으로 다시 링크했다.

## a. Seed

실행 명령은 `git show dec63e636a2b1225ba88b8d9b9e3a426e129f6f2:bin/cgc-bin-x86_64-seed-v11 | sha256sum`, `sha256sum bin/cgc-bin-x86_64-seed-v11`, `git cat-file -p dec63e63:bin/cgc-bin-x86_64-seed-v11 | cmp - bin/cgc-bin-x86_64-seed-v11`이다. 원문:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  bin/cgc-bin-x86_64-seed-v11
CMP=0
```

판정: seed 변경 없음.

## b. 등록 라우트와 `/ok` 404 원인

실행 시점에 앱이 라우트 목록을 자체 출력하지 않으므로 보존된 동일 앱의 generated C 등록 호출에서 method/path를 추출했다. 아래는 등록 순서 그대로의 전체 원문 목록(142건)이다. `GET /ok`는 없으며 마지막 `GET /*`는 catch-all not-found handler로 등록되어 있다.

```text
ROUTE_COUNT=142
APP_ROUTE_OK=ABSENT
GET /about
GET /api/alerts/stream
GET /api/alerts
GET /api/custom-metrics
GET /api/errors-stats
GET /api/errors
POST /api/errors
GET /api/hello
GET /api/logs/recent
GET /api/metrics/export
GET /api/metrics/filter
GET /api/metrics/stream
GET /api/metrics
POST /api/metrics
GET /api/notes
POST /api/notes
GET /api/playground/eval
POST /api/playground/eval
GET /api/sla/report
GET /api/sla/status
GET /api/sla
GET /app/api-init
GET /app/api
POST /app/api
GET /app
GET /contact/thanks
GET /contact
POST /contact
GET /contacts/api
POST /contacts/api
GET /contacts
GET /contacts/remind
POST /contacts/remind
GET /counter
GET /dashboard/alerts
GET /dashboard/charts
GET /dashboard/custom-metrics
GET /dashboard
GET /dashboard/operations
GET /dashboard/sla
GET /demo
GET /examples/01-hello
GET /examples/02-card-grid
GET /examples/03-list-filter
GET /examples/04-form
POST /examples/04-form
GET /examples/05-form-validate
POST /examples/05-form-validate
GET /examples/06-counter
GET /examples/07-toggle
GET /examples/08-tabs
GET /examples/09-accordion
GET /examples/10-todo
GET /examples/11-live-search
GET /examples/12-star-rating
GET /examples/13-char-count
GET /examples/14-toast
GET /examples/15-modal
GET /examples/16-dropdown
GET /examples/17-wizard
GET /examples/18-slider
GET /examples/19-color-picker
GET /examples/20-password-strength
GET /examples/21-cart
GET /examples/22-temp-convert
GET /examples/23-like-store
GET /examples/24-pagination
GET /examples/25-i18n
GET /examples/26-json-api
GET /examples/27-fetch
GET /examples/28-poll
GET /examples/29-bmi
GET /examples/30-lightbox
GET /examples
GET /feed/api
POST /feed/api
GET /feed
GET /fetch-demo
GET /files/api
POST /files/api
GET /files
GET /flash/api
POST /flash/api
GET /flash
GET /flash/study
POST /flash/study
GET /freelang
GET /goals/api
POST /goals/api
GET /goals
GET /health/api
POST /health/api
GET /health
GET /health/log
GET /
GET /intro
GET /login
POST /login
GET /logout
GET /logs
GET /notes-island
GET /notes
POST /notes
GET /photos/api
GET /photos
GET /playground
GET /reading/api
POST /reading/api
GET /reading
GET /research
POST /research
GET /shop/cart
GET /shop
GET /shop/orders
GET /styled
GET /subs/api
POST /subs/api
GET /subs
GET /tasks
POST /tasks
GET /test-helpers
GET /todo
GET /upload
POST /upload
GET /vault/api
POST /vault/api
GET /vault
GET /api/notes/:id/delete
GET /api/notes/:id/pin
GET /contacts/:id
POST /contacts/:id
GET /flash/:id
POST /flash/:id
GET /goals/:id
POST /goals/:id
GET /reading/:id
POST /reading/:id
GET /shop/orders/:id
GET /shop/products/:id
GET /shop/users/:id
GET /users/:id
GET /*
```

비교 기준 바이너리(수정 전 runtime을 포함한 9-57 보존 앱)의 `/ok` 원문:

```text
BASELINE_OK_HTTP=404
BASELINE_OK_BODY_FIRST_LINE={"error":"not found"}
BASELINE_APP_EXIT_RC=0
```

원인은 경로 비교였다. `http_dispatch`는 method를 `strcmp`로 비교한다. `http_match_path`는 일반 경로 segment의 길이와 `strncmp`가 모두 일치해야 하고, segment 끝도 함께 일치해야 한다. 비교는 대소문자를 구분하고 일반 경로의 앞뒤 `/`를 정규화하지 않는다. 요청 파서는 `?` 뒤를 query 필드로 분리한 뒤 path를 비교한다. 기존 매처는 `*`를 와일드카드가 아니라 글자 그대로 비교했으므로 `/*`가 `/ok`에 맞지 않아 기본 JSON 404가 반환됐다. route 등록은 정상이었고, 누락된 동작은 runtime의 terminal wildcard 매칭이었다.

실패 재현 시험을 먼저 커밋한 뒤 수정했다.

```text
WILDCARD_CASE=/ok HTTP=404 BODY={"error":"not found"}
```

## c. 수정 후 앱 응답

route matcher에서 마지막 segment `*`가 남은 경로 전체를 받도록 수정했다. `/ok`는 등록 라우트가 아니므로 HTTP 404가 맞으며, 이제 catch-all not-found handler의 HTML이 반환된다. 다른 두 명시 경로는 200이었다. 앱은 요청 확인 뒤 정상 종료했다.

```text
APP_LINK_RC=0
APP_ROUTE=/ok HTTP=404 BODY_FIRST_LINE=<!DOCTYPE html><html><head><meta charset='utf-8'><title>404 — 페이지를 찾을 수 없음 — FreeLang Front</title>
APP_ROUTE=/about HTTP=200 BODY_FIRST_LINE=<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>About — FreeLang Front</title><meta name="description" content="npm install 0개로 Next.js 대체. SSR + Island 아키텍처."><meta property="og:title" content="FreeLang Front란?"><meta property="og:description" content="npm install 0개로 Next.js 대체. SSR + Island 아키텍처."><meta property="og:type" content="article"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="FreeLang Front"><meta name="twitter:description" content="npm install 0개로 Next.js 대체. SSR + Island 아키텍처."><style>/* ━━━ OKLCH + Relative Colors + light-dark() 다크모드 ━━━ */
APP_ROUTE=/api/hello HTTP=200 BODY_FIRST_LINE={"ok":true,"message":"Hello from FL-Front API","version":"0.1"}
APP_EXIT_RC=0
APP_SIGNAL=0
```

수정 후 catch-all handler와 모든 명시 경로의 우선 등록 순서는 유지했다. wildcard 회귀 시험:

```text
WILDCARD_CASE=/ok HTTP=200 BODY=WILDCARD_ROUTE_MATCHED
WILDCARD_ROUTE_SUMMARY=1/1
```

## d. 전체 시험과 ps

시험 전 `ps -eo pid,ppid,stat,etime,args`에서 다른 `verify-l08`, `run-task949-full-check`, `run-task942` 무거운 시험은 검색되지 않았다. 전체 시험은 이미 커밋된 집계 스크립트를 다음처럼 잠금 아래 strace 없이 1회 실행했다.

```text
flock -o -w 3600 /tmp/fl-heavy.lock bash tests/run-task949-full-check.sh <가림>
```

시작 전 ps 스냅샷 1050줄, 잠금 안에서 시작 1051줄, 종료 1051줄이다. 사전 필터 출력은 비어 있었고, 잠금 안 ps의 실행기 행 원문(작업 경로 가림):

```text
2880843  131237 Ss         00:00 flock -o -w 3600 /tmp/fl-heavy.lock bash -c ps ...
2880862 2880843 S          00:00 bash -c ps ...
2880843  131237 Ss         30:54 flock -o -w 3600 /tmp/fl-heavy.lock bash -c ps ...
2880862 2880843 S          30:54 bash -c ps ...
```

전체 요약 원문:

```text
FULL_CHECK_RC=1
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
FULL_FAST_RC=1
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
TASK942_LEGACY_RC=1
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
POOL_SUMMARY=8/8
TASK942_POOL_RC=0
TASK946_FAST_SUMMARY=1/2
CGC_SYMBOL_SUMMARY=5/5
CGC_SYMBOL_RC=0
ABI_SUMMARY=8/8
TASK920_RC=0
```

`FULL_FAST_RC=1`의 첫 실패와 `CONC_SUMMARY`에서 실패한 2건의 이름 및 시험 원문:

```text
FAIL 50 reads and 20 creates return all responses
FAIL concurrent creates add exactly twenty SQLite items
BULK_RESPONSES=GET_50/50 POST_20/17
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=17 DELTA=17
CONC_SUMMARY=6/8
```

요청에 따라 DB 코드는 수정하지 않았다. 아래 DB 잠금과 fd-limit은 동시성 실패와 분리해 기록한다.

```text
LOAD_DATABASE_IS_LOCKED=192
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
```

fd-limit 판정은 9-53에서 확인한 시험 환경의 `prlimit --nofile=4:4` 제한 문제다. 이전 근거와 원문은 [9-53 보고서](https://github.com/kimjindol2025/freelang-v11/blob/v11-x86-seed-public/docs/9-53-fdlimit-gcc.md)에 있다. DB 관련 실패는 수정하지 않았다.

## e. 고정점 및 strace 계약

전체 시험이 출력한 고정점 해시(경로 가림):

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

별도 strace 계약은 `strace -f -e trace=execve bash tests/run-cgc-symbol-contract.sh`로 실행했다. 원문 요약:

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
JS_EXECUTIONS=0
PYTHON_EXECUTIONS=0
```

## 수정 위치 및 판정

- [runtime/http_server.c](https://github.com/kimjindol2025/freelang-v11/blob/v11-x86-seed-public/runtime/http_server.c#L972) — 980-981행, terminal `*` 경로 매칭
- [tests/task958/wildcard.fl](https://github.com/kimjindol2025/freelang-v11/blob/v11-x86-seed-public/tests/task958/wildcard.fl#L1) 및 [tests/run-task958-wildcard.sh](https://github.com/kimjindol2025/freelang-v11/blob/v11-x86-seed-public/tests/run-task958-wildcard.sh#L1) — 재현·회귀 시험

커밋: `a6cf9ff5` (실패 재현 시험), `8e849faecc21043e61654a0260a77892f0ea61c2` (runtime 수정).

```text
X86_SUMMARY=4/5
```

Seed, 라우트 원인 분석과 수정, 앱 HTTP 확인, 고정점 및 strace 계약은 확인했다. 전체 시험은 동시성 2건과 legacy DB/fd-limit 결과 때문에 실패했다. 별도의 JS reference app은 실행하지 않았으며, 비교는 동일 앱의 보존된 수정 전 native binary와 수정 후 native runtime 간 결과다.
