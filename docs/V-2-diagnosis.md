# V-2 D-12 재현 실패 원인 진단

접수번호: RUN-20261102-03 / 창: 코1

- 새 clone 시작 브랜치: `recheck-v1`
- 시작 HEAD: `5f8aa28bd18c93085337d7f617150109e8f0cc99`
- 시험 대상: `db-stability` / `963632add97cb0534a04d4707956ffe45d9e7e0e`
- 최초 확인: `CLEAN=1`
- 새 clone, D-12 작업본, V-1 원본 로그 위치: 각각 `<가림>`
- 조사 시점: 2026-11-02 UTC. V-1 시험은 2026-11-01 UTC 기록을 분석했다.

이번 조사는 기존 로그·소스·현재 작업 환경을 읽고 경로 해석만 확인했다. 무거운 시험 재실행과 추가 strace는 0회다. 소스·seed·기대값·임계값·제한시간을 수정하지 않았다. 23·25 서버 접속/실행, sudo, 시스템 설정 수정, force-push, erp·grok-router·test11-hello 변경은 없었다. 수정안은 제안만 한다.

## 결론과 증거 범위

전체 시험과 별도 LOAD2 종료 코드의 원인 분류는 **환경 차이**다. D-12 작업본에는 기본 경로의 외부 `freelang-tools` 저장소가 있고 새 clone에는 없다. 같은 v11 소스와 seed를 사용해도 선행 quick 시험이 시작되지 않아 RC 1이 전파된다.

pool 1회차의 직접 실패 조건은 전역 zombie 증가이며 **시험 불안정**으로 분류한다. pool 6회차의 직접 실패 조건은 FD 48→46이지만, FD가 감소한 세부 원인은 **모름**이다. 따라서 전체 실패를 D-12 HTTP 런타임 수정의 회귀나 단일 코드 결함으로 판정하지 않는다.

과거에 수집하지 않은 실패 순간 ps·개별 FD 목록·포트 점유표를 현재 값으로 대체하지 않았다. 이 한계 때문에 판정 3번은 부분 확인이며 점수를 주지 않는다.

## 1. 전체 시험 2회: 첫 실패 항목·원문·RC

두 회차의 최초 실패는 `run-task920.sh` 5행의 기본 도구 루트 해석이다. 호출 순서는 TASK946 → legacy LOAD2 → TASK920이며, 원문 첫 줄이 다음 오류다.

```text
<가림>: line 5: cd: <가림>: No such file or directory
```

첫 번째 가림은 시험 스크립트 위치, 두 번째는 존재하지 않는 기본 도구 디렉터리다.

| 회차 | 첫 실패 | TASK920 RC | legacy RC | pool RC | 전체 RC | 최상위 요약 |
|---:|---|---:|---:|---:|---:|---|
| 1 | 기본 도구 루트 cd | 1 | 1 | 0 | 1 | TASK946_FAST_SUMMARY=1/2 |
| 2 | 기본 도구 루트 cd | 1 | 1 | 0 | 1 | TASK946_FAST_SUMMARY=1/2 |

TASK920 RC 1은 `set -Eeuo pipefail`에서 실패한 5행 대입과 다음 절의 BASE_RC 저장 경로로 확인했다. 전체 RC와 legacy/pool RC는 보관 로그·RC 파일의 값이다.

### 1회차: base 오류 로그 첫 20줄

```text
<가림>: line 5: cd: <가림>: No such file or directory
CASE=vector RC=71 SIGNAL=0 ERROR=FreeLang runtime: out of memory
CASE=string RC=71 SIGNAL=0 ERROR=FreeLang runtime: out of memory
CASE=json RC=71 SIGNAL=0 ERROR=FreeLang runtime: out of memory
PARALLEL_MODE=isolated
PARALLEL_USER_PROCESS_COUNT=1
PARALLEL_USER_TASK_COUNT=1
PARALLEL_ULIMIT_U=6
PARALLEL_EFFECTIVE_ULIMIT_U=6
CASE=process-limit-run-parallel-isolated-or-main RC=0 SIGNAL=0 FAILED_SLOTS=6 SUCCESSFUL_SLOTS=14 ERROR=E_RUN_PARALLEL_FORK
CASE=process-limit-run-parallel RC=0 SIGNAL=0 FAILED_SLOTS=6 SUCCESSFUL_SLOTS=14 ERROR=E_RUN_PARALLEL_FORK
SLOT0=1
SLOT1=2
SLOT2=3
SLOT3=4
SLOT4=5
SLOT5={"_tag":"Error","code":"E_RUN_PARALLEL_FORK"}
SLOT6={"_tag":"Error","code":"E_RUN_PARALLEL_FORK"}
SLOT7={"_tag":"Error","code":"E_RUN_PARALLEL_FORK"}
SLOT8=9
```

