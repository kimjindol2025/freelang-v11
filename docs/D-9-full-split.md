# D-9 full split

실행 위치: `<가림>`

브랜치: `db-stability`
기준 HEAD: `768d909ef7616e50b1cb60321979607b8052fc7b`

## 1. 단계별 결과

### 0. 시드 확인

`dec63e63` 기준 시드와 sha256sum 및 cmp를 확인했다.

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -
SEED_CMP_RC=0
```

### 1-A. 전체 빠른 시험, strace 없음

실행 위치: `<가림>`. 무거운 시험은 `flock -o <가림>` 아래에서 실행했다.

각 실행 묶음 전 `ps`로 다른 D-9 heavy 시험이 없는 것을 확인하고, 각 시험을 flock 아래에서 실행했다. 추가 legacy 3회는 한 묶음 시작 전 확인 후 순차 실행했다.

첫 호출은 기록 파일을 시험 work 디렉터리 안에 두어 사전 조건에서 종료됐고 부하 단계는 실행되지 않았다. 디렉터리를 비운 뒤 수행한 아래 결과가 완료된 A 시험이다.

```text
task 9-49 work directory must be empty
A_FULL_CHECK_RC=2
```

```text
A_FULL_CHECK_RC=1
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

pool 하위 시험은 성공했고, 전체 빠른 시험은 legacy 하위 시험 실패로 1/2였다. 실패 데이터 원문:

```text
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_STABLE=0
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
```

`fd-limit`의 출력은 시험이 기록한 원문이다. SUMMARY에서 빠진 항목은 아래 5회 자원 측정에서 확인한 `LOAD_RESOURCE_STABLE=0`이다. legacy 기록의 `LOAD_DATABASE_IS_LOCKED=0`은 유지한다.

### 1-B. 빌드·고정점 구간만 strace, 부하는 strace 없음

실행 위치: `<가림>`. strace는 seed → stage2 → stage3 → stage4 컴파일·고정점 구간에만 걸었고, `run-task946-full.sh`, pool·legacy 부하, 심볼 및 ABI 시험에는 걸지 않았다. 시험 파일·기준 파일·기대값은 수정하지 않았다.

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
BUILD_FIXED_POINT_STRACE_RC=0
node=0
npm=0
npx=0
JS=0
Python=0
```

같은 HEAD에서 실행한 무추적 전체 시험의 완료 원문:

```text
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

pool `/ok` 요청 결과 원문:

```text
POOL_BENCH workers=0 route=ok LOAD_STAGE stage=941 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.199 requests=309820 rps=5146.56 p50_ms=193.229 p99_ms=213.339 max_ms=228.968 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:309820,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:309820
POOL_BENCH workers=4 route=ok LOAD_STAGE stage=943 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.027 requests=2120397 rps=35324.19 p50_ms=15.619 p99_ms=64.828 max_ms=115.456 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2120397,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2120397
POOL_BENCH workers=8 route=ok LOAD_STAGE stage=945 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.019 requests=2070164 rps=34491.94 p50_ms=24.136 p99_ms=77.264 max_ms=166.832 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2070164,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2070164
POOL_BENCH workers=16 route=ok LOAD_STAGE stage=947 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.017 requests=2113298 rps=35211.80 p50_ms=29.376 p99_ms=90.807 max_ms=210.651 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2113298,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2113298
```

## 2. 자원 안정 기준과 legacy 5회

변경하지 않은 `tests/run-task938-load.sh:312-314` 기준:

```bash
RESOURCE_STABLE=0
(( FINAL_RSS <= STEADY_RSS_BASELINE + 2048 && FINAL_FD <= STEADY_FD_BASELINE + 1 && STEADY_FD_BASELINE <= FINAL_FD + 1 )) && RESOURCE_STABLE=1
printf 'LOAD_RESOURCE_STABLE=%s\n' "$RESOURCE_STABLE"
```

즉 종료 RSS는 첫 부하 단계 최대 RSS보다 2048 KB까지 높을 수 있고, 종료 FD는 기준 FD 대비 ±1 이내여야 한다. 측정 스크립트는 프로세스 및 직접 자식의 RSS·FD·zombie 수를 수집한다. 스레드 수 항목은 스크립트 출력에 없으며, 이번 실행에서도 별도 측정하지 않았다.

