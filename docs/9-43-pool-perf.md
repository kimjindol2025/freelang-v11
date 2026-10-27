# 작업자 풀 처리량 원인 분석 (9-43)

## 실행 범위

실행 위치: 메인

73은 건너뛰고 여기서 측정했다. 보고서의 앞선 메인 측정은 실행 환경 분리가 입증되지 않아 무효 처리했다. 이번 데이터는 계측·부하 도구 변경 커밋 `90355760cd50fd38a6873265b554eb44f6974b97` 및 분리 코어 선택 스크립트 커밋 `ea143b5e34d694489c82d0f3f31f501bff4ec0e7`에서 얻었다. 실행 전에 공유 heavy lock이 비어 있었고, 같은 벤치마크 프로세스가 없는지 확인했다. 부하 도구와 서버는 별도의 물리 코어 집합에 고정했다.

```text
PERF_CPU_CORE_SEPARATED=1
```

`pidstat` 평균으로 측정한 부하 도구 CPU는 34.85%–221.83%였다(100%는 CPU 코어 하나 사용). 성능 계측은 `pidstat`과 요청 시간 로그를 사용했다. 서버 사양·주소는 기록하지 않는다.

## 16 작업자 오류 재현과 원인

9-42에서 보고된 16-worker `/ok` 오류율 85.260%는 이번 분리 측정에서 재현되지 않았다. 이번 `/ok` 결과는 0 오류였다. 과거 실행은 오류를 종류별로 나눈 원자료가 없어 과거 원인을 확정할 수 없다. 이전 오류가 부하 도구나 실행 환경에서 발생했을 가능성은 추측이다.

이번 mixed 부하에서 보인 오류는 서버 측 SQLite 잠금이다. 16-worker mixed는 응답 누락 90건이었고, 서버 로그에도 `database is locked` 90건 및 해당 작업자 오류 종료·재시작 90건이 있었다. 클라이언트에는 연결 거부, 연결/송수신 시간 초과가 없었다. 따라서 이번 오류는 부하 도구가 만든 연결 오류가 아니다. 작업자별 공유 listen 소켓 경합은 계측값만으로 확정되지 않아 `SO_REUSEPORT`는 추가하지 않았다.

`WORKERS=0` mixed의 오류 91,579건 중 91,333건은 설정된 동시 연결 상한에서 반환한 503이고, 나머지 246건은 SQLite 잠금으로 인한 불완전 응답이다. 정상적인 상한 거절을 포함하므로 이 모드의 전체 오류율은 1% 미만 기준을 만족하지 않는다.

## 계측 코드

- `runtime/http_server.c:228-279`: `FL_HTTP_PERF_DIAGNOSTICS`가 설정된 시험 빌드에서 작업자별 요청 수, accept 대기, 문맥 전환을 수집한다.
- `tests/task938/load-client.c:31-48,141-216,300-358`: 연결·송수신 오류 종류와 상태 코드, 지연을 나눠 집계한다.
- `tests/run-task943-perf.sh:1-86`: 부하 도구와 서버를 별도 물리 코어 집합에 고정하고 각 조합을 60초 측정한다.
- 서버의 기본 동작과 컴파일러는 수정하지 않았다.

## 결과 표

각 셀은 1000 연결, 60초 측정이다. 아래 값은 `LOAD_STAGE` 원문과 같은 실행의 `pidstat Average`에서 옮겼다.

| workers | 경로 | RPS | p50 ms | p99 ms | 최대 ms | 오류 수 | 오류율 % | 부하 도구 CPU % |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | ok | 2521.73 | 395.117 | 426.282 | 462.285 | 0 | 0.000 | 42.15 |
| 0 | mixed | 2288.23 | 420.096 | 702.312 | 2771.433 | 91579 | 66.113 | 34.85 |
| 2 | ok | 20512.18 | 48.062 | 57.082 | 103.482 | 0 | 0.000 | 153.66 |
| 2 | mixed | 3384.03 | 291.352 | 442.117 | 2303.413 | 8 | 0.004 | 56.43 |
| 4 | ok | 20325.13 | 48.004 | 63.903 | 138.800 | 0 | 0.000 | 153.13 |
| 4 | mixed | 3363.80 | 292.003 | 461.977 | 2343.912 | 20 | 0.010 | 55.63 |
| 8 | ok | 20790.74 | 45.631 | 81.111 | 361.114 | 0 | 0.000 | 221.83 |
| 8 | mixed | 3343.56 | 291.715 | 496.319 | 2476.739 | 53 | 0.026 | 55.42 |
| 16 | ok | 19056.05 | 46.583 | 131.327 | 2794.052 | 0 | 0.000 | 206.93 |
| 16 | mixed | 3318.89 | 289.953 | 505.479 | 2466.988 | 90 | 0.045 | 55.36 |