### 2회차: base 오류 로그 첫 20줄

```text
<가림>: line 5: cd: <가림>: No such file or directory
CASE=vector RC=71 SIGNAL=0 ERROR=FreeLang runtime: out of memory
CASE=string RC=71 SIGNAL=0 ERROR=FreeLang runtime: out of memory
CASE=json RC=71 SIGNAL=0 ERROR=FreeLang runtime: out of memory
PARALLEL_MODE=isolated
PARALLEL_USER_PROCESS_COUNT=1
PARALLEL_USER_TASK_COUNT=1
PARALLEL_ULIMIT_U=6
PARALLEL_EFFECTIVE_ULIMIT_U=6
CASE=process-limit-run-parallel-isolated-or-main RC=0 SIGNAL=0 FAILED_SLOTS=6 SUCCESSFUL_SLOTS=14 ERROR=E_RUN_PARALLEL_FORK
CASE=process-limit-run-parallel RC=0 SIGNAL=0 FAILED_SLOTS=6 SUCCESSFUL_SLOTS=14 ERROR=E_RUN_PARALLEL_FORK
SLOT0=1
SLOT1=2
SLOT2=3
SLOT3=4
SLOT4=5
SLOT5={"_tag":"Error","code":"E_RUN_PARALLEL_FORK"}
SLOT6={"_tag":"Error","code":"E_RUN_PARALLEL_FORK"}
SLOT7={"_tag":"Error","code":"E_RUN_PARALLEL_FORK"}
SLOT8=9
```

실제 도구 경로 오류는 각 블록의 첫 줄이다. 이후 행은 base 로그에 이어 붙인 OOM/fork 시험 출력이며, RC 71과 `E_RUN_PARALLEL_FORK`는 의도한 오류 주입 결과다. 이를 별도의 최초 실패로 세지 않았다.

`run-task920.sh` 2·5행 원문:

```bash
set -Eeuo pipefail
TOOLS="${FL_TOOLS_ROOT:-$(cd -- "$ROOT/../freelang-tools" && pwd -P)}"
```

기본 경로 해석 구문만 FL_TOOLS_ROOT 미설정 조건에서 검사한 결과:

| 작업 위치 | 경로 해석·도구 실행 파일 존재 검사 RC |
|---|---:|
| D-12 작업본 | 0 |
| V-1 새 clone | 1 |
| V-2 새 clone | 1 |

실행 파일 자체를 실행하거나 의존성을 설치하지 않았다. 현재 공통 셸의 `FL_TOOLS_ROOT`는 미설정이었다. V-1 당시 값은 미설정 또는 빈 문자열이었음이 기본 경로 cd 오류로 확인된다. D-12 당시 정확한 환경 변수 값은 보관되지 않았다.

## 2. LOAD2 10/10인데 RC 1인 정확한 검사

`run-task938-load.sh` 15–20행 원문:

```bash
BASE_RC=0
if [[ "${FL_HTTP_SKIP_FAST:-0}" != 1 ]]; then
  export FREELANG_HTTP_CGC="$COMPILER"
  bash "$ROOT/tests/run-task920.sh" "$COMPILER" "$WORK/base" >"$WORK/base.log" 2>&1 || BASE_RC=$?
  bash "$ROOT/tests/run-task931.sh" "$COMPILER" "$WORK/oom-suite" >"$WORK/oom-suite.log" 2>&1 || BASE_RC=$?
  cat "$WORK/oom-suite.log" >>"$WORK/base.log"
```

18행에서 도구 경로 오류의 RC 1을 BASE_RC에 저장한다. 뒤의 OOM 시험이 성공해도 19행의 `|| BASE_RC=$?`는 실행되지 않아 BASE_RC가 1로 남는다.

342–343행 원문:

```bash
printf 'LOAD2_SUMMARY=%s/10\n' "$SUMMARY" | tee "$WORK/final-summary.log"
test "$SUMMARY" -ge 9 && test "$BASE_RC" -eq 0
```

10/10을 출력한 뒤 `test "$BASE_RC" -eq 0`에 1이 들어가 실패한다. 이 검사가 AND 목록의 마지막 명령이므로 `set -e`에 의해 RC 1로 종료한다. 부하 10개 항목과 선행 quick 시험의 성공 여부는 별도 조건이다.

10회 원본 요약과 보관 RC를 함께 집계한 값:

```text
LOAD2_RUN=1 RC=1 LOAD_FAST_SUITE_RC=1 LOAD2_SUMMARY=10/10
LOAD2_RUN=2 RC=1 LOAD_FAST_SUITE_RC=1 LOAD2_SUMMARY=10/10
LOAD2_RUN=3 RC=1 LOAD_FAST_SUITE_RC=1 LOAD2_SUMMARY=10/10
LOAD2_RUN=4 RC=1 LOAD_FAST_SUITE_RC=1 LOAD2_SUMMARY=10/10
LOAD2_RUN=5 RC=1 LOAD_FAST_SUITE_RC=1 LOAD2_SUMMARY=10/10
LOAD2_RUN=6 RC=1 LOAD_FAST_SUITE_RC=1 LOAD2_SUMMARY=10/10
LOAD2_RUN=7 RC=1 LOAD_FAST_SUITE_RC=1 LOAD2_SUMMARY=10/10
LOAD2_RUN=8 RC=1 LOAD_FAST_SUITE_RC=1 LOAD2_SUMMARY=10/10
LOAD2_RUN=9 RC=1 LOAD_FAST_SUITE_RC=1 LOAD2_SUMMARY=10/10
LOAD2_RUN=10 RC=1 LOAD_FAST_SUITE_RC=1 LOAD2_SUMMARY=10/10
```

`FDFIX_CASE=fd-limit RC=1`의 db-exec 오류는 FD 제한 오류 주입 시험의 기대 동작이다. 38행은 FD 한도를 4로 설정하고 46행은 RC 1을 요구한다. 이번 10회 종료 원인은 그 기대 오류가 아니라 343행의 BASE_RC 검사다. 이 지점에서 종료하므로 이후 FDFIX/CAP 최종 요약은 실행되지 않는다.

분류: **환경 차이**. 부하 10/10과 wrapper RC 1은 모순이 아니다.

## 3. pool 실패 1·6회차

회차별 보관된 명령 RC는 모두 1이다. 시작·종료 UTC 원문:

```text
BEGIN=pool-1 UTC=2026-11-01T12:04:52Z
END=pool-1 RC=1 DURATION_SEC=511 UTC=2026-11-01T12:13:23Z
BEGIN=pool-6 UTC=2026-11-01T15:15:49Z
END=pool-6 RC=1 DURATION_SEC=1059 UTC=2026-11-01T15:33:28Z
```

DURATION_SEC는 잠금 대기를 포함한 호출 경과 시간이다.

### 3-1. pool 1: 전역 zombie 검사

원본 로그의 실패 관련 행:

```text
FORKFAIL_CASE=run-parallel FAILED_SLOTS=6 SUCCESSFUL_SLOTS=14 ERROR=E_RUN_PARALLEL_FORK RC=0 SIGNAL=0 ZOMBIE_DELTA=0
FORKFAIL_CASE=http-process-limit FAILED_SLOTS=30 SUCCESSFUL_SLOTS=0 ERROR=HTTP_503 RC=0 SIGNAL=0 ZOMBIE_DELTA=0
FORKFAIL_CASE=http-recovery FAILED_SLOTS=0 SUCCESSFUL_SLOTS=1 ERROR=none RC=0 SIGNAL=0 ZOMBIE_DELTA=0
SEGV_COUNT=0
ZOMBIE_COUNT=11
ZOMBIE_BASELINE=10 ZOMBIE_DELTA=1
TEST_PARENT_ZOMBIE_COUNT=0
OOM_SUMMARY=11/12
FORKFAIL_SUMMARY=8/9
```

독립된 오류 문장은 없고 위 불통과 요약이 출력됐다. `run-task931.sh` 297–306행은 호스트 전체 zombie 수를 비원자적으로 수집하고, 부모가 시험 셸인 zombie 수를 별도로 수집한다.

