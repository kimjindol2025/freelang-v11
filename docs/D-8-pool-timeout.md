# D-8 pool timeout 진단

실행 위치: `<가림>`

## 0. seed 일치

`dec63e63:bin/cgc-bin-x86_64-seed-v11`와 현재 seed 파일을 비교했다.

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  bin/cgc-bin-x86_64-seed-v11
SEED_CMP_RC=0
```

## 1. 원인 측정: workers=16, concurrency=1000, route=ok

세 회차 모두 60초, strace 없이 실행했다. 서버 최대 active 처리 수는 `HTTP_ACTIVE_CONNECTIONS_MAX`; listen 대기열은 `ss`의 `Recv-Q` 샘플로 측정했다.

```text
POOL_RUN=1 CLIENT_RC=0 SERVER_RC=0 LOAD_STAGE stage=947 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.017 requests=2166853 rps=36103.75 p50_ms=27.997 p99_ms=86.378 max_ms=203.231 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2166853,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2166853
HTTP_LISTEN_BACKLOG=1024
HTTP_MAX_CONN=256
HTTP_WORKER_LIMIT=256
FL_HTTP_WORKERS=16
HTTP_WORKER_RESTARTS_TOTAL=208
HTTP_ACTIVE_CONNECTIONS_MAX=16
LISTEN_QUEUE_MAX recv_q_max=0 backlog=974 SAMPLE_COUNT=667

POOL_RUN=2 CLIENT_RC=0 SERVER_RC=0 LOAD_STAGE stage=947 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.016 requests=2153736 rps=35886.22 p50_ms=28.185 p99_ms=86.371 max_ms=193.156 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2153736,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2153736
HTTP_LISTEN_BACKLOG=1024
HTTP_MAX_CONN=256
HTTP_WORKER_LIMIT=256
FL_HTTP_WORKERS=16
HTTP_WORKER_RESTARTS_TOTAL=208
HTTP_ACTIVE_CONNECTIONS_MAX=16
LISTEN_QUEUE_MAX recv_q_max=0 backlog=975 SAMPLE_COUNT=533

POOL_RUN=3 CLIENT_RC=0 SERVER_RC=0 LOAD_STAGE stage=947 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.018 requests=2165031 rps=36072.98 p50_ms=27.662 p99_ms=86.407 max_ms=199.476 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2165031,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2165031
HTTP_LISTEN_BACKLOG=1024
HTTP_MAX_CONN=256
HTTP_WORKER_LIMIT=256
FL_HTTP_WORKERS=16
HTTP_WORKER_RESTARTS_TOTAL=208
HTTP_ACTIVE_CONNECTIONS_MAX=16
LISTEN_QUEUE_MAX recv_q_max=0 backlog=975 SAMPLE_COUNT=534
```

기준 상한과 구현 위치:

| 값 | 위치 | 실행값 |
|---|---|---:|
| 최대 pool worker 상수 `HTTP_MAX_WORKERS` | `runtime/http_server.c:35` | 256 |
| 기본 요청 worker limit | `runtime/http_server.c:57-58` | 256 |
| pool worker 수 환경변수 읽기 (`FL_HTTP_WORKERS`) | `runtime/http_server.c:1227` | 16 |
| pool worker 생성 수 | `runtime/http_server.c:299-303` | 16 |
| 최대 연결 환경변수 기본/범위 | `runtime/http_server.c:1249-1257` | 기본 256 |
| 실제 listen backlog 상수와 `listen` 호출 | `runtime/http_server.c:36, 1269-1270` | 1024 |
| 연결 최대치 비교 | `runtime/http_server.c:118-128` | 256 |

### strace 대조 재현

같은 server/client 조합과 부하를 `strace -f -e trace=execve` 아래에서 추가로 1회 실행했다. 둘 다 strace 대상에 포함됐다.

```text
STRACE_RUN CLIENT_RC=0 SERVER_RC=0 LOAD_STAGE stage=947 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=62.077 requests=19691 rps=317.21 p50_ms=3071.759 p99_ms=5055.960 max_ms=5183.415 errors=15065 error_pct=76.507 connect_refused=0 connect_timeout=74 connect_other=0 io_errors=14991 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=14991 recv_other=0 incomplete_response=0 invalid_status=14991 route_counts=ok:19691,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=0:15065,200:4626
HTTP_LISTEN_BACKLOG=1024
HTTP_MAX_CONN=256
HTTP_WORKER_LIMIT=256
FL_HTTP_WORKERS=16
HTTP_WORKER_RESTARTS_TOTAL=0
HTTP_ACTIVE_CONNECTIONS_MAX=16
STRACE_LISTEN_QUEUE_MAX recv_q_max=0 backlog=1030 samples=106
TRACE_EXECVE_LINES=336
```

판정: strace 없는 3회는 모두 오류 0%, `recv_timeout=0`, `status_503=0`, 샘플된 `Recv-Q` 최대 0이었다. strace 실행에서는 `recv_timeout=14991`, 오류율 `76.507%`, p99 `5055.960ms`였고, active 최대는 16, 샘플된 `Recv-Q`는 0, 503은 0이었다. 관측 구간에 backlog overflow/discard나 256 `HTTP_WORKER_LIMIT`/connection cap에 의한 거절 증거는 없다. 16개 pool worker는 모두 active였지만 요청 오류와 지연은 strace 유무를 따라 달라졌다. **strace 추적 환경에서의 처리 지연**이 원인이다. 대조 시험에서는 client와 server를 함께 추적했으므로 어느 쪽의 추적 비용이 더 큰지는 분리하지 않았다.

이 원인은 계측 환경 효과다. 기대값이나 런타임 코드를 바꾸지 않았다. 환경 영향을 확인한 대조 실행을 먼저 했으나 제품 코드 결함이 재현되지 않아 런타임 수정 커밋은 만들지 않았다.

## 2. legacy `run-task942-all.sh` 3회

| 회차 | `LOAD2_SUMMARY` | `LOAD_RESOURCE_STABLE` | `LOAD_DATABASE_IS_LOCKED` | `FDFIX_SUMMARY` |
|---:|---|---|---|---|
| 1 | `9/10` | `0` | `0` | `4/5` |
| 2 | `9/10` | `0` | `0` | `4/5` |
| 3 | `10/10` | `1` | `0` | `5/5` |

9/10 원문 근거:

```text
trial 1: LOAD_RESOURCE_WARM_BASELINE rss_kb=816392 fd=88
LOAD_RESOURCE_START rss_kb=29092 fd=88
LOAD_RESOURCE_END rss_kb=5936 fd=8
LOAD_RESOURCE_STABLE=0
LOAD2_SUMMARY=9/10

