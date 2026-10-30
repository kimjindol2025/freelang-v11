# 작업자 풀 처리량 원인 분석 (9-43)

## 실행 범위와 측정 방법

실행 위치: 메인

73은 사용자의 지시에 따라 건너뛰었다. 계측·부하 도구 코드는 커밋 `90355760cd50fd38a6873265b554eb44f6974b97`, CPU 분리 스크립트는 `ea143b5e34d694489c82d0f3f31f501bff4ec0e7`, 응답 본문을 다 읽고 종료하도록 한 부하 클라이언트 수정은 `80c4a2d3`에 고정한 후 측정했다. 측정 스크립트는 실행 전에 커밋했고 실행 중에는 고치지 않았다. 시작 때 공유 heavy lock을 획득했고, 서버와 부하 도구를 서로 다른 물리 코어 집합에 고정했다.

```text
PERF_CPU_CORE_SEPARATED=1
```

`pidstat` 평균 부하 도구 CPU 사용량은 35.20%–230.13%였다(100%는 논리 CPU 하나 분량). 성능 수치는 `pidstat`과 부하 클라이언트의 단조 시계 기반 요청 기록으로 얻었다. 호스트 사양과 네트워크 주소는 싣지 않는다.

## 원인 분석

9-42의 16-worker `/ok` 오류율 85.260%는 이번 환경 분리 측정에서 재현되지 않았다. 이번 16-worker `/ok` 오류는 0건이다. 과거 로그에 오류 종류별 원자료가 없어 과거 오류의 정확한 원인은 확인할 수 없다. 이를 부하 도구 또는 환경 간섭으로 보는 설명은 추측이다.

이번 `WORKERS=0` `/ok`는 2,515.44 RPS, 2-worker 풀 `/ok`는 20,739.60 RPS였다. 단일 accept 루프에서 요청마다 fork하는 비용이 주요 원인이라는 설명과 일치한다. 작업자 수를 늘린 풀 `/ok`는 약 20k RPS에서 비슷했고 mixed는 약 3.3k RPS였다. 작업자 수에 따른 처리량 저하는 별도 병목을 시사하지만, 공유 listen 소켓 경합은 계측만으로 입증되지 않아 `SO_REUSEPORT` 변경은 하지 않았다.

풀 mixed 오류는 클라이언트 연결 거부가 아니었다. 서버 로그의 `database is locked` 건수는 workers=2/4/8/16에서 각각 9/26/57/155건이었다. 16-worker mixed 클라이언트 오류는 156건(불완전 응답 151, 수신 시간 초과 5)이었다. 이 가운데 155건은 서버 DB 잠금과 맞아떨어지고, 나머지 1건의 정확한 원인은 미확인이다.

첫 CAP 측정에서는 503 응답이 완전한 상태 줄·Content-Length·본문을 보낸 뒤 클라이언트가 EOF를 추가로 읽다가 reset을 I/O 오류로 중복 집계했다. 원시 응답 본문이 완전한 것을 확인하고 `tests/task938/load-client.c`가 Content-Length만큼 읽으면 응답을 끝내도록 고쳤다. 이 수정 뒤 재측정에서 503과 I/O 오류가 따로 집계됐다. 시험 기대값이나 서버·컴파일러 구현은 바꾸지 않았다.

## 변경 위치

- `runtime/http_server.c:228-279`: 측정 빌드에서 작업자 요청 수, accept 대기 시간, 문맥 전환을 기록한다. `FL_HTTP_PERF_DIAGNOSTICS` 없는 기본 빌드 동작은 바꾸지 않는다.
- `tests/task938/load-client.c:86-103,141-216`: HTTP Content-Length 본문이 완성되면 EOF 대기 없이 읽기를 끝내고 연결 오류 종류를 기록한다.
- `tests/run-task943-perf.sh:1-86`: 서버·부하 클라이언트의 물리 코어를 분리하고 workers 0/2/4/8/16 및 ok/mixed를 각 60초 측정한다.
- 서버 동시성 로직과 컴파일러는 수정하지 않았다.

## 처리량 결과

각 측정은 연결 1000개, 60초다. CPU 사용량은 같은 실행에서 `pidstat Average`로 기록했다.