```bash
zombies="$(ps -eo stat= | awk '$1 ~ /^Z/ {n++} END {print n+0}')"
zombie_delta=$((zombies - baseline_zombies))
test_zombies="$(ps -eo ppid=,stat= | awk -v p="$$" '$1 == p && $2 ~ /^Z/ {n++} END {print n+0}')"
```

305–306행은 `passed=11`에서 시작해 두 zombie 조건이 0일 때만 12로 올린다. 324–326행 원문:

```bash
test "$zombie_delta" -eq 0 && test "$test_zombies" -eq 0 && forkfail_passed=$((forkfail_passed + 1))
printf 'FORKFAIL_SUMMARY=%s/9\n' "$forkfail_passed"
test "$forkfail_passed" -eq 9
```

전역 delta 1 때문에 마지막 항목을 더하지 못해 8/9가 되고 326행에서 RC 1로 종료한다. 307행의 AND 목록은 중간 조건에서 실패하므로 그 자리에서 종료하지 않고 위 요약까지 진행한다. pool 경로는 `FL_HTTP_SKIP_FAST=1`로 LOAD2를 호출하며, LOAD2 23행은 OOM 명령 실패를 처리하지 않아 즉시 종료한다. pool의 LOAD2 호출(55–57행)도 RC 1을 받아 종료하므로 최종 POOL_SUMMARY가 없다.

실패 부근 실제 ps 출력 원문:

```text
    PID    PPID STAT COMMAND
   4285    4255 Z    python3
   4338    4326 Z    next-server (v1
   4341    4326 Z    next-server (v1
   4345    4326 Z    node
 991955  485096 Z+   chrome
1240516  485096 Z+   chrome
2491727 2491705 Z    sh
2915926  995828 Z+   chrome
3315584  995828 Z+   chrome
3519754 3293128 Zs   xdg-open
```

이 ps 행 수는 10이며 직전 `ZOMBIE_COUNT=11`과 다르다. 호출 전 ps에도 같은 10개 PID/PPID가 있었다. 원인 프로세스가 어떤 PID였는지, 시험의 자손이었는지는 이 자료로 확정할 수 없다. 시험 부모의 zombie는 0이었다. 전역 수치의 순간 변화가 성공 여부를 바꾸는 검사이므로 분류는 **시험 불안정**이다. 증가한 한 프로세스의 소속까지 규명했다는 뜻은 아니다.

열린 파일 수는 실패 순간에 보관하지 않았다. pool 1은 주 LOAD2 서버를 만들기 전에 OOM에서 종료했으므로 LOAD_RESOURCE 시작/종료 FD 합계도 없다. 종료된 현재 PID를 조회해 당시 값으로 쓰지 않았다.

OOM 단계 서버 로그의 포트 원문(주소만 가림):

```text
nproc:
HTTP_LISTENING=<가림>:35057
nofile:
HTTP_LISTENING=<가림>:37589
recovery:
HTTP_LISTENING=<가림>:34191
```

이는 각 서버가 보고한 리슨 포트다. 실패 순간 ss/lsof 점유표는 없고, 해당 서버들의 종료 후 전역 zombie를 검사한 기록이다.

### 3-2. pool 6: FD 안정 항목 → FDFIX 4/5

오류 문장 대신 다음 불통과 항목·요약이 기록됐다.

```text
LOAD_FAST_SUITE_RC=0
OOM_SUMMARY=12/12
LOAD_RESOURCE_BASELINE_SETTLED=0 fd=48
LOAD_RESOURCE_WARM_BASELINE rss_kb=37432 fd=48
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_COLD_START rss_kb=12020 fd=40
LOAD_RESOURCE_START rss_kb=33392 fd=48
LOAD_RESOURCE_END rss_kb=28064 fd=46
LOAD_RESOURCE_STABLE=0
LOAD2_SUMMARY=9/10
LOAD_ACTIVE_CONNECTIONS_MAX=4
FDFIX_SUMMARY=4/5
```

별도 OOM 로그의 fork 요약은 `FORKFAIL_SUMMARY=9/9`다. DB 정합성은 `LOAD_DB_INTEGRITY=ok`, ACK 누락·중복·잠금 오류 수는 각각 0이었다.