매회 실제 측정 원문:

| 회차 | 자원 시작·종료 및 판정 원문 |
|---|---|
| A legacy | `LOAD_RESOURCE_COLD_START rss_kb=5924 fd=8`<br>`LOAD_RESOURCE_START rss_kb=5924 fd=18`<br>`LOAD_RESOURCE_END rss_kb=5924 fd=8`<br>`LOAD_RESOURCE_STABLE=0`<br>`LOAD_DATABASE_IS_LOCKED=0`<br>`LOAD2_SUMMARY=9/10`<br>`FDFIX_SUMMARY=4/5` |
| B legacy | `LOAD_RESOURCE_COLD_START rss_kb=6124 fd=8`<br>`LOAD_RESOURCE_START rss_kb=12852 fd=18`<br>`LOAD_RESOURCE_END rss_kb=6124 fd=8`<br>`LOAD_RESOURCE_STABLE=0`<br>`LOAD_DATABASE_IS_LOCKED=0`<br>`LOAD2_SUMMARY=9/10`<br>`FDFIX_SUMMARY=4/5` |
| 3 | `LOAD_RESOURCE_COLD_START rss_kb=5940 fd=8`<br>`LOAD_RESOURCE_START rss_kb=12540 fd=38`<br>`LOAD_RESOURCE_END rss_kb=5940 fd=8`<br>`LOAD_RESOURCE_STABLE=0`<br>`LOAD_DATABASE_IS_LOCKED=0`<br>`LOAD2_SUMMARY=9/10`<br>`FDFIX_SUMMARY=4/5` |
| 4 | `LOAD_RESOURCE_COLD_START rss_kb=6040 fd=8`<br>`LOAD_RESOURCE_START rss_kb=6040 fd=28`<br>`LOAD_RESOURCE_END rss_kb=6040 fd=8`<br>`LOAD_RESOURCE_STABLE=0`<br>`LOAD_DATABASE_IS_LOCKED=0`<br>`LOAD2_SUMMARY=9/10`<br>`FDFIX_SUMMARY=4/5` |
| 5 | `LOAD_RESOURCE_COLD_START rss_kb=5944 fd=8`<br>`LOAD_RESOURCE_START rss_kb=5944 fd=28`<br>`LOAD_RESOURCE_END rss_kb=5944 fd=8`<br>`LOAD_RESOURCE_STABLE=0`<br>`LOAD_DATABASE_IS_LOCKED=0`<br>`LOAD2_SUMMARY=9/10`<br>`FDFIX_SUMMARY=4/5` |

추가 시작·부하 단계 측정값 원문 (RSS는 KB, FD는 개수):