| workers | 경로 | RPS | p50 ms | p99 ms | 최대 ms | 오류 | 오류율 % | 클라이언트 CPU % |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | ok | 2515.44 | 395.881 | 413.021 | 485.923 | 0 | 0.000 | 41.82 |
| 0 | mixed | 2352.64 | 416.435 | 674.753 | 2762.047 | 96372 | 67.683 | 35.20 |
| 2 | ok | 20739.60 | 46.831 | 86.988 | 162.165 | 0 | 0.000 | 230.13 |
| 2 | mixed | 3357.06 | 292.975 | 427.285 | 2311.521 | 9 | 0.004 | 55.32 |
| 4 | ok | 20136.63 | 47.724 | 88.065 | 164.207 | 0 | 0.000 | 220.73 |
| 4 | mixed | 3371.83 | 291.102 | 455.396 | 2343.720 | 26 | 0.013 | 54.98 |
| 8 | ok | 20786.85 | 45.633 | 80.168 | 234.377 | 0 | 0.000 | 225.86 |
| 8 | mixed | 3358.67 | 289.749 | 469.161 | 2342.071 | 57 | 0.028 | 55.39 |
| 16 | ok | 20091.54 | 44.623 | 122.708 | 1264.194 | 0 | 0.000 | 223.03 |
| 16 | mixed | 2408.98 | 310.196 | 1038.413 | 3065.613 | 156 | 0.107 | 42.23 |

원문 측정 줄:

```text
PERF_RESULT workers=0 route=ok LOAD_STAGE stage=94201 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.407 requests=151950 rps=2515.44 p50_ms=395.881 p99_ms=413.021 max_ms=485.923 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:151950,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:151950
PERF_RESULT workers=0 route=mixed LOAD_STAGE stage=94202 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.522 requests=142387 rps=2352.64 p50_ms=416.435 p99_ms=674.753 max_ms=2762.047 errors=96372 error_pct=67.683 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=247 other_http=0 status_503=96125 retry_after_missing=0 overload_rejected=96125 rejection_pct=99.744 write_http_200=8716 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=247 invalid_status=247 route_counts=ok:28467,static:28482,jwt:28504,read:28484,write:28450,slow300:0 status_codes=0:247,200:46015,503:96125
PERF_RESULT workers=2 route=ok LOAD_STAGE stage=94203 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.045 requests=1245311 rps=20739.60 p50_ms=46.831 p99_ms=86.988 max_ms=162.165 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1245311,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1245311
PERF_RESULT workers=2 route=mixed LOAD_STAGE stage=94204 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.391 requests=202736 rps=3357.06 p50_ms=292.975 p99_ms=427.285 max_ms=2311.521 errors=9 error_pct=0.004 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=9 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=40541 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=9 invalid_status=9 route_counts=ok:40549,static:40541,jwt:40547,read:40549,write:40550,slow300:0 status_codes=0:9,200:202727
PERF_RESULT workers=4 route=ok LOAD_STAGE stage=94205 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.048 requests=1209166 rps=20136.63 p50_ms=47.724 p99_ms=88.065 max_ms=164.207 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1209166,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1209166
PERF_RESULT workers=4 route=mixed LOAD_STAGE stage=94206 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.340 requests=203455 rps=3371.83 p50_ms=291.102 p99_ms=455.396 max_ms=2343.720 errors=26 error_pct=0.013 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=26 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=40670 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=26 invalid_status=26 route_counts=ok:40685,static:40688,jwt:40695,read:40691,write:40696,slow300:0 status_codes=0:26,200:203429
PERF_RESULT workers=8 route=ok LOAD_STAGE stage=94207 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.066 requests=1248591 rps=20786.85 p50_ms=45.633 p99_ms=80.168 max_ms=234.377 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1248591,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1248591
PERF_RESULT workers=8 route=mixed LOAD_STAGE stage=94208 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.387 requests=202821 rps=3358.67 p50_ms=289.749 p99_ms=469.161 max_ms=2342.071 errors=57 error_pct=0.028 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=57 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=40511 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=57 invalid_status=57 route_counts=ok:40564,static:40563,jwt:40562,read:40564,write:40568,slow300:0 status_codes=0:57,200:202764
PERF_RESULT workers=16 route=ok LOAD_STAGE stage=94209 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.058 requests=1206653 rps=20091.54 p50_ms=44.623 p99_ms=122.708 max_ms=1264.194 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1206653,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1206653
PERF_RESULT workers=16 route=mixed LOAD_STAGE stage=94210 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.419 requests=145548 rps=2408.98 p50_ms=310.196 p99_ms=1038.413 max_ms=3065.613 errors=156 error_pct=0.107 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=156 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=28964 send_timeout=0 send_other=0 recv_timeout=5 recv_other=0 incomplete_response=151 invalid_status=156 route_counts=ok:29104,static:29105,jwt:29108,read:29111,write:29120,slow300:0 status_codes=0:156,200:145392
```

