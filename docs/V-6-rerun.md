# V-6 재실행 결과

기준 브랜치 `recheck-v1`, 기준 HEAD `3f1721470b17986a3141ea9cf4b456702f25b8a4`; 시험 대상 `db-stability` HEAD `963632add97cb0534a04d4707956ffe45d9e7e0e`.

작업은 새 clone에서 진행했다. 도구 저장소 `freelang-tools`는 `5bbfb771e5f9c83f0b9664e306ff143a0a2b556c`에 고정했다. 전체/LOAD2/pool 실행 전 설정 출력은 다음과 같다.

```text
FL_TOOLS_ROOT=<가림>
COMPILER=<가림>
TOOLS_HEAD=5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
```

컴파일러는 seed가 아닌 native stage2 실행 파일이었다. 해당 stage2의 소스 SHA-256은 `1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448`이다. 23·25 서버, 금지된 프로젝트, sudo, `/etc`, seed 변경, force-push는 사용하지 않았다. 부하 및 bootstrap 실행 전 `ps` 확인 후 `flock -o <가림>`으로 순차 실행했다. bootstrap은 strace 없이 1회 수행했다.

## 도구 준비 및 무효 설정 회차

fresh clone에는 고정 commit의 소스만 있고 native 생성물은 없다. `docs/TOOLS-SETUP.md`에 fresh clone, native stage2 compiler, `detect-core-native`, workflow 6종, `test-result-native`, `test-plan-native`, `tester-runner-native`, `script-check-native`, `arity-check-native` 준비 절차와 사전 확인 절차를 적었다. 생성물은 pinned 도구 clone의 untracked native 실행 파일이며 도구 HEAD는 계속 `5bbfb771e5f9c83f0b9664e306ff143a0a2b556c`였다. tools 자체 시험은 `FL_TEST_SUMMARY total=41 passed=41 failed=0 not_run=0`, `FREELANG_TEST=PASS`였다.

준비가 완성되기 전의 V-5 첫 실행은 사용자가 무효 설정으로 지정한 회차로만 보관했다. V-6 설정을 바로잡은 뒤에도 첫 full은 필요한 native 생성물 누락이 드러나 설정/준비 오류로 분류했으며 지정 회차 수에는 포함하지 않았다.

```text
LOAD_FAST_SUITE_RC=127
<가림>/scripts/fl-native-test-plan: line 7: <가림>/scripts/test-plan-native: No such file or directory
TASK942_LEGACY_RC=1
TASK942_POOL_RC=0
TASK946_FAST_SUMMARY=1/2
TASK946_RC=2
```

빠진 `test-plan-native`를 native stage2로 생성하고 pinned HEAD 및 실행 파일을 재확인했다. 이후 아래의 유효 full 2회와 독립 시험은 모두 같은 설정으로 수행했다.

## LOAD2 FD 및 좀비 검사 변경

### LOAD2 FD

계측 변경 위치는 `tests/run-task938-load.sh:175-245, 363-368`이다. SQLite main/WAL 파일을 가리키는 FD는 안정성 합계에서 제외하며, 나머지 FD와 기존 허용폭 `±1`은 유지했다. 측정 대상만 바뀌었고 임계값은 바꾸지 않았다.

유효 full과 독립 LOAD2에서 확인한 제어 결과:

```text
LOAD_FD_DB_TURNOVER_DELTA=0
LOAD_FD_DB_TURNOVER_STABLE=0
LOAD_FD_LEAK_DELTA=2
LOAD_FD_LEAK_CONTROL_DETECTED=1
```

정상 turnover는 0으로 안정, 의도적으로 열어 둔 일반 FD 두 개는 기존 ±1 판정에서 누수로 검출됐다. 기존 방식 참고값은 V-3의 `LOAD_RESOURCE_START ... fd=48`, `LOAD_RESOURCE_END ... fd=46`, `LOAD_RESOURCE_STABLE=0`이다. V-3에서 사라진 두 핸들은 worker 교체 때 닫힌 SQLite main/WAL FD로 확인됐다.

### pool 1 zombie 범위

