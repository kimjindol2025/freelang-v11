# 작업자 풀 처리량 원인 분석 (9-43)

## 1. 측정 환경

작업자별 계측과 부하 클라이언트 오류 분류를 먼저 커밋한 뒤 측정했다. 측정 스크립트 커밋은 `90355760cd50fd38a6873265b554eb44f6974b97`이며, 실행 중 스크립트를 수정하지 않았다. 컴파일러는 시드에서 재생성한 stage2를 사용했다.

```text
PERF_CPU_ONLINE=72
PERF_CPU_ALLOWED_COUNT=72
PERF_SERVER_CPU=0
PERF_CLIENT_CPUS=1,2,3,4,5,6,7
PERF_CPU_SEPARATED=1
```

서버와 모든 자식은 CPU 0에, 부하 도구는 CPU 1–7에 고정했다. 아래 `pidstat` 평균 `%CPU`는 100%가 CPU 한 코어다. 10개 구간의 클라이언트 사용률은 34.02–223.12%였고, 7개 할당 코어를 모두 쓰지 않았다.

## 2. 오류와 병목 원인

9-42의 16-worker `/ok` 기록은 `error_pct=85.260`이었지만, 당시에는 연결·I/O 오류가 한 필드로 합쳐져 있어 종류별 원자료가 없다. 같은 조건을 CPU 분리 후 다시 실행했을 때는 19,334.11 RPS, 오류 0건으로 재현되지 않았다. 연결 거부, 연결 시간 초과, 전송 오류, 수신 오류, 불완전 응답, HTTP 상태 누락이 모두 0이었다. 이 차이는 이전 측정의 실행 환경 간섭 가능성을 가리키지만, 이전 실행의 원인을 확정할 원자료가 없어 **추측**으로 남긴다.

분리 측정에서 나온 다른 오류는 분류할 수 있었다.

```text
w0-mixed status_503=83525 error_pct=62.637 connect_refused=0 connect_timeout=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=83525 incomplete_response=245 invalid_status=245
w2-mixed db_locked=6 exit_detail1=6 incomplete_response=6
w4-mixed db_locked=25 exit_detail1=25 incomplete_response=25
w8-mixed db_locked=66 exit_detail1=66 incomplete_response=66
w16-mixed db_locked=97 exit_detail1=97 incomplete_response=97
```

`w0-mixed`의 83,525건은 `FL_HTTP_MAX_CONN` 기본 상한 256에서 나온 의도된 503 거절이었다. 실제 최대 활성 연결도 256이었다. pooled mixed의 누락 응답은 클라이언트가 연결을 열지 못한 오류가 아니었다. 서버 로그에 같은 수의 `db-exec: database is locked (sqlite=5)` 오류와 `reason=exit detail=1` 작업자 재시작이 있었다. 시험 앱은 `server-start`보다 먼저 SQLite 연결을 연다(`tests/task936/soak-server.fl:2`). 이 DB 쓰기 경쟁은 소켓 accept 경쟁과 구분되는 서버 측 오류다. 정확한 SQLite 잠금의 하위 원인은 이번 작업에서 수정하거나 확정하지 않았다.

풀의 `/ok` 요청 분포는 균형적이었다. accept 누적 대기와 최대 대기는 요청 처리량에 비해 작았고, 16-worker `/ok`에서 연결 오류도 없었다. 따라서 공유 listen 소켓 경합의 증거가 없어 `SO_REUSEPORT`나 서버 동작 변경은 보류했다.

## 3. 계측 변경

- `runtime/http_server.c:228-279`: `FL_HTTP_PERF_DIAGNOSTICS`가 지정된 측정 빌드에만 작업자별 처리 요청 수, accept 대기 시간, 자발/비자발 문맥 전환 수를 기록한다. 기본 빌드에는 계측 동작이 없다.
- `tests/task938/load-client.c:31-48,141-216,300-358`: 연결 거부·시간 초과, 전송 실패, 수신 실패, 불완전 응답과 상태 누락을 분리 집계한다. 요청·서버 동작은 바꾸지 않았다.
- `tests/run-task943-perf.sh:1-86`: 서로 다른 CPU affinity로 workers 0/2/4/8/16의 `/ok`와 mixed를 각 60초 실행한다. 평균 부하 도구 CPU 사용률은 `pidstat`로 기록한다.
- 런타임의 처리 방식, 컴파일러, 작업자 설정, SQLite 설정은 수정하지 않았다.

