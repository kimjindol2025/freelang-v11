# 9-57 앱 시작 결과

기준 브랜치: `v11-x86-seed-public`. 시작 HEAD는 `b8a93036`이다. 시험은 메인 작업 위치에서 실행했다.

## a. Seed 확인

명령 출력 원문:

```text
SEED_BASELINE=36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  bin/cgc-bin-x86_64-seed-v11
CMP=0
```

`git log --oneline dec63e63..HEAD -- bin/cgc-bin-x86_64-seed-v11` 출력은 비어 있었다. 판정: seed 변경 없음.

## b. 앱 시작 실패와 수정

처음 직접 실행한 앱은 2초 뒤에도 살아 있지 않았다. 종료 코드와 신호, 출력 마지막 30줄 구간은 다음과 같다.

```text
APP_ALIVE_AFTER_2S=0
APP_EXIT_RC=1
APP_SIGNAL=0
APP_STDOUT_LAST_30_BEGIN
APP_STDOUT_LAST_30_END
APP_STDERR_LAST_30_BEGIN

✖ HTTP route capacity exceeded or handler is not a function
APP_STDERR_LAST_30_END
```

실패 단계를 분리하기 위해 handler 이름 문자열을 받는 최소 재현 시험을 추가하고, 재현 시험과 기대값을 먼저 `f6af89be`에 커밋했다. 이 시험에서 handler 문자열은 함수가 아니어서 런타임 등록에 실패했다. `self/cgc-main.fl`에서 등록된 함수 이름을 closure로 낮추는 `cgc-route-handler`를 추가한 뒤 해당 재현 시험은 통과했다.

앱은 계속 같은 오류를 냈다. 생성된 앱 C에는 라우트 등록 호출이 141개 있었고 `runtime/http_server.c`의 기존 `HTTP_ROUTE_MAX`는 128이었다. 용량 초과를 재현하는 시험과 기대값을 `a7291d53`에 먼저 커밋한 다음 한도를 256으로 올렸다. 두 회귀 시험 모두 통과했다. DB 코드는 수정하지 않았다.

```text
HANDLER_TEST_RC=0
BACKEND_CASE=task957-server-route-handler COMPILE_RC=0
BACKEND_CASE=task957-server-route-handler GCC_RC=0
BACKEND_CASE=task957-server-route-handler OUTPUT=PASS
BACKEND_CASES_PASSED=1

CAPACITY_TEST_RC=0
BACKEND_CASE=task957-server-route-capacity COMPILE_RC=0
BACKEND_CASE=task957-server-route-capacity GCC_RC=0
BACKEND_CASE=task957-server-route-capacity OUTPUT=PASS
BACKEND_CASES_PASSED=1
```

## c. 앱과 `/ok`

수정된 앱을 실행하고 HTTP 요청 후 종료했다. 앱은 정상적으로 기동했으나 `/ok`의 응답은 HTTP 404였다. 응답 본문 첫 줄과 앱 출력 원문:

```text
APP_LINK_RC=0
CURL_RC=0
OK_HTTP_CODE=404
OK_BODY_FIRST_LINE={"error":"not found"}
APP_EXIT_RC=0
APP_SIGNAL=0
APP_STDOUT_LAST_30_BEGIN
FL-Front v0.1 — http://localhost:40850
HTTP_LISTENING=127.0.0.1:40850
HTTP_SERVER_STOPPED requests=1
APP_STDOUT_LAST_30_END
APP_STDERR_LAST_30_BEGIN
HTTP_LISTEN_BACKLOG=1024
HTTP_MAX_CONN=256
HTTP_WORKER_LIMIT=256
FL_HTTP_WORKERS=0
FL_HTTP_WORKER_MAX_REQ=10000
HTTP_ACTIVE_CONNECTIONS_MAX=1
APP_STDERR_LAST_30_END
```

## d. 전체 시험

시험 직전 프로세스 점검에서 `verify-l08` 등 다른 무거운 시험은 보이지 않았다. 전체 시험은 아래 명령으로 잠금 아래에서 strace 없이 1회 실행했다.