검사 위치는 `tests/run-task931.sh:4-5, 17-27, 29-43`이다. V-5 이전에는 13-35행의 부모-자식 트리만 따라가므로 부모가 종료되어 재부모화된 zombie를 놓칠 수 있었다. 현재는 `setsid`로 시험을 별도 세션/프로세스 그룹에서 시작하고, 같은 SID와 PGID를 모두 가진 프로세스의 zombie를 센다. 기대값 `0`은 그대로다.

부모가 먼저 끝나는 orphan zombie 제어 결과와 정상 종료 결과:

```text
ORPHAN_ZOMBIE_PROCESS_TREE_DELTA=0
ORPHAN_ZOMBIE_SESSION_DELTA=1
ORPHAN_ZOMBIE_CONTROL_EXPECTED_FAIL=1
ORPHAN_ZOMBIE_CONTROL_DETECTED=1
ORPHAN_ZOMBIE_NORMAL_COUNT=0
ZOMBIE_COUNT=0
ZOMBIE_BASELINE=0 ZOMBIE_DELTA=0
TEST_TREE_ZOMBIE_COUNT=0
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=9/9
```

따라서 기존 트리 검사는 이 제어에서 놓치고(0), 새 세션·그룹 검사는 orphan zombie 1개를 실패 조건으로 검출했다. 회수 후 정상값 0과 정규 pool 1 시험은 통과했다.

## 유효 시험 결과

### 전체 시험 2회

| 유효 회차 | RC | 전체 요약 | legacy | pool | LOAD2 | CAP |
|---|---:|---|---:|---:|---|---|
| 1 (`valid-full-2`) | `TASK946_RC=0` | `TASK946_FAST_SUMMARY=2/2` | `TASK942_LEGACY_RC=0` | `TASK942_POOL_RC=0`, `POOL_SUMMARY=8/8` | `LOAD2_SUMMARY=10/10` | `CAP_SUMMARY=6/6` |
| 2 (`valid-full-3`) | `TASK946_RC=0` | `TASK946_FAST_SUMMARY=2/2` | `TASK942_LEGACY_RC=0` | `TASK942_POOL_RC=0`, `POOL_SUMMARY=8/8` | `LOAD2_SUMMARY=10/10` | `CAP_SUMMARY=6/6` |

각 유효 회차의 FD 계측 출력은 `LOAD_FD_DB_TURNOVER_DELTA=0`, `LOAD_FD_DB_TURNOVER_STABLE=0`, `LOAD_FD_LEAK_DELTA=2`, `LOAD_FD_LEAK_CONTROL_DETECTED=1`이다. 제한 FD 제어는 원문 `FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)`로 실패 예상 조건을 만들었고, 이어진 복구 및 OOM 검사는 통과했다.

첫 설정 오류 회차의 1/2 요약은 위 준비 오류 로그에 보존했으며 유효 시험 수에는 포함하지 않았다.

### 독립 LOAD2 2회

두 회차 모두 `FL_HTTP_SKIP_FAST=1`로 빠른 BASE 반복을 제외하고 LOAD2/FDFIX/OOM/CAP 본 항목을 실행했다.

| 회차 | RC | 결과 |
|---|---:|---|
| 1 (`standalone-load-1`) | `LOAD2_RUN1_RC=0` | `LOAD2_SUMMARY=10/10`, `CAP_SUMMARY=6/6`, `OOM_SUMMARY=12/12`, `FORKFAIL_SUMMARY=9/9` |
| 2 (`standalone-load-2`) | `LOAD2_RUN2_RC=0` | `LOAD2_SUMMARY=10/10`, `CAP_SUMMARY=6/6`, `OOM_SUMMARY=12/12`, `FORKFAIL_SUMMARY=9/9` |

### 독립 pool 및 bootstrap

독립 pool:

```text
POOL_RUN_RC=0
POOL_CHECK_LOAD2=1/1
POOL_CHECK_CAP=1/1
POOL_CHECK_KILL_RESTART=1/1
POOL_CHECK_ROTATION=1/1
POOL_CHECK_ZOMBIE=1/1
POOL_CHECK_RESOURCES=1/1
POOL_CHECK_DB_ACK=1/1
POOL_CHECK_HTTP_SECURITY=1/1
POOL_SUMMARY=8/8
POOL_CHILDREN_AFTER_STOP=0
POOL_WORKERS_ALIVE_AFTER_STOP=0
```