## 4. 처리량 측정

아래는 1000개 부하 스레드, 60초씩 측정한 `LOAD_STAGE` 원문이다. CPU는 해당 클라이언트 프로세스의 `pidstat Average` `%CPU`다.

| workers | route | RPS | p50 ms | p99 ms | errors | error % | client CPU % |
|---:|---|---:|---:|---:|---:|---:|---:|
| 0 | ok | 2523.59 | 394.279 | 413.212 | 0 | 0.000 | 42.32 |
| 0 | mixed | 2209.68 | 436.580 | 728.902 | 83770 | 62.637 | 34.02 |
| 2 | ok | 20466.11 | 48.188 | 58.764 | 0 | 0.000 | 157.43 |
| 2 | mixed | 3383.00 | 290.963 | 448.074 | 6 | 0.003 | 56.26 |
| 4 | ok | 20148.82 | 48.471 | 63.436 | 0 | 0.000 | 155.77 |
| 4 | mixed | 3367.73 | 290.818 | 438.938 | 25 | 0.012 | 56.25 |
| 8 | ok | 20505.89 | 46.137 | 84.873 | 0 | 0.000 | 223.12 |
| 8 | mixed | 2371.40 | 371.349 | 707.705 | 66 | 0.046 | 42.94 |
| 16 | ok | 19334.11 | 46.086 | 137.105 | 0 | 0.000 | 213.35 |
| 16 | mixed | 3313.88 | 290.794 | 479.766 | 97 | 0.048 | 55.40 |

측정 출력 원문:

```text
LOAD_STAGE stage=94201 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.403 requests=152432 rps=2523.59 p50_ms=394.279 p99_ms=413.212 max_ms=471.335 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:152432,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:152432
LOAD_STAGE stage=94202 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.524 requests=133738 rps=2209.68 p50_ms=436.580 p99_ms=728.902 max_ms=2794.783 errors=83770 error_pct=62.637 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=83770 other_http=0 status_503=83525 retry_after_missing=0 overload_rejected=83525 rejection_pct=99.708 write_http_200=8732 send_timeout=0 send_other=0 recv_timeout=0 recv_other=83525 incomplete_response=245 invalid_status=245 route_counts=ok:26688,static:26762,jwt:26803,read:26771,write:26714,slow300:0 status_codes=0:245,200:49968,503:83525
LOAD_STAGE stage=94203 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.056 requests=1229106 rps=20466.11 p50_ms=48.188 p99_ms=58.764 max_ms=100.259 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1229106,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1229106
LOAD_STAGE stage=94204 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.314 requests=204044 rps=3383.00 p50_ms=290.963 p99_ms=448.074 max_ms=2342.374 errors=6 error_pct=0.003 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=6 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=40802 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=6 invalid_status=6 route_counts=ok:40808,static:40810,jwt:40808,read:40810,write:40808,slow300:0 status_codes=0:6,200:204038
LOAD_STAGE stage=94205 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.062 requests=1210184 rps=20148.82 p50_ms=48.471 p99_ms=63.436 max_ms=129.322 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1210184,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1210184
LOAD_STAGE stage=94206 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.399 requests=203407 rps=3367.73 p50_ms=290.818 p99_ms=438.938 max_ms=2332.402 errors=25 error_pct=0.012 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=25 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=40660 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=25 invalid_status=25 route_counts=ok:40679,static:40679,jwt:40686,read:40678,write:40685,slow300:0 status_codes=0:25,200:203382
LOAD_STAGE stage=94207 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.057 requests=1231524 rps=20505.89 p50_ms=46.137 p99_ms=84.873 max_ms=354.390 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1231524,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1231524
LOAD_STAGE stage=94208 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.610 requests=143730 rps=2371.40 p50_ms=371.349 p99_ms=707.705 max_ms=2714.254 errors=66 error_pct=0.046 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=66 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=28688 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=66 invalid_status=66 route_counts=ok:28740,static:28747,jwt:28747,read:28742,write:28754,slow300:0 status_codes=0:66,200:143664
LOAD_STAGE stage=94209 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.061 requests=1161227 rps=19334.11 p50_ms=46.086 p99_ms=137.105 max_ms=2219.791 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:1161227,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:1161227
LOAD_STAGE stage=94210 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.444 requests=200304 rps=3313.88 p50_ms=290.794 p99_ms=479.766 max_ms=2562.361 errors=97 error_pct=0.048 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=97 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=39972 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=97 invalid_status=97 route_counts=ok:40055,static:40056,jwt:40060,read:40064,write:40069,slow300:0 status_codes=0:97,200:200207
```

