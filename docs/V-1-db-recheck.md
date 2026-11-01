# V-1 DB 닫기 독립 재검증

기준 브랜치: `db-stability`
기준 HEAD: `963632add97cb0534a04d4707956ffe45d9e7e0e`
보고서 브랜치: `recheck-v1`
실행 위치·원본 로그 보관 위치: `<가림>`

새 폴더에 새로 clone했고 최초 HEAD가 지정값과 일치함을 확인했다. 기존 작업본은 수정하지 않았다. 소스·seed·시험 스크립트·기대값·문턱값·제한시간을 수정하지 않았다. 23·25 서버 접속, sudo, 시스템 설정 수정, force-push, erp·grok-router·test11-hello 운영 작업은 없었다. 새 JS·TS·Python 파일은 만들지 않았다.

무거운 실행 전 ps를 기록하고 `flock -o <가림>` 아래 순차 실행했다. CAP·전체·LOAD2·pool 부하는 strace 없이 수행했다. CAP 20회, 전체 2회, 별도 LOAD2 10회, 별도 pool 8회 외에 실패 재실행은 추가하지 않았다. 전체/pool 스크립트가 원래 호출하는 내부 LOAD2는 별도 10회와 구분했다.

## 1. seed

기준 `dec63e63`의 seed와 새 clone의 seed를 비교했다. 원문(경로만 가림):

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
SEED_CMP_RC=0
```

## 2. CAP 20회

통과 20/20, 실패 0/20, 명령 RC 0. 기존 조건 64 workers, max connections 63, clients 400, 부하 30초 및 복구 요청 제한 3초를 그대로 사용했다.

**복구 요청에서 503이 나온 회차는 없다.** 부하 중 상한 거절 503은 20회 모두 관측됐다. 아래는 회차별 복구 결과 행과 해당 부하의 `CAP_503` 행을 함께 추린 원문이다. 후속 복구 재시도는 실행되지 않았다.

```text
CAP_ITERATION=1 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.359
CAP_503=1404203
CAP_ITERATION=2 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.367
CAP_503=1354040
CAP_ITERATION=3 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.358
CAP_503=1381549
CAP_ITERATION=4 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.378
CAP_503=1372488
CAP_ITERATION=5 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.371
CAP_503=1376979
CAP_ITERATION=6 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.364
CAP_503=1393476
CAP_ITERATION=7 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.365
CAP_503=1385029
CAP_ITERATION=8 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.353
CAP_503=1389223
CAP_ITERATION=9 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.367
CAP_503=1435855
CAP_ITERATION=10 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.364
CAP_503=1420860
CAP_ITERATION=11 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.374
CAP_503=1368082
CAP_ITERATION=12 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.379
CAP_503=1357444
CAP_ITERATION=13 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.380
CAP_503=1352157
CAP_ITERATION=14 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.366
CAP_503=1403814
CAP_ITERATION=15 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.433
CAP_503=1385248
CAP_ITERATION=16 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.357
CAP_503=1345034
CAP_ITERATION=17 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.374
CAP_503=1394464
CAP_ITERATION=18 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.374
CAP_503=1393304
CAP_ITERATION=19 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.376
CAP_503=1400044
CAP_ITERATION=20 CAP_RECOVERY_HTTP=200 CAP_SUMMARY=6/6 DURATION_SEC=31.364
CAP_503=1403504
CAP_FAIL_COUNT=0
CAP_TEST_FAILURE_COUNT=0
```

## 3. 전체 빠른 시험 2회

기존 전체 빠른 시험 진입점 TASK946을 2회 수행했다. 집계 단위는 해당 스크립트의 최상위 하위 suite인 legacy/pool 2개다. 시간초과는 시험 명령의 종료 코드 124/137 및 server-wait 시간초과 표식 기준이며, 요청별 recv_timeout 수와 구분한다. SKIP는 하위 로그의 SKIP/SKIP_REASON 표식을 확인했다.

| 회차 | 통과 suite | 실패 suite | 시험 시간초과 | SKIP | 전체 RC | 전체 요약 |
|---:|---:|---:|---:|---:|---:|---|
| 1 | 1 | 1 | 0 | 0 | 1 | TASK946_FAST_SUMMARY=1/2 |
| 2 | 1 | 1 | 0 | 0 | 1 | TASK946_FAST_SUMMARY=1/2 |

전체 실행 자체의 통과는 0/2, 실패는 2/2다. 개별 quick case 전체가 실행됐다는 뜻은 아니다. legacy가 호출하는 별도 `freelang-tools` 저장소가 새 clone의 기본 참조 위치에 없어 quick 진입점이 시작 단계에서 실패했다. 미실행 quick case를 통과나 SKIP로 바꾸어 세지 않았다. 의존성을 보완하거나 시험을 고치지 않았다.

회차 표식과 RC는 집계용으로 붙였으며, 나머지는 요약 및 오류 첫 줄 원문(경로만 가림)이다.

```text
FULL_RUN=1 RC=1
TASK942_LEGACY_RC=1
POOL_SUMMARY=8/8
TASK942_POOL_RC=0
TASK946_FAST_SUMMARY=1/2
<가림>: line 5: cd: <가림>: No such file or directory
FULL_RUN=2 RC=1
TASK942_LEGACY_RC=1
POOL_SUMMARY=8/8
TASK942_POOL_RC=0
TASK946_FAST_SUMMARY=1/2
<가림>: line 5: cd: <가림>: No such file or directory
```

두 회차 모두 legacy 부하 자체는 `LOAD2_SUMMARY=10/10`이었지만 선행 quick 실패로 `TASK942_LEGACY_RC=1`이었다. 각 pool 하위 suite는 `POOL_SUMMARY=8/8`, RC 0이었다. 부하 benchmark에는 요청별 recv_timeout이 관측됐으므로 “모든 요청 오류/시간초과 0”이라는 판정은 하지 않는다.

## 4. 별도 LOAD2 10회 및 pool 8회

### LOAD2

별도 10회 모두 부하 항목은 10/10, DB 잠금 오류 수 0, 자원 안정 항목 1이다. 그러나 10회 모두 `LOAD_FAST_SUITE_RC=1`, wrapper RC 1이었다. 오류 첫 줄은 3절과 같은 도구 저장소 부재이며, 각 회차 base 로그에 보존돼 있다. RC 실패를 부하 10/10으로 덮어 통과 처리하지 않는다.

```text
LOAD2_RUN=1 RC=1
LOAD_FAST_SUITE_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_STABLE=1
LOAD2_SUMMARY=10/10
LOAD2_RUN=2 RC=1
LOAD_FAST_SUITE_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_STABLE=1
LOAD2_SUMMARY=10/10
LOAD2_RUN=3 RC=1
LOAD_FAST_SUITE_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_STABLE=1
LOAD2_SUMMARY=10/10
LOAD2_RUN=4 RC=1
LOAD_FAST_SUITE_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_STABLE=1
LOAD2_SUMMARY=10/10
LOAD2_RUN=5 RC=1
LOAD_FAST_SUITE_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_STABLE=1
LOAD2_SUMMARY=10/10
LOAD2_RUN=6 RC=1
LOAD_FAST_SUITE_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_STABLE=1
LOAD2_SUMMARY=10/10
LOAD2_RUN=7 RC=1
LOAD_FAST_SUITE_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_STABLE=1
LOAD2_SUMMARY=10/10
LOAD2_RUN=8 RC=1
LOAD_FAST_SUITE_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_STABLE=1
LOAD2_SUMMARY=10/10
LOAD2_RUN=9 RC=1
LOAD_FAST_SUITE_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_STABLE=1
LOAD2_SUMMARY=10/10
LOAD2_RUN=10 RC=1
LOAD_FAST_SUITE_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_STABLE=1
LOAD2_SUMMARY=10/10
```

### pool

별도 8회 중 명령 RC 0은 6회(2·3·4·5·7·8), RC 1은 2회(1·6)다. 실패한 두 회차에서는 `POOL_SUMMARY`까지 도달하지 않았다. 누락된 요약을 0/8 또는 8/8로 만들어 쓰지 않았다.

아래는 회차·RC 집계와 각 회차의 실제 pool 및 내부 LOAD2/CAP 요약이다. 1회차는 내부 OOM/fork에서, 6회차는 내부 LOAD2에서 종료돼 이후 CAP 및 pool 최종 요약이 없다.

```text
POOL_RUN=1 RC=1
POOL_RUN=2 RC=0
POOL_SUMMARY=8/8
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_RECOVERY_HTTP=200
CAP_SUMMARY=6/6
POOL_RUN=3 RC=0
POOL_SUMMARY=8/8
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_RECOVERY_HTTP=200
CAP_SUMMARY=6/6
POOL_RUN=4 RC=0
POOL_SUMMARY=8/8
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_RECOVERY_HTTP=200
CAP_SUMMARY=6/6
POOL_RUN=5 RC=0
POOL_SUMMARY=8/8
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_RECOVERY_HTTP=200
CAP_SUMMARY=6/6
POOL_RUN=6 RC=1
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
POOL_RUN=7 RC=0
POOL_SUMMARY=8/8
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_RECOVERY_HTTP=200
CAP_SUMMARY=6/6
POOL_RUN=8 RC=0
POOL_SUMMARY=8/8
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_RECOVERY_HTTP=200
CAP_SUMMARY=6/6
```

**1회차 실패 증거.** 고정된 오류 문장 대신 다음 불통과 요약이 출력됐다. 로그 식별: pool-1 / 내부 load2 / oom-suite, 원본 위치 `<가림>`.

```text
SEGV_COUNT=0
ZOMBIE_COUNT=11
ZOMBIE_BASELINE=10 ZOMBIE_DELTA=1
TEST_PARENT_ZOMBIE_COUNT=0
OOM_SUMMARY=11/12
FORKFAIL_SUMMARY=8/9
```

전역 zombie 수는 10에서 11로 증가했지만 시험 부모의 zombie 수는 0이다. 증가 프로세스의 소속 및 근본 원인은 미확인이다. 환경 오류 또는 제품 오류로 단정하지 않는다.

**6회차 실패 증거.** 첫 불통과 항목은 `LOAD_RESOURCE_STABLE=0`이다. 로그 식별: pool-6 / 내부 load2, 원본 위치 `<가림>`.

```text
LOAD_RESOURCE_BASELINE_SETTLED=0 fd=48
LOAD_RESOURCE_WARM_BASELINE rss_kb=37432 fd=48
LOAD_200_IDS_MISSING_FROM_DB=0
LOAD_DB_ONLY_IDS=0
LOAD_DUPLICATE_IDS=0
LOAD_DB_WRITE_MATCH=1
LOAD_DB_INTEGRITY=ok
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_COLD_START rss_kb=12020 fd=40
LOAD_RESOURCE_START rss_kb=33392 fd=48
LOAD_RESOURCE_END rss_kb=28064 fd=46
LOAD_RESOURCE_STABLE=0
LOAD2_SUMMARY=9/10
LOAD_ACTIVE_CONNECTIONS_MAX=4
FDFIX_SUMMARY=4/5
```

FD 차이 2가 기존 ±1 조건을 벗어났다. FD 감소의 근본 원인은 미확인이며, 기준점·문턱값을 변경하지 않았다.

### 실행 경과

실제 시험은 2026-11-01 UTC에 수행했다. 아래 DURATION_SEC는 공용 잠금 대기를 포함한 호출 경과 초다. 순수 부하 실행 시간으로 해석하지 않는다.

| 실행 | RC | DURATION_SEC |
|---|---:|---:|
| CAP 20회 묶음 | 0 | 897 |
| 전체 1 | 1 | 1519 |
| 전체 2 | 1 | 1501 |
| LOAD2 1 | 1 | 467 |
| LOAD2 2 | 1 | 465 |
| LOAD2 3 | 1 | 466 |
| LOAD2 4 | 1 | 465 |
| LOAD2 5 | 1 | 466 |
| LOAD2 6 | 1 | 465 |
| LOAD2 7 | 1 | 465 |
| LOAD2 8 | 1 | 465 |
| LOAD2 9 | 1 | 549 |
| LOAD2 10 | 1 | 476 |
| pool 1 | 1 | 511 |
| pool 2 | 0 | 1074 |
| pool 3 | 0 | 1141 |
| pool 4 | 0 | 7673 |
| pool 5 | 0 | 1057 |
| pool 6 | 1 | 1059 |
| pool 7 | 0 | 1125 |
| pool 8 | 0 | 1046 |

## 5. bootstrap

첫 호출은 샌드박스에서 strace 자체가 거부돼 컴파일 시작 전에 RC 1로 종료됐다. trace 파일은 0 bytes였다. 오류 첫 줄과 이어진 오류 원문:

```text
strace: test_ptrace_get_syscall_info: PTRACE_TRACEME: Operation not permitted
strace: ptrace(PTRACE_TRACEME, ...): Operation not permitted
strace: PTRACE_SETOPTIONS: Operation not permitted
strace: cleanup: waitpid(-1, __WALL): No child processes
```

도구의 샌드박스 실패 시 필수 상승 실행 규칙에 따라 같은 bootstrap 명령을 호스트 권한으로 1회 호출했다. 호출 이력은 인프라 실패 1회와 실제 완료 1회이며 숨기지 않는다. 소스·명령의 시험 조건은 변경하지 않았다. 이 추적은 bootstrap에만 적용했고 부하에는 적용하지 않았다.

호스트 실행의 seed, stage2·3·4 순서 SHA-256 원문(경로만 가림) 및 결과:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
BOOTSTRAP_HOST_RC=0
TRACE_EXECVE_LINES=475
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
NPX_EXEC_COUNT=0
JS_EXEC_COUNT=0
PYTHON_EXEC_COUNT=0
```