native fixed-point bootstrap은 strace 없이 1회 실행했다. stage 2/3/4의 SHA-256 원문은 모두 `1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448`이며 `CMP_2_3=0`, `CMP_3_4=0`, `NATIVE_FIXED_POINT=PASS`, `NATIVE_BOOTSTRAP_RC=0`이다. 실행 수는 bootstrap에 strace를 쓰지 말라는 규칙에 따라 이번 회차에서 새로 계측하지 않았다. V-1의 trace는 `NODE_EXEC_COUNT=0`, `NPM_EXEC_COUNT=0`, `NPX_EXEC_COUNT=0`, `JS_EXEC_COUNT=0`, `PYTHON_EXEC_COUNT=0`이었다. V-6에서 새 JS/TS/Python 파일은 만들거나 실행하지 않았다.

## V-1부터 V-6까지 실패 항목과 현재 판정

| 지시서 | 과거 실패/미완료와 원인 | 조치 | 현재 결과 |
|---|---|---|---|
| V-1 | seed 비교와 CAP 20/20은 통과. 전체·LOAD2는 도구 환경 때문에 실패했고 pool 1/6은 미통과 | pinned native 도구 준비, LOAD2 FD 측정 수정, pool 검사 범위 보완 | 과거 seed `SEED_CMP_RC=0`, CAP `20/20`; 이번 full 2회·LOAD2 2회·pool은 모두 통과 |
| V-2 | fresh clone에서 도구 생성물/환경 차이로 full·LOAD2 실패, pool zombie/FD 증거 부족 | 생성물 목록을 확인해 native 준비 문서 작성; 범위 및 FD 측정 증거 추가 | 설정 누락 회차는 분리 기록, 유효 full·LOAD2·pool 통과 |
| V-3 | 도구 준비 누락, pool 1 전역/트리 범위 문제, worker 종료 시 FD 감소 | 도구를 pin; 사용자 승인 범위대로 세션·PGID 검사; SQLite main/WAL FD 제외 | orphan zombie 1개 검출, 정상 zombie 0; turnover 안정 및 누수 제어 검출 |
| V-4 | pool 1 검사 범위 축소는 통과했으나 FD/tool 재시험 미완료 | 범위를 세션과 프로세스 그룹의 교집합으로 확장해 고아 zombie를 포함; 도구 생성 절차 추가 | pool 1 정상 통과; pool 전체 `8/8` |
| V-5 | stage2 대신 seed 전달 및 도구 생성물 누락으로 준비 완료 시험에 도달하지 못함 | stage2 compiler와 도구 HEAD를 사전 출력하고 native 생성물 확인 절차 추가 | 무효 V-5 설정 오류를 제외한 유효 full 2회·LOAD2 2회 통과 |
| V-6 | 첫 V-6 full은 `test-plan-native` 누락으로 `TASK946_FAST_SUMMARY=1/2` | pinned 소스에서 native 생성 후 실행 파일/HEAD 재확인 | full 2/2, LOAD2 2회 10/10, pool 8/8, bootstrap 고정점 통과 |

기존 실패의 원인은 **시험 환경/준비 오류와 시험 도구 계측 범위**로 확정됐다. 이번 유효 실행에서 언어 컴파일러 결함을 보여주는 실패는 없었다. LOAD2 FD 변경과 pool zombie 범위 변경은 시험 도구 수정이며 언어 runtime/compiler 변경은 없다. 후속 조치는 `docs/TOOLS-SETUP.md`의 준비·사전 확인 절차를 따르고, native 생성물 누락 때 본 시험을 시작하지 않는 것이다. 코드는 추가로 고치지 않았다.

모든 유효 재시험이 통과해 **D-12 닫기 재판정 가능**이다. V-1..V-5 과거 점수는 원보고서 값(`3/5`, `4/5`, `4/4`, `5/5`, `1/5`) 그대로이며, V-3의 마지막 줄은 원문에서 `V3_SUMMARY 4/4`로 `=`가 빠져 있었다.

V6_SUMMARY 6/6