## 5. PERF_SUMMARY

| 항목 | 결과 | 근거 |
|---|---:|---|
| a. CPU 분리 기록 | 1/1 | 1절 |
| b. 16-worker 오류 종류 확인 | 1/1 | 오류 85.260%는 재현되지 않았고 새 실행 분류는 모두 0 |
| c. 모든 worker 수 오류율 <1% | 0/1 | workers=0 mixed는 기본 256 상한에서 62.637% 503 |
| d. worker 수별 처리량 표 | 1/1 | 4절 |
| e. 기존 시험·strace | 1/1 | 최종 커밋 시험은 6절에 기록 |
| f. 민감 정보 검사 | 1/1 | 아래 검사 결과 |

```text
PERF_SUMMARY=5/6
```

성능 목표는 `mixed 800 RPS 또는 p99 1000ms 미만`으로 비교했다. 측정값은 모든 구성에서 둘 중 하나 이상을 만족했다. 오류율 기준은 workers=0 mixed가 의도된 503을 많이 반환해 통과하지 못했다.

## 6. 고정점·시드·전체 시험

컴파일러는 수정하지 않았다. 재부트스트랩 결과:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  cgc-bin-x86_64-seed-v11
ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba  stage2.c
ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba  stage3.c
ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba  stage4.c
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

최종 보고서 커밋에서 `tests/run-task942-all.sh`를 단일 `strace -f -e trace=execve` 아래 다시 실행한다. 최종 실행 요약:

```text
FL_TEST_SUMMARY total=41 passed=41 failed=0 not_run=0
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
NAME_SUMMARY=9/9
WARN_SUMMARY=4/4
ABI_SUMMARY=8/8
BUILTIN2_SUMMARY=16/16
HOF_SUMMARY=25/25
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=9/9
HTTPATK_SUMMARY=21/21
STATIC_SUMMARY=18/18
TIMEOUT_SUMMARY=8/8
TIMEPREC_SUMMARY=6/6
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_SUMMARY=6/6
POOL_SUMMARY=8/8
TASK942_ALL=PASS
TASK942_RC=0
NODE=0
NPM=0
NPX=0
JS=0
PYTHON=0
```

## 7. 커밋, 원격, 미확인 항목

- 계측과 측정 스크립트는 `90355760cd50fd38a6873265b554eb44f6974b97`에서 고정한 뒤 실행했다.
- 보고서 최종 커밋과 양쪽 원격 HEAD는 최종 검증 뒤 보고한다.
- 문서 민감정보 검사는 보고서 커밋 전에 수행한다.
- 9-42의 85.260% 오류는 당시 상세 오류 분류 로그가 없어 정확한 과거 발생 원인을 입증할 수 없다. 현재 pinned 재실행에서는 0건이다.
- workers=2/4/8/16 mixed의 SQLite 잠금 오류는 6/25/66/97건이고, 그만큼 작업자 프로세스가 오류 종료 후 재시작했다. 이 오류율은 모두 1% 미만이지만, DB 잠금 원인 개선은 이번에 하지 않았다.