```text
A: LOAD_RESOURCE_WARM_BASELINE rss_kb=835236 fd=18
A: LOAD_SERVER_METRIC concurrency=10 rss_start_kb=5924 rss_max_kb=5924 fd_start=8 fd_max=9 zombie_max=0 zombie_end=0
A: LOAD_SERVER_METRIC concurrency=50 rss_start_kb=5924 rss_max_kb=5924 fd_start=8 fd_max=9 zombie_max=0 zombie_end=0
A: LOAD_SERVER_METRIC concurrency=100 rss_start_kb=5924 rss_max_kb=5924 fd_start=8 fd_max=9 zombie_max=0 zombie_end=0
A: LOAD_SERVER_METRIC concurrency=200 rss_start_kb=5924 rss_max_kb=9268 fd_start=8 fd_max=19 zombie_max=0 zombie_end=0
A: LOAD_SERVER_METRIC concurrency=500 rss_start_kb=5924 rss_max_kb=36020 fd_start=8 fd_max=98 zombie_max=0 zombie_end=0
A: LOAD_SERVER_METRIC concurrency=1000 rss_start_kb=5924 rss_max_kb=119612 fd_start=8 fd_max=348 zombie_max=0 zombie_end=0
B: LOAD_RESOURCE_WARM_BASELINE rss_kb=833916 fd=18
B: LOAD_SERVER_METRIC concurrency=10 rss_start_kb=6124 rss_max_kb=12852 fd_start=8 fd_max=28 zombie_max=0 zombie_end=0
B: LOAD_SERVER_METRIC concurrency=50 rss_start_kb=6124 rss_max_kb=6124 fd_start=8 fd_max=8 zombie_max=0 zombie_end=0
B: LOAD_SERVER_METRIC concurrency=100 rss_start_kb=6124 rss_max_kb=6124 fd_start=8 fd_max=9 zombie_max=0 zombie_end=0
B: LOAD_SERVER_METRIC concurrency=200 rss_start_kb=6124 rss_max_kb=6124 fd_start=8 fd_max=9 zombie_max=0 zombie_end=0
B: LOAD_SERVER_METRIC concurrency=500 rss_start_kb=6124 rss_max_kb=29672 fd_start=8 fd_max=79 zombie_max=0 zombie_end=0
B: LOAD_SERVER_METRIC concurrency=1000 rss_start_kb=6124 rss_max_kb=66676 fd_start=8 fd_max=189 zombie_max=0 zombie_end=0
3: LOAD_RESOURCE_WARM_BASELINE rss_kb=817776 fd=38
3: LOAD_SERVER_METRIC concurrency=10 rss_start_kb=12540 rss_max_kb=12540 fd_start=28 fd_max=28 zombie_max=0 zombie_end=0
3: LOAD_SERVER_METRIC concurrency=50 rss_start_kb=5940 rss_max_kb=5940 fd_start=8 fd_max=8 zombie_max=0 zombie_end=0
3: LOAD_SERVER_METRIC concurrency=100 rss_start_kb=5940 rss_max_kb=5940 fd_start=8 fd_max=9 zombie_max=0 zombie_end=0
3: LOAD_SERVER_METRIC concurrency=200 rss_start_kb=5940 rss_max_kb=9240 fd_start=8 fd_max=19 zombie_max=0 zombie_end=0
3: LOAD_SERVER_METRIC concurrency=500 rss_start_kb=5940 rss_max_kb=29040 fd_start=8 fd_max=79 zombie_max=0 zombie_end=0
3: LOAD_SERVER_METRIC concurrency=1000 rss_start_kb=5940 rss_max_kb=62040 fd_start=8 fd_max=179 zombie_max=0 zombie_end=0
4: LOAD_RESOURCE_WARM_BASELINE rss_kb=826252 fd=28
4: LOAD_SERVER_METRIC concurrency=10 rss_start_kb=6040 rss_max_kb=6040 fd_start=8 fd_max=8 zombie_max=0 zombie_end=0
4: LOAD_SERVER_METRIC concurrency=50 rss_start_kb=6040 rss_max_kb=6040 fd_start=8 fd_max=8 zombie_max=0 zombie_end=0
4: LOAD_SERVER_METRIC concurrency=100 rss_start_kb=6040 rss_max_kb=6040 fd_start=8 fd_max=9 zombie_max=0 zombie_end=0
4: LOAD_SERVER_METRIC concurrency=200 rss_start_kb=6040 rss_max_kb=12712 fd_start=8 fd_max=28 zombie_max=0 zombie_end=0
4: LOAD_SERVER_METRIC concurrency=500 rss_start_kb=6040 rss_max_kb=26056 fd_start=8 fd_max=68 zombie_max=0 zombie_end=0
4: LOAD_SERVER_METRIC concurrency=1000 rss_start_kb=6040 rss_max_kb=52744 fd_start=8 fd_max=149 zombie_max=0 zombie_end=0
5: LOAD_RESOURCE_WARM_BASELINE rss_kb=827612 fd=28
5: LOAD_SERVER_METRIC concurrency=10 rss_start_kb=5944 rss_max_kb=5944 fd_start=8 fd_max=9 zombie_max=0 zombie_end=0
5: LOAD_SERVER_METRIC concurrency=50 rss_start_kb=5944 rss_max_kb=5944 fd_start=8 fd_max=9 zombie_max=0 zombie_end=0
5: LOAD_SERVER_METRIC concurrency=100 rss_start_kb=5944 rss_max_kb=5944 fd_start=8 fd_max=9 zombie_max=0 zombie_end=0
5: LOAD_SERVER_METRIC concurrency=200 rss_start_kb=5944 rss_max_kb=12672 fd_start=8 fd_max=29 zombie_max=0 zombie_end=0
5: LOAD_SERVER_METRIC concurrency=500 rss_start_kb=5944 rss_max_kb=26128 fd_start=8 fd_max=68 zombie_max=0 zombie_end=0
5: LOAD_SERVER_METRIC concurrency=1000 rss_start_kb=5944 rss_max_kb=75332 fd_start=8 fd_max=218 zombie_max=0 zombie_end=0
```

