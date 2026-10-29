# 9-59 POST 손실 재검증

## 1. 단계별 결과

- a. seed 기준 `5b620b4e`와 현재 파일이 일치하고 `cmp`도 0이다.
- b. 시험의 앱 생존 확인 경로를 `/ok`에서 `/about`으로 변경했다. 시험 기대값은 변경하지 않았다. `/about` 경로가 등록되는 fixture 두 곳에 alias를 추가했다.
- c. 변경 전 동시성 재현은 현행 런타임 3회 모두 HTTP 503 `server busy`로 일부 POST가 거부됐다. 오류 출력에는 DB 잠금 메시지가 없고, 앱이 출력한 worker limit은 16이었다. 현행 및 공개 기준 런타임 모두 동일하게 worker limit 16에서 POST 일부가 503이었다. 이에 DB 코드나 런타임의 요청 처리 코드는 수정하지 않고 ERP 예제의 worker 설정만 128로 조정했다. 변경 후 현행 3회와 기준 런타임 1회 모두 POST 20건 전부 성공했다.
- d. 전체 시험은 종료 코드 1이다. Legacy 경로의 `LOAD_DATABASE_IS_LOCKED=190` 및 `LOAD2_SUMMARY=9/10`가 실패했다. fd-limit은 sqlite=14 오류가 있었고 legacy `FDFIX_SUMMARY=4/5`다. Pool 경로는 DB 잠금 0, `LOAD2_SUMMARY=10/10`, `FDFIX_SUMMARY=5/5`, `POOL_SUMMARY=8/8`로 통과했다. DB 코드는 변경하지 않았다.
- e. stage2=stage3=stage4 해시가 일치하고 cmp 결과는 0이다. strace 계약 실행 결과는 Node/npm/npx/JS/Python 각 0이다.

## 2. 고친 곳 (파일:줄)

- `tests/run-task936-soak.sh:45,127`, `tests/run-task937.sh:46`, `tests/run-task938-load.sh:278,395`, `tests/run-task942-pool.sh:135`: 앱 생존 확인 URL을 `/about`으로 변경.
- `tests/task936/soak-server.fl:33`, `tests/task937/http-server.fl:3`: 시험 fixture에 `/about` alias 추가.
- `examples/erp-vendors/test-concurrency.fl`: 실패 POST의 HTTP 코드와 본문 첫 줄, 앱 stderr 수집 추가. 기존 성공 기대값은 유지.
- `tests/run-task959-concurrency-evidence.sh:1-69`: 현행 3회와 공개 기준 런타임 1회 비교 기록기 추가.
- `examples/erp-vendors/app.fl:339`: `(server-workers 16)`을 `(server-workers 128)`로 변경. 원인으로 확인된 제한 초과 시 503 응답을 줄이기 위한 예제 앱 설정이며 DB/런타임은 수정하지 않았다.

변경 커밋은 `826af7930a7400b14b67794e2c675de61e4efb3a`, `fc72a0f8b4e00556c98f62bfd5529681bb2acf8c`, `ef7241ab96eb17d191c9b013d4c74191ec75b582`, `e8891b31786459c9cb348e5b65d6b724fa0d5374`다. 비교 기록기 실행 전 커밋했고, 실행 중 스크립트는 수정하지 않았다.

## 3. 비교 원문

변경 전 현행 동시성 시험 3회:

```text
CONC_RUN=current/1 RC=0
BULK_RESPONSES=GET_50/50 POST_20/17
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=17 DELTA=17
POST_FAILURE_DETAILS_BEGIN
POST_FAILURE index=18 HTTP=503 BODY_FIRST_LINE={"error":"server busy"}POST_FAILURE index=19 HTTP=503 BODY_FIRST_LINE={"error":"server busy"}POST_FAILURE index=20 HTTP=503 BODY_FIRST_LINE={"error":"server busy"}POST_FAILURE_DETAILS_END
APP_STDERR_BEGIN
HTTP_LISTEN_BACKLOG=1024
HTTP_MAX_CONN=256
HTTP_WORKER_LIMIT=16
FL_HTTP_WORKERS=0
FL_HTTP_WORKER_MAX_REQ=10000
HTTP_ACTIVE_CONNECTIONS_MAX=16
APP_STDERR_END
CONC_SUMMARY=6/8

CONC_RUN=current/2 RC=0
BULK_RESPONSES=GET_50/50 POST_20/18
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=18 DELTA=18
POST_FAILURE_DETAILS_BEGIN
POST_FAILURE index=17 HTTP=503 BODY_FIRST_LINE={"error":"server busy"}POST_FAILURE index=19 HTTP=503 BODY_FIRST_LINE={"error":"server busy"}POST_FAILURE_DETAILS_END
APP_STDERR_BEGIN
HTTP_LISTEN_BACKLOG=1024
HTTP_MAX_CONN=256
HTTP_WORKER_LIMIT=16
FL_HTTP_WORKERS=0
FL_HTTP_WORKER_MAX_REQ=10000
HTTP_ACTIVE_CONNECTIONS_MAX=16
APP_STDERR_END
CONC_SUMMARY=6/8

CONC_RUN=current/3 RC=0
BULK_RESPONSES=GET_50/50 POST_20/17
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=17 DELTA=17
POST_FAILURE_DETAILS_BEGIN
POST_FAILURE index=18 HTTP=503 BODY_FIRST_LINE={"error":"server busy"}POST_FAILURE index=19 HTTP=503 BODY_FIRST_LINE={"error":"server busy"}POST_FAILURE index=20 HTTP=503 BODY_FIRST_LINE={"error":"server busy"}POST_FAILURE_DETAILS_END
APP_STDERR_BEGIN
HTTP_LISTEN_BACKLOG=1024
HTTP_MAX_CONN=256
HTTP_WORKER_LIMIT=16
FL_HTTP_WORKERS=0
FL_HTTP_WORKER_MAX_REQ=10000
HTTP_ACTIVE_CONNECTIONS_MAX=16
APP_STDERR_END
CONC_SUMMARY=6/8

CONC_RUN=baseline/1 RC=0
BULK_RESPONSES=GET_50/50 POST_20/17
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=17 DELTA=17
POST_FAILURE_DETAILS_BEGIN
POST_FAILURE index=15 HTTP=503 BODY_FIRST_LINE={"error":"server busy"}POST_FAILURE index=17 HTTP=503 BODY_FIRST_LINE={"error":"server busy"}POST_FAILURE index=20 HTTP=503 BODY_FIRST_LINE={"error":"server busy"}POST_FAILURE_DETAILS_END
APP_STDERR_BEGIN
HTTP_LISTEN_BACKLOG=1024
HTTP_MAX_CONN=256
HTTP_WORKER_LIMIT=16
FL_HTTP_WORKERS=0
FL_HTTP_WORKER_MAX_REQ=10000
HTTP_ACTIVE_CONNECTIONS_MAX=16
APP_STDERR_END
CONC_SUMMARY=6/8
```