### `LOAD_STAGE` 원문

```text
LOAD_STAGE stage=94201 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.411 requests=152341 rps=2521.73 p50_ms=395.117 p99_ms=426.282 max_ms=462.285 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:152341,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:152341
LOAD_STAGE stage=94202 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.535 requests=138518 rps=2288.23 p50_ms=420.096 p99_ms=702.312 max_ms=2771.433 errors=91579 error_pct=66.113 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=91579 other_http=0 status_503=91333 retry_after_missing=0 overload_rejected=91333 rejection_pct=99.731 write_http_200=8694 send_timeout=0 send_other=0 recv_timeout=0 recv_other=91333 incomplete_response=246 invalid_status=246 route_counts=ok:27672,static:27737,jwt:27748,read:27713,write:27648,slow300:0 status_codes=0:246,200:46939,503:91333
LOAD_STAGE stage=94203 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.056 requests=1231882 rps=20512.18 p50_ms=48.062 p99_ms=57.082 max_ms=103.482 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1231882,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1231882
LOAD_STAGE stage=94204 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.368 requests=204289 rps=3384.03 p50_ms=291.352 p99_ms=442.117 max_ms=2303.413 errors=8 error_pct=0.004 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=8 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=40852 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=8 invalid_status=8 route_counts=ok:40857,static:40858,jwt:40856,read:40858,write:40860,slow300:0 status_codes=0:8,200:204281
LOAD_STAGE stage=94205 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.056 requests=1220645 rps=20325.13 p50_ms=48.004 p99_ms=63.903 max_ms=138.800 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1220645,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1220645
LOAD_STAGE stage=94206 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.347 requests=202996 rps=3363.80 p50_ms=292.003 p99_ms=461.977 max_ms=2343.912 errors=20 error_pct=0.010 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=20 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=40588 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=20 invalid_status=20 route_counts=ok:40595,static:40595,jwt:40603,read:40595,write:40608,slow300:0 status_codes=0:20,200:202976
LOAD_STAGE stage=94207 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.060 requests=1248692 rps=20790.74 p50_ms=45.631 p99_ms=81.111 max_ms=361.114 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1248692,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1248692
LOAD_STAGE stage=94208 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.388 requests=201912 rps=3343.56 p50_ms=291.715 p99_ms=496.319 max_ms=2476.739 errors=53 error_pct=0.026 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=53 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=40331 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=53 invalid_status=53 route_counts=ok:40380,static:40383,jwt:40378,read:40387,write:40384,slow300:0 status_codes=0:53,200:201859
LOAD_STAGE stage=94209 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.058 requests=1144476 rps=19056.05 p50_ms=46.583 p99_ms=131.327 max_ms=2794.052 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1144476,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1144476
LOAD_STAGE stage=94210 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.417 requests=200518 rps=3318.89 p50_ms=289.953 p99_ms=505.479 max_ms=2466.988 errors=90 error_pct=0.045 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=90 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=40028 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=90 invalid_status=90 route_counts=ok:40101,static:40103,jwt:40098,read:40098,write:40118,slow300:0 status_codes=0:90,200:200428
```

## 작업자 경쟁 계측

각 작업자 종료 시점의 누적 계측 합계다. 요청 상한에 따른 정상 교대도 `process_exits`에 포함된다.