```text
flock -o -w 3600 /tmp/fl-heavy.lock bash tests/run-task949-full-check.sh <가림>
```

`ps -eo pid,ppid,stat,etime,args` 원문 스냅샷은 각각 1043줄(시작), 1048줄(종료)이며 원본 실행 기록을 보존했다. 해당 시점의 실행기 행은 다음과 같다(인수의 작업 경로는 가림).

```text
1716550  131237 Ss         00:00 flock -o -w 3600 /tmp/fl-heavy.lock bash -c set +e; ps ...
1716569 1716550 S          00:00 bash -c set +e; ps ...
1716550  131237 Ss         30:51 flock -o -w 3600 /tmp/fl-heavy.lock bash -c set +e; ps ...
1716569 1716550 S          30:51 bash -c set +e; ps ...
```

전체 결과 원문:

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
TASK942_POOL_RC=0
TASK946_FAST_SUMMARY=1/2
CGC_SYMBOL_SUMMARY=5/5
CGC_SYMBOL_RC=0
ABI_SUMMARY=8/8
TASK920_RC=0
```

전체 집계의 최초 실패 단계는 `FULL_FAST_RC=1`이다. 하위 동시성 시험 원문은 `CONC_SUMMARY=6/8`이며 세부 실패 지표는 다음과 같다.

```text
BULK_RESPONSES=GET_50/50 POST_20/17
MOVE_SUCCESS=3 MOVE_REJECTED=7
CONC_SUMMARY=6/8
```

이후 legacy 부하 집계에서 DB 잠금 지표도 실패했다. DB 코드는 담당 범위 밖이라 손대지 않았다.

```text
LOAD_DATABASE_IS_LOCKED=201
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
TASK942_LEGACY_RC=1
```

pool 결과는 다음과 같다.

```text
LOAD_DATABASE_IS_LOCKED=0
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
POOL_SUMMARY=8/8
TASK942_POOL_RC=0
```

fd-limit은 9-53 판정(시험 환경의 `prlimit --nofile=4:4` 제한으로 fd 한도가 부족함)을 인용한다. 해당 판정은 [9-53 fd-limit 보고서](9-53-fdlimit-gcc.md)에 기록되어 있다. 이번 실행에서는 fd-limit 기대값이나 DB 코드를 변경하지 않았다.

## e. 고정점 및 strace 계약

고정점 원문(경로 가림):

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

strace 실행 계약은 별도로 실행했다. 원문:

```text
STRACE_CONTRACT_RC=0
NODE_EXECUTIONS=0
NPM_EXECUTIONS=0
NPX_EXECUTIONS=0
JS_EXECUTIONS=0
PYTHON_EXECUTIONS=0
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
```

## 수정 위치

- `tests/task944/task957-server-route-handler.fl:1`, `tests/task944/task957-server-route-handler.expected:1`, `tests/run-task944-backend.sh:17` — handler 회귀 시험
- `self/cgc-main.fl:866`, `self/cgc-main.fl:1358` — 문자열 handler를 함수 closure로 변환
- `tests/task944/task957-server-route-capacity.fl:1`, `tests/task944/task957-server-route-capacity.expected:1`, `tests/run-task944-backend.sh:17` — 용량 초과 재현 시험
- `runtime/http_server.c:27` — `HTTP_ROUTE_MAX`를 256으로 변경

수정 커밋: `f6af89be`, `592b1eec`, `a7291d53`, `148399c7`.

## X86_SUMMARY

```text
X86_SUMMARY=4/5
```

앱 시작 오류 수정 및 기동, 응답 수집, seed·고정점·strace 계약은 확인했다. 전체 시험은 동시성 기준 및 legacy DB 잠금 기준에서 실패했으므로 1개 항목은 미통과다.

## 원격 HEAD 및 미확인 항목

보고서 커밋 및 두 원격 push 뒤의 HEAD는 최종 기록한다. 미확인 항목: 전체 시험의 `CONC_SUMMARY=6/8` 원인을 더 좁히지 않았고, legacy DB 잠금 실패는 DB 코드 수정 없이 기록만 했다. `/ok`는 HTTP 404이며 200이 아니다.