`run-task938-load.sh` 321행의 원문 검사:

```bash
(( FINAL_RSS <= STEADY_RSS_BASELINE + 2048 && FINAL_FD <= STEADY_FD_BASELINE + 1 && STEADY_FD_BASELINE <= FINAL_FD + 1 )) && RESOURCE_STABLE=1
```

RSS 조건과 FD 상한 조건은 통과하지만 마지막 조건은 48 <= 46 + 1이므로 거짓이다. FD 감소 2가 허용 차이 1을 벗어난다. FD는 179–198행의 server_snapshot이 서버 및 직접 자식들의 descriptor 수를 합산한 값이다.

여기서 343행은 SUMMARY 9, BASE_RC 0이라 통과한다. 345행 cleanup으로 서버 종료를 요청·대기한 뒤 359–361행을 실행한다.

```bash
grep -Fxq 'LOAD2_SUMMARY=10/10' "$WORK/final-summary.log" && FDFIX_PASSED=$((FDFIX_PASSED + 1))
printf 'FDFIX_SUMMARY=%s/5\n' "$FDFIX_PASSED"
test "$FDFIX_PASSED" -eq 5
```

9/10은 359행의 정확한 10/10 검색과 일치하지 않아 4/5가 된다. **실제 종료 검사 위치는 361행**이다. 이후 CAP 및 최종 pool 집계는 실행되지 않았다.

서버 로그 원문:

```text
HTTP_MAX_CONN=256
FL_HTTP_WORKERS=4
HTTP_LISTENING=<가림>:34491
HTTP_WORKER_STARTED slot=0 pid=2873582
HTTP_WORKER_STARTED slot=1 pid=2873583
HTTP_WORKER_STARTED slot=2 pid=2873584
HTTP_WORKER_STARTED slot=3 pid=2873585
```

위 PID는 최초 워커 시작 기록이며, 이후 회전이 있어 실패 순간 워커 명단으로 사용할 수 없다. 실패 순간의 개별 FD 목록과 ss/lsof 점유표는 보관되지 않았다. 48→46의 descriptor 종류·프로세스별 차이를 복원할 수 없어 근본 원인 분류는 **모름**이다. 측정 시점 또는 워커 회전 영향은 가설로만 남긴다.

### 3-3. 당시 자료의 유무

| 자료 | pool 1 | pool 6 |
|---|---|---|
| 사전 ps UTC | 2026-11-01T12:04:52Z | 2026-11-01T15:15:49Z |
| 사전 ps 전체 프로세스 행 수 | 1153 | 1130 |
| 사전 ps zombie 행 수 | 10 | 10 |
| 사전 ps의 flock 행 수 | 1 | 3 |
| 실패 부근 ps | zombie 명단 10행 보존 | 미수집 |
| 서버·자식 FD 합계 | 미수집 | 자원 스냅샷 48→46 |
| 실패 순간 개별 열린 파일 목록 | 미수집 | 미수집 |
| 서버 보고 리슨 포트 | 35057 / 37589 / 34191 | 34491 |
| 실패 순간 포트 점유표 | 미수집 | 미수집 |

사전 ps는 flock 획득 전 기록이다. 사전 목록의 flock이 잠금 보유자인지 대기자인지, 실패 순간에도 살아 있었는지 확인할 자료가 없으므로 다른 부하와 겹쳤다고 단정하지 않는다. FD 자원 스냅샷 시점과 프로그램 종료 검사 시점도 구분한다.

## 4. 환경 비교표

D-12 작업본은 현재도 대상 HEAD이고 tracked 변경은 0이다. 다만 현재 작업본 관찰이 D-12 실행 당시 환경의 완전한 스냅샷은 아니다. D-12 과거 통과 결과는 기존 D-12 문서 기록이며 이번에 재실행하지 않았다.