위 네 번 stderr의 비교 명령 결과:

```text
APP_STDERR_CMP_1_2=0
APP_STDERR_CMP_1_3=0
APP_STDERR_CMP_CURRENT_BASELINE=0
```

worker limit 변경 후 현행 3회 및 `5b620b4e` 공개 기준 런타임 1회:

```text
CONC_RUN=current/1 RC=0
BULK_RESPONSES=GET_50/50 POST_20/20
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=20 DELTA=20
POST_FAILURE_DETAILS_BEGIN
POST_FAILURE_DETAILS_END
APP_STDERR_BEGIN
HTTP_LISTEN_BACKLOG=1024
HTTP_MAX_CONN=256
HTTP_WORKER_LIMIT=128
FL_HTTP_WORKERS=0
FL_HTTP_WORKER_MAX_REQ=10000
HTTP_ACTIVE_CONNECTIONS_MAX=18
APP_STDERR_END
CONC_SUMMARY=8/8

CONC_RUN=current/2 RC=0
BULK_RESPONSES=GET_50/50 POST_20/20
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=20 DELTA=20
POST_FAILURE_DETAILS_BEGIN
POST_FAILURE_DETAILS_END
CONC_SUMMARY=8/8

CONC_RUN=current/3 RC=0
BULK_RESPONSES=GET_50/50 POST_20/20
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=20 DELTA=20
POST_FAILURE_DETAILS_BEGIN
POST_FAILURE_DETAILS_END
CONC_SUMMARY=8/8

CONC_RUN=baseline/1 RC=0
BULK_RESPONSES=GET_50/50 POST_20/20
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=20 DELTA=20
POST_FAILURE_DETAILS_BEGIN
POST_FAILURE_DETAILS_END
CONC_SUMMARY=8/8
```

## 4. 전체 시험 및 고정점 원문

전체 시험 잠금 명령:

```text
flock -o -w 3600 /tmp/fl-heavy.lock bash tests/run-task949-full-check.sh <가림>
```

시험 전 프로세스 확인에서 `verify-l08`, `run-task949-full-check`, `run-task942-pool`, `run-task938-load` 항목은 출력되지 않았다. 시험 직전/직후 `ps -eo pid,ppid,stat,etime,args` 원문 기록은 각각 1105행과 1052행이었다. 잠금 외의 동시 무거운 시험은 관찰되지 않았다.

```text
FULL_CHECK_RC=1
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
LOAD_DATABASE_IS_LOCKED=190
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
TASK942_LEGACY_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
POOL_SUMMARY=8/8
TASK942_POOL_RC=0
TASK946_FAST_SUMMARY=1/2
```

전체 실행 고정점 원문(파일명 부분은 경로 가림):

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

## 5. 보조 검증 원문

seed 확인:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  bin/cgc-bin-x86_64-seed-v11
CMP=0
```

strace 계약:

```text
STRACE_CONTRACT_RC=0
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
NODE_EXECUTIONS=0
NPM_EXECUTIONS=0
NPX_EXECUTIONS=0
JS_EXECUTIONS=0
PYTHON_EXECUTIONS=0
```

## 6. X86_SUMMARY

```text
X86_SUMMARY=4/5
```

판정: seed 보존, `/about` 생존 확인, 동시 POST 재현 및 설정 수정, 고정점/strace 항목은 확인했다. 전체 시험은 legacy DB 잠금 190건 및 `TASK946_FAST_SUMMARY=1/2`로 실패해 5/5는 아니다. fd-limit의 sqlite=14도 별도 실패 원문으로 남겼다. DB 코드는 수정하지 않았다.

## 7. 커밋 및 원격 상태

푸시 순서: Forgejo 다음 GitHub. 커밋 및 양쪽 원격 HEAD 원문:

```text
86aa88adb3982bed2acb08f1e0cb6b7c2e23b5c6	refs/heads/v11-x86-seed-public
86aa88adb3982bed2acb08f1e0cb6b7c2e23b5c6	refs/heads/v11-x86-seed-public
```

GitHub 보고서: https://github.com/kimjindol2025/freelang-v11/blob/v11-x86-seed-public/docs/9-59-post-loss.md

미확인 사항: 전체 legacy DB 잠금과 TASK946 한 건 실패의 원인, full check 통과 여부.