작업자별 계측은 worker slot에 기록된 종료 통계를 합쳤다. DB 오류로 비정상 종료한 worker는 종료 보고를 남기지 않아 mixed의 처리 요청 분포는 불완전하다. 재시작 건수와 DB 오류 원문은 서버 로그로 별도 대조했다.

```text
WORKER_AGG label=w2-ok process_exits=126 slots=2 served_total=1245311 per_slot_min=622610 per_slot_max=622701 accept_wait_total_ns=10011369804 accept_wait_max_ns=165678566 nvcsw=18 nivcsw=18723
WORKER_AGG label=w2-mixed process_exits=16 slots=2 served_total=149697 per_slot_min=57793 per_slot_max=91904 accept_wait_total_ns=1236271863 accept_wait_max_ns=171869102 nvcsw=62691 nivcsw=29603
WORKER_AGG label=w4-ok process_exits=124 slots=4 served_total=1209166 per_slot_min=301801 per_slot_max=302845 accept_wait_total_ns=20295467025 accept_wait_max_ns=187421316 nvcsw=29 nivcsw=303364
WORKER_AGG label=w4-mixed process_exits=15 slots=4 served_total=117215 per_slot_min=12363 per_slot_max=51672 accept_wait_total_ns=1187095206 accept_wait_max_ns=112761442 nvcsw=50799 nivcsw=23783
WORKER_AGG label=w8-ok process_exits=128 slots=8 served_total=1248591 per_slot_min=152295 per_slot_max=158651 accept_wait_total_ns=40880383730 accept_wait_max_ns=323599312 nvcsw=16 nivcsw=823611
WORKER_AGG label=w8-mixed process_exits=10 slots=8 served_total=36545 per_slot_min=312 per_slot_max=11671 accept_wait_total_ns=1333060747 accept_wait_max_ns=183913052 nvcsw=17154 nivcsw=7631
WORKER_AGG label=w16-ok process_exits=127 slots=16 served_total=1206653 per_slot_min=64227 per_slot_max=80133 accept_wait_total_ns=72400792949 accept_wait_max_ns=308092492 nvcsw=32 nivcsw=1734540
WORKER_AGG label=w16-mixed process_exits=16 slots=16 served_total=26804 per_slot_min=19 per_slot_max=5437 accept_wait_total_ns=2628012720 accept_wait_max_ns=193913172 nvcsw=14829 nivcsw=6148
```

## PERF_SUMMARY

판정은 4/6이다. a(코어 분리), d(처리량 표), e(최종 전수 회귀), f(민감정보 검사)는 통과했다. b는 16-worker `/ok` 오류가 코어 분리 측정에서 재현되지 않았고, 비분리 회귀의 재현에서는 부하 도구 CPU를 측정하지 않아 서버와 클라이언트 중 원인을 분리하지 못해 미통과다. c는 `WORKERS=0` mixed의 503을 오류에 포함하면 67.683%라 실패한다.

```text
PERF_SUMMARY=4/6
```

혼합 성능 목표 `RPS 800 이상 또는 p99 1000ms 미만`은 모든 worker 구성에서 충족했다. 16-worker mixed는 p99가 1038.413ms로 1000ms를 넘었지만 2408.98 RPS였다. SQLite 동시 쓰기 잠금은 남은 위험이다. 원인 분석상 socket reuse 설정을 바꿀 근거는 없었다.

## 전체 회귀 확인

최종 보고서 전 커밋 `2311fa2cd7bc47a5c8faed6b65f366da17ee1ed6`에서 고정점 확인과 `strace -f -e trace=execve` 전체 회귀를 실행했다. 일반 모드 및 풀 모드 LOAD2/FDFIX/CAP, 작업자 종료·교대·보안 검사는 모두 통과했다. 빠른 시험도 전부 통과했다. 앞선 두 번의 보고서 확인 실행은 풀 모드 RSS 판정에서 9/10으로 끝났지만, 이번 최종 실행은 RSS 안정 조건까지 통과했다. 저 fd 사례는 예상된 `db-exec:` 오류를 내고 신호 없이 끝났다.