| 비교 항목 | D-12 작업 환경 | V-1 새 clone / V-2 확인 | 근거·한계 |
|---|---|---|---|
| v11 소스 | 대상 HEAD 963632add97cb0534a04d4707956ffe45d9e7e0e | V-1 시험 대상도 동일, V-2 시작 HEAD 5f8aa28bd18c93085337d7f617150109e8f0cc99 | runtime/tests/self/bin tree 동일 |
| seed SHA-256 | 36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2 | V-1·V-2도 같은 해시 | 읽기 전용 해시 확인 |
| 기본 외부 도구 저장소 | 현재 작업본의 기본 형제 위치에 존재 | V-1·V-2 기본 위치에 없음 | 경로 해석 RC 0 / 1 / 1 |
| 외부 도구 버전 | 현재 HEAD 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c | v11 단독 clone에 포함되지 않음 | 별도 저장소 의존 |
| 도구 실행 파일 | cgc-native, fl-cgc-run 존재·실행 권한 있음 | 기본 위치에 없음 | 첫 quick 실패의 직접 원인 |
| 무시된 파일 | 현재 0개 | V-1 0개, V-2 최초 0개 | git ignored 파일 목록 집계 |
| 미추적 파일 | 현재 0개 | V-1 0개, V-2 보고서 작성 전 0개 | 보고서는 이후 추가 |
| 생성물 | 외부 도구 저장소의 tracked 네이티브 실행 파일 있음; D-12 당시 임시 생성물 목록은 미확보 | V-1 stage2 생성물은 저장소 밖에 보관; 기본 외부 도구는 없음 | v11 seed와 외부 도구 바이너리를 구분 |
| 저장소 내부 남은 lock/pid | 현재 0개 | V-1·V-2 각각 0개 | git 메타데이터 제외, *.lock / *.pid 파일 검사 |
| 공용 heavy 잠금 | 과거 문서에 flock 사용 기록 | V-1은 잠금 대기를 포함해 실행; V-2 관찰 중 공용 잠금 파일 존재, 보유 기록 1개 관측 | 파일 존재와 잠금 보유는 별개, 시간에 따라 변함 |
| Git core 설정 | filemode=true, bare=false, logallrefupdates=true, ignorecase=UNSET | V-1·V-2도 동일 | URL 값은 열람·출력하지 않음 |
| 환경 설정 파일 | 현재 검사 범위의 .env* 파일 0개 | V-1·V-2 각각 0개 | 저장소 2단계 깊이 검사, 비밀값 열람 없음 |
| FL_TOOLS_ROOT | 당시 값 미보관, 현재 공통 셸은 미설정 | V-1 오류는 기본 해석을 탔음을 증명; V-2 현재 미설정 | 과거 D-12 값을 추정해 쓰지 않음 |
| 호스트 한도 | 당시 전역 값 미보관 | V-1 당시 전역 값 미보관; V-2 현재 nofile=524288, nproc=770499, vmem=unlimited | 현재 공통 셸 값이며 과거 값 대체 불가 |
| 시험 내부 한도 | 동일 스크립트의 오류 주입 조건 | isolated tasks=1, nproc limit=6; fd-limit=4 | intentional limit 오류는 기대 결과 |
| 동시 실행 프로세스 | D-12 문서에 실행 전 다른 heavy 시험 없음을 기록; 원본 ps 미확보 | V-1 사전 ps는 위 표; V-2 03:47:35 UTC 관찰에서 사용자 프로세스 240, 사용자 태스크 3902 | 서로 다른 시점·집계 범위 |
| 포트 사용 | D-12 전체 시험 당시 점유표 미확보 | V-1 실패 포트는 위 표; V-2 현재 리슨 행 수 80 | 현재 포트 사용을 과거 실패 원인으로 대입하지 않음 |
| CAP 복구 | D-12 수정 후 20/20 통과 기록 | V-1도 20/20 통과 | 이번 실패 항목은 CAP recovery 503과 다름 |
| 전체·pool 결과 | D-12 문서에 전체 2/2, pool 8/8 기록 | V-1 전체 2회 실패; 별도 pool 6/8 통과 | 새 환경에서 확인된 차이를 그대로 유지 |

도구 실행 파일의 현재 SHA-256:

```text
cgc-native:
b9681984c7b92d581da56bf73af84053817efc5a618192ab5c9586a58c91e814
fl-cgc-run:
55321a11271135b3c27bc1a4e6cd393e6a812de5b208db47884afb7c0e5cd16c
```

cgc-native는 외부 도구 저장소의 tracked 파일임을 확인했다. v11 작업본의 무시 파일이 우연히 남아 있어서만 통과한 것으로 단정할 근거는 없다. 확인된 차이는 **v11 저장소 밖의 기본 도구 의존성 유무**다.