trial 2: LOAD_RESOURCE_WARM_BASELINE rss_kb=812280 fd=18
LOAD_RESOURCE_START rss_kb=6068 fd=18
LOAD_RESOURCE_END rss_kb=6068 fd=8
LOAD_RESOURCE_STABLE=0
LOAD2_SUMMARY=9/10
```

실패 항목은 `LOAD_RESOURCE_STABLE` 검사다. 이는 특정 HTTP 요청 실패가 아니므로 요청 번호·응답 코드·본문 첫 줄은 해당하지 않으며, 실행 원문에도 그런 요청 식별 정보가 없다. 두 회차 모두 DB 잠금 수는 `0`이었다.

## 3. 전체 빠른 시험 1회

실행 위치: `<가림>`. 실행 전 `ps` 결과 `ACTIVE_DB_OR_LOAD_TESTS=0`, `ACTIVE_BUILD_PROCESSES=0`; 실행은 `flock -o <가림>` 및 `strace -f -e trace=execve` 아래였다.

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>/bin/cgc-bin-x86_64-seed-v11
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>/stage2.c
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>/stage3.c
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>/stage4.c
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
FULL_CHECK_RC=1
FULL_FAST_RC=1
LOAD2_SUMMARY=10/10
TASK942_LEGACY_RC=1
TASK942_POOL_RC=2
TASK946_FAST_SUMMARY=0/2
CGC_SYMBOL_SUMMARY=5/5
CGC_SYMBOL_RC=0
ABI_SUMMARY=8/8
TASK920_RC=0
TRACE_EXECVE_LINES=68344
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
NPX_EXEC_COUNT=0
JS_EXEC_COUNT=0
PYTHON_EXEC_COUNT=0
```

전체 시험의 pool 16-worker `/ok` 결과:

```text
POOL_BENCH workers=16 route=ok LOAD_STAGE stage=947 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=61.675 requests=19609 rps=317.94 p50_ms=3071.863 p99_ms=5113.291 max_ms=5182.527 errors=15660 error_pct=79.861 connect_refused=0 connect_timeout=54 connect_other=0 io_errors=15606 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=15606 recv_other=0 incomplete_response=0 invalid_status=15606 route_counts=ok:19609,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=0:15660,200:3949
```

격리 UID 검사와 fd-limit은 환경 실패로 별도 분류하며 성공으로 세지 않는다.

```text
FORKFAIL_SUMMARY=SKIP/9 reason=isolated-uid-or-limit-setup-failed
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
FDFIX_RECOVERY_RC=0 ROWS=1
LOAD2_SUMMARY=10/10
```

fd-limit 분류 근거: `docs/9-53-fdlimit-gcc.md`의 기존 결과는 `FDFIX_CASE=fd-limit RC=1 ERROR=db-exec: unable to open database file (sqlite=14)` 및 `EMFILE_EVENTS=4`를 5회 기록했다. 전체 시험의 종료 실패는 이 환경 항목과 isolated UID skip에서 왔고, DB 잠금 오류는 `0`이었다.

## D8_SUMMARY

```text
D8_SUMMARY=4/4
① seed 비교 일치: PASS
② 원인 증거: strace 대조로 추적 환경 영향 확인, PASS
③ untraced 16-worker /ok 오류율 <1% 3회 연속: 0.000%, 0.000%, 0.000%, PASS
④ 고정점 및 node/npm/npx/JS/Python 실행 수 0: PASS
```

전체 빠른 시험 자체는 `FULL_CHECK_RC=1`로 실패했다. 전체 시험의 격리 UID 검사 skip과 fd-limit 실패는 위처럼 시험 환경 항목으로 별도 기록했다. runtime 코드와 기대값은 수정하지 않았다.

HEAD: `54b19f6467160e61483acf1b0e3f5d9684cb5cb2` (보고서 커밋 및 push 전)