stage2=3=4이며 기대 해시 `1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448`와 일치한다. 실행 수는 비어 있지 않은 호스트 bootstrap execve trace에서 실행 파일명 및 JS 인자 확장자를 검사한 집계다. 부하 전체에 대한 실행 수로 확대 해석하지 않는다.

## 6. 변경 범위·판정·전달

시험 후 기준 HEAD는 그대로 `963632add97cb0534a04d4707956ffe45d9e7e0e`였고 runtime/self/tests/bin의 tracked diff는 없었다(`SOURCE_DIFF_RC=0`). 보고서만 커밋 대상이다. 커밋 전 전체 staged diff에서 민감정보를 검사한다. Forgejo 먼저, GitHub 다음으로 `recheck-v1`만 push하며 `db-stability`는 push하지 않는다. 최종 보고서 커밋 및 두 원격 검증 결과는 완료 답변에 기록한다.

| V1 항목 | 판정 | 근거 |
|---|---|---|
| seed | 통과 | SEED_CMP_RC=0 |
| CAP 20/20 | 통과 | 20회 6/6, 복구 503 0회 |
| 전체 2회 0건 | 미통과 | 두 회차 모두 legacy 실패, 전체 RC 1 |
| LOAD2·pool | 미통과 | LOAD2 wrapper 10회 RC 1, pool 1·6회 실패 |
| bootstrap | 통과 | 기대 해시 일치, cmp 0, 실행 수 각각 0 |

DB 닫기 완료 판정은 내리지 않는다. quick 의존성 부재와 pool 두 실패는 수정하거나 재시도하지 않고 증거로 남겼다.

V1_SUMMARY=3/5