## 5. 원인 판정 및 수정 제안 — 실행하지 않음

| 문제 | 분류 | 확정한 범위 |
|---|---|---|
| 전체 시험 2회 | 환경 차이 | 기본 외부 도구 루트 없음 → TASK920 5행 실패 |
| LOAD2 10/10의 RC 1 | 환경 차이 | BASE_RC=1 유지 → LOAD2 343행 종료 |
| pool 1 | 시험 불안정 | 전역 zombie delta 1 → fork 8/9 → 326행 종료; 증가 PID 소속은 미확정 |
| pool 6 | 모름 | FD 48→46 → LOAD2 9/10 → FDFIX 4/5 → 361행 종료; FD 구성 변화 원인은 미확정 |

D-12 작업본과 단독 clone의 전체 시험 결과 차이에 대한 대표 판정은 **환경 차이**다. pool 두 실패까지 같은 원인으로 묶지 않는다. 이번 증거에서 확정한 런타임 코드 결함은 없다.

제안만 기록한다.

1. 시험 준비 문서에 외부 도구 저장소·버전을 명시하고, 실행 전 FL_TOOLS_ROOT와 필요한 실행 파일을 검사해 첫 실패를 분명히 표시한다.
2. 출력에서 부하 10개 항목 요약과 선행 quick RC를 별도 성공 조건으로 표시한다.
3. zombie는 해당 시험의 프로세스 계보·격리 범위를 함께 기록하고, FD는 동일 PID 집합의 descriptor 종류를 시작·종료에 보관한다. 기존 기대값·임계값은 유지한 채 원인을 조사한다.
4. cleanup 전에 ps·FD 목록·포트 점유표를 한 번에 수집하는 실패 증거 경로를 검토한다. 현재 시험에는 추가하지 않았다.

## 6. 원본 증거 식별 및 무결성

원본 위치는 모두 `<가림>`이다. 아래 ID는 보고서용 식별명이며 실제 경로가 아니다. 해시는 가림 처리 전 원본 로그의 SHA-256이다.

| ID | 원본 내용 | SHA-256 |
|---|---|---|
| A1 | 전체 1 base 오류 로그 | 4f047fdc285e67407d417fd0168677d69843c58546e9754cbaab16d8bbea3971 |
| A2 | 전체 2 base 오류 로그 | a9f3c8b431d59fe1f60823e69bcc6ede996fe54b2718b3a44f08ca8ba1332c59 |
| P1-pre | pool 1 사전 ps | e1715f775e012b3e6978254f643b2ce94a5b5c7b77f5f0508554ad04cc1f9017 |
| P1-oom | pool 1 내부 OOM 로그 | a838549bcdf20dc5eb4bf23ed7eade5fb04ace0361b8d452475378e51543334b |
| P6-pre | pool 6 사전 ps | 773ac140d3d5c445d8bf5d09fbc89400519116acba8e901e11afe059b85169dd |
| P6-load | pool 6 내부 LOAD2 로그 | a94d4c6cf561728340b9e77559dcc09234eaab119d215bfaf180bd7d5cb576d4 |
| P6-server | pool 6 서버 로그 | 1731d7aec47758a524fa88062c3986c9469af69852d5c3b8a2de5bb303ddd519 |

## 7. 판정 5칸 및 전달

| 칸 | 판정 | 이유 |
|---:|---|---|
| 1 전체 시험 원인 | 통과 | 첫 실패·20줄·RC·기본 의존성 차이 확인 |
| 2 LOAD2 종료 코드 원인 | 통과 | 18행 저장 및 343행 실패 검사 확인 |
| 3 pool 실패 원인 | 부분 확인·미통과 | 직접 실패 조건 확인, FD 구성 원인 및 당시 FD/포트 점유표 미확보 |
| 4 환경 비교표 | 통과 | 현재 관찰·과거 기록·미수집 값을 구분해 작성 |
| 5 Forgejo→GitHub 및 원격 HEAD 일치 | 대기 | 첫 보고서 전달 후 실제 두 ref 확인 결과로 갱신 |

이 보고서만 커밋한다. 커밋 전 민감정보 diff를 검사하고 Forgejo 먼저, GitHub 다음으로 recheck-v1만 push한다. 소스·다른 보고서와 db-stability 브랜치는 변경하지 않는다.

V2_SUMMARY=3/5