```text
WORKER_AGG label=w2-ok process_exits=124 slots=2 served_total=1231882 per_slot_min=615419 per_slot_max=616463 accept_wait_total_ns=9938360815 accept_wait_max_ns=167613887 nvcsw=4 nivcsw=17902
WORKER_AGG label=w2-mixed process_exits=19 slots=2 served_total=175902 per_slot_min=82411 per_slot_max=93491 accept_wait_total_ns=1250372217 accept_wait_max_ns=147625024 nvcsw=72601 nivcsw=35165
WORKER_AGG label=w4-ok process_exits=124 slots=4 served_total=1220645 per_slot_min=304270 per_slot_max=305732 accept_wait_total_ns=19276368842 accept_wait_max_ns=158813288 nvcsw=8 nivcsw=265298
WORKER_AGG label=w4-mixed process_exits=17 slots=4 served_total=148550 per_slot_min=30242 per_slot_max=40294 accept_wait_total_ns=1432737295 accept_wait_max_ns=113270756 nvcsw=64883 nivcsw=30613
WORKER_AGG label=w8-ok process_exits=127 slots=8 served_total=1248692 per_slot_min=149431 per_slot_max=158510 accept_wait_total_ns=38392280427 accept_wait_max_ns=284658430 nvcsw=16 nivcsw=743392
WORKER_AGG label=w8-mixed process_exits=14 slots=8 served_total=88308 per_slot_min=2189 per_slot_max=24634 accept_wait_total_ns=1604903007 accept_wait_max_ns=168441789 nvcsw=41937 nivcsw=18541
WORKER_AGG label=w16-ok process_exits=123 slots=16 served_total=1144476 per_slot_min=58011 per_slot_max=76645 accept_wait_total_ns=69288634348 accept_wait_max_ns=272211838 nvcsw=32 nivcsw=1880454
WORKER_AGG label=w16-mixed process_exits=16 slots=16 served_total=38762 per_slot_min=6 per_slot_max=5963 accept_wait_total_ns=2824508015 accept_wait_max_ns=211207196 nvcsw=21817 nivcsw=8970
```

## PERF_SUMMARY

```text
PERF_SUMMARY=5/6
```

| 항목 | 결과 | 설명 |
|---|---:|---|
| a. 코어 분리 기록 | 1/1 | 서로 다른 물리 코어 집합 고정 확인 |
| b. 16-worker 오류 분류 | 1/1 | 과거 `/ok` 오류는 미재현, 이번 mixed 오류는 서버 DB 잠금으로 분류 |
| c. 모든 worker 수 오류율 1% 미만 | 0/1 | workers=0 mixed에서 상한 503 포함 오류율 66.113% |
| d. worker 수별 처리량 표 | 1/1 | 위 10개 측정값 |
| e. 회귀와 strace | 보류 | 최종 보고 커밋에서 실행 예정 |
| f. 민감 정보 검사 | 1/1 | 상위 절대 경로, 주소, IP 검사 결과 0건 |

혼합 부하 목표는 모든 worker 수에서 p99 1000ms 미만으로 달성했다. workers=0의 오류율 판정은 상한 초과 503 거절 때문에 실패했다. 성능 계측 후 서버 코드는 바꾸지 않았다. SQLite 잠금과 과거 오류의 미확정 원인은 남은 위험이다.

## 해시, 기존 시험, 커밋

컴파일러는 수정하지 않았다. 보고서 커밋 직전 해시 재확인 및 최종 커밋에서의 전체 회귀·strace 결과를 여기에 추가한다. 시드와 고정점은 기준값을 유지해야 한다.

```text
PENDING: stage2/3/4 SHA256, CMP_2_3, CMP_3_4, seed SHA256
PENDING: 9-42 빠른 시험 전체 RC, POOL/LOAD2/FDFIX/CAP 요약, strace execve 횟수
PENDING: 최종 커밋, 양쪽 원격 HEAD
```

미확인: 73 측정은 사용자가 건너뛰도록 지시해 수행하지 않았다. 9-42의 과거 16-worker 오류 발생 원인은 기존 오류 분류 자료가 없어 확인할 수 없다. 이번 mixed 부하에서 SQLite 잠금의 더 깊은 원인은 분석·수정하지 않았다.