다섯 회 모두 RSS 조건은 만족했다. 다섯 회 모두 FD 조건의 하한 `STEADY_FD_BASELINE <= FINAL_FD + 1`은 만족하지 않았다: 기준 FD 18, 18, 38, 28, 28이고 종료 FD는 매회 8이다. 따라서 원문 판정은 모두 `LOAD_RESOURCE_STABLE=0`이다. 이 사실만으로 FD 감소 원인을 특정할 수는 없어 원인은 **미확인**으로 분류한다. 기준값·기대값은 바꾸지 않았다.

## 3. 남은 실패 분류

| 항목 | 결과 및 분류 |
|---|---|
| legacy `LOAD2_SUMMARY` 및 `TASK942_LEGACY_RC` | 5회 모두 `9/10`, `RC=1`. `LOAD_DATABASE_IS_LOCKED=0`; 자원 안정 항목이 0인 원문은 확인했으나 FD 기준점과 종료점이 다른 원인은 **미확인**. |
| legacy `FDFIX_SUMMARY` | 5회 모두 `4/5`. 원문 `FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)`; `LOAD2_SUMMARY=10/10` 조건이 없어 1항목 미통과. 실패의 분류는 **미확인**으로 둔다. fd-limit 원문과 기대값은 유지했다. |
| legacy DB 기록과 HTTP 200 ACK 행 수 차이 | A `LOAD_ACK_SQL_ROWS=27569`, `LOAD_DB_ROWS=27835`, `LOAD_200_IDS_MISSING_FROM_DB=0`, `LOAD_DB_ONLY_IDS=266`, `LOAD_DB_WRITE_MATCH=0`; B `27238`, `27494`, `0`, `256`, `0`; 3 `28083`, `28342`, `0`, `259`, `0`; 4 `27765`, `28010`, `0`, `245`, `0`; 5 `27776`, `28018`, `0`, `242`, `0`. 다섯 회 모두 `LOAD_DB_INTEGRITY=ok`, `LOAD_DATABASE_IS_LOCKED=0`. 로그에는 DB-only 행이 남았으나 생성·ACK 차이 원인은 **미확인**. |
| pool | `POOL_SUMMARY=8/8`, `TASK942_POOL_RC=0`. `/ok` 부하 네 worker 조건의 원문 오류율은 모두 0.000%였다. |
| thread count | 자원 측정 스크립트가 출력하지 않아 값 및 영향은 **미확인**. |

## 4. D9_SUMMARY

- ① 시드 일치: 통과 (`SEED_CMP_RC=0`, SHA-256 동일).
- ② A `TASK942_POOL_RC=0` 및 `TASK946_FAST_SUMMARY=2/2`: 미통과 (`0`, `1/2`).
- ③ legacy 5회 `LOAD2_SUMMARY=10/10`: 미통과 (5회 모두 `9/10`).
- ④ 고정점 및 실행 수: 통과 (`CMP_2_3=0`, `CMP_3_4=0`, 실행 수 모두 0).

```text
D9_SUMMARY=2/4
```

## 5. 커밋·원격

민감 정보 diff 점검: 0건. 보고서 커밋은 Forgejo에 먼저, GitHub에 이어 push하고 두 원격의 `db-stability` HEAD가 같은 커밋인지 확인한다. 보고서 커밋 ID와 각 원격의 확인된 HEAD는 완료 보고에 원문으로 기록한다.