```text
FINALCHECK_HEAD=2311fa2cd7bc47a5c8faed6b65f366da17ee1ed6
FINALCHECK_SUITE_RC=0
LOAD2_SUMMARY=10/10
LOAD_200_IDS_MISSING_FROM_DB=0
LOAD_DB_ONLY_IDS=0
LOAD_DUPLICATE_IDS=0
LOAD_DB_INTEGRITY=ok
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_START rss_kb=35696 fd=48
LOAD_RESOURCE_END rss_kb=33476 fd=48
LOAD_RESOURCE_STABLE=1
FDFIX_SUMMARY=5/5
CAP_ACTIVE_CONNECTIONS_MAX=256
CAP_503=2761
CAP_OTHER_ERRORS=0
CAP_RECOVERY_HTTP=200
CAP_ZOMBIE_DELTA=0
CAP_SUMMARY=6/6
POOL_SUMMARY=8/8
TASK942_ALL=PASS
```

풀 모드 회귀의 worker kill/교대, 자원, 좀비 검사는 다음 원문으로 통과했다.

```text
POOL_KILL_ERROR_PCT=0.000
POOL_KILL_RECOVERY_HTTP=200
POOL_RESOURCE_STABLE=1
POOL_ZOMBIE_CHILDREN=0
POOL_CHILDREN_AFTER_STOP=0
POOL_WORKERS_ALIVE_AFTER_STOP=0
POOL_ROTATION_SERVER_STOP_RC=0
POOL_SUMMARY=8/8
```

같은 전수 실행에서 workers=16 `/ok` 벤치는 56.338% 오류였다(연결 시간 초과 44건, 수신 시간 초과 11,481건). active connection 최대치는 16이며 503은 없었다. 이 회귀 구간은 클라이언트 CPU를 계측하지 않아 오류의 발생 주체를 확정할 수 없다. 코어 분리 성능 측정의 `/ok`에서는 오류가 0건이어서 두 측정 차이는 미확인으로 남는다.

전수 요약과 실행 감시:

```text
OOM_SUMMARY=12/12
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
NAME_SUMMARY=9/9
WARN_SUMMARY=4/4
ABI_SUMMARY=8/8
BUILTIN2_SUMMARY=16/16
HOF_SUMMARY=25/25
TEST_EVIDENCE_SUMMARY=53/53
TCP_SUMMARY=24/24
HTTP_SUMMARY=26/26
AUDIT_SUMMARY=44/44
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
ERP_SUMMARY=22/22
ERP2_SUMMARY=12/12
ERP3_SUMMARY=19/19
CONC_SUMMARY=8/8
SEC_SUMMARY=14/14
AUTH_SUMMARY=16/16
PAGE_SUMMARY=11/11
NET2_SUMMARY=18/18
PW_SUMMARY=11/11
JWT_SUMMARY=19/19
STREAM_SUMMARY=13/13
JSONNUM_SUMMARY=9/9
PAR_SUMMARY=16/16
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=9/9
HTTPATK_SUMMARY=21/21
STATIC_SUMMARY=18/18
TIMEOUT_SUMMARY=8/8
TIMEPREC_SUMMARY=6/6
CAP_SUMMARY=6/6
NODE=0
NPM=0
NPX=0
JS=0
PYTHON=0
```

최종 커밋 실행의 전체 요약은 통과했다. 앞선 두 번의 전체 실행은 풀 모드 RSS가 각각 9/10이었으나, 보고서가 들어간 최종 검증 커밋에서는 RSS 안정 기준과 POOL_SUMMARY가 통과했다.

## 해시, 회귀, 커밋과 원격

컴파일러는 수정하지 않았다. 시드는 바뀌지 않았다. 고정점 검증 결과:

```text
seed: 36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2
stage2: ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba
stage3: ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba
stage4: ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
FIXPOINT_RC=0
```

미확인: 73에서는 측정하지 않았다. 코어 분리 측정의 16-worker mixed 오류 1건은 DB 잠금 수와 일치하지 않는다. 풀 모드 RSS 안정 실패 원인은 이 측정만으로 확정할 수 없어 수정하지 않았다. 일반 모드에서는 LOAD2 10/10, FDFIX 5/5였고, 최종 전수 실행에서는 풀 모드 RSS 안정 조건과 POOL_SUMMARY 8/8을 통과했다.
