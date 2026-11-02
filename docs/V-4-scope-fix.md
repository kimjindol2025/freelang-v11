# V-4 pool 좀비 검사 범위 변경과 잔여 원인

접수번호: RUN-20261102-08 / 담당: 코1

- 기준 `recheck-v1` HEAD: `54ffb895cdb66205ca9ef3758c87c7b26243e46a`
- 대상 `db-stability` HEAD: `963632add97cb0534a04d4707956ffe45d9e7e0e`
- 새 복제본 시작 상태: `recheck-v1`, HEAD `54ffb895cdb66205ca9ef3758c87c7b26243e46a`, CLEAN=1
- V-4 변경 파일: `tests/run-task931.sh`의 좀비 관측 범위만 변경. 예상 좀비 수 0은 유지했다.
- 보고서 경로 및 시험 로그 경로: `<가림>`
- 서버 23·25 금지 준수. erp·grok-router·test11-hello 미접촉. sudo, `/etc`, force-push, seed 교체, 외부 도구 준비·설치, strace 사용은 없었다.

## 결과 요약 및 판정표

| 항목 | 원인 및 결과 | 증거 | 다음 조치 |
|---|---|---|---|
| pool 1 좀비 | 과거 불안정은 호스트 전체 zombie delta를 세던 범위 문제. 승인된 범위 수정 뒤 3회 전체 pool 진입 모두 RC 0, `POOL_SUMMARY=8/8`; OOM `12/12`, fork `9/9` | `tests/run-task931.sh:13-36,157,283,315-330`; 3회별 pool/OOM 로그와 ps | 코드: 이 범위 변경만 유지. 전역 count는 통과 판정에 다시 사용하지 않음 |
| 외부 도구/전체·LOAD2 | 환경 차이: `freelang-tools` 형제 저장소 부재가 quick BASE_RC로 전파됨. native D-12 준비 절차·버전 pin 문서를 찾지 못함 | `run-task920.sh:5`; `run-task938-load.sh:18-19,343`; 외부 README/docs 검색 | 환경: 필요한 clone URL/버전 pin/준비·검증 절차 문서화 후 재시험. 문서가 없어 이번 시험은 준비 단계에서 중단 |
| pool 6 FD 48→46 | 시험 코드의 상태 민감성: 1000-request worker rotation이 작업자 SQLite main/WAL FD를 닫음. LOAD2 안정 기준에서 실패. 언어 결함 증거 없음 | V-3 재현 `000696.fd`/`000697.fd`, ss, worker 로그; `run-task938-load.sh:179-198,321`; `db.c:87-102`, `http_server.c:301,304-308,328-344` | 질문: 승인 범위 밖 LOAD2 측정 코드 변경을 별도 검토할지 결정. 이번에 수정하지 않음 |
| V-3 점수 | V-3 문서 끝줄의 기록 점수는 `V3_SUMMARY 4/4` | `docs/V-3-root-cause.md` | 보고서 기록으로 완료 |

## 1. 승인된 pool 1 좀비 검사 범위 변경

변경 전 `tests/run-task931.sh`는 baseline과 세 중간/마지막 관측에서 `ps -eo stat=`의 **호스트 전체** zombie 수를 세었다. 구체적으로 이전 13행, 134행, 260행, 292행, 297행이 전역 집계였다. 299행은 별도로 현재 검사 셸의 **직접 자식만** 세었고 손자 프로세스는 포함하지 않았다. 두 검사가 통과 조건에 같이 걸려 있었다.

변경 후 `tests/run-task931.sh:13-36`의 `test_tree_snapshot`이 현재 시험 셸 PID(`$$`)를 root로 삼아 `ps -eo pid=,ppid=,stat=,comm=`의 부모-자식 관계를 반복 확장해 시험 프로세스와 모든 현재 descendant 행을 모은다. `test_tree_zombies`는 그 범위에서만 `STAT`가 `Z`로 시작하는 행을 센다. baseline 36행, 중간 검사 157·283·315행, 마지막 검사 320행이 모두 같은 범위 집계를 쓴다. 결과 출력은 `TEST_TREE_ZOMBIE_COUNT`로 범위를 명시하고 raw zombie 목록도 같은 프로세스 트리로 한정한다.

**기대값은 바꾸지 않았다.** 모든 delta 및 count 검사는 기존처럼 0이어야 한다(`:160,286,318,329-330`). 허용치, 제한시간, fork/OOM 입력, seed도 바꾸지 않았다. 변경 diff는 `tests/run-task931.sh`에만 있고, `bash -n tests/run-task931.sh`는 RC 0이었다.

### 현재 전역 방식의 참고 결과

범위 변경 전 기록은 새 계측 결과로 덮어쓰지 않았다.

V-1 pool 1 원문:

```text
ZOMBIE_COUNT=11
ZOMBIE_BASELINE=10 ZOMBIE_DELTA=1
TEST_PARENT_ZOMBIE_COUNT=0
OOM_SUMMARY=11/12
FORKFAIL_SUMMARY=8/9
```

V-3에서 전체 host zombie 수를 세던 독립 확인 원문:

```text
OOM_BEFORE_ZOMBIES=14
OOM_AFTER_ZOMBIES=14
ZOMBIE_BASELINE=14 ZOMBIE_DELTA=0
TEST_PARENT_ZOMBIE_COUNT=0
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=9/9
```

다른 V-3 관측은 선행 전체-count 검사에서 `FORKFAIL_CASE=run-parallel ... ZOMBIE_DELTA=-1`로 끝났다. 즉 전역 수는 시험 동안 늘거나 줄 수 있었다. 아래 V-4 pool 3회에서 실행 전후 global ps zombie 수는 각각 14/14였지만, 새 코드의 시험 트리 baseline/current는 0/0이었다. global count는 참고 기록일 뿐 V-4 통과 조건에 사용하지 않았다.

### OOM 검사 단독 확인 3회

전체 pool 실행에 앞서 변경된 `run-task931.sh`를 직접 3회 호출했다. 각 실행 전후 ps를 저장했고 세 번 모두 RC `0`이었다. 아래 요약 문자열은 각 OOM log의 원문이며 empty tree raw 목록에는 header만 있었다.

```text
OOM_CHECK_RUN=1 RC=0
FORKFAIL_CASE=run-parallel FAILED_SLOTS=6 SUCCESSFUL_SLOTS=14 ERROR=E_RUN_PARALLEL_FORK RC=0 SIGNAL=0 ZOMBIE_DELTA=0
FORKFAIL_CASE=http-process-limit FAILED_SLOTS=30 SUCCESSFUL_SLOTS=0 ERROR=HTTP_503 RC=0 SIGNAL=0 ZOMBIE_DELTA=0
FORKFAIL_CASE=http-recovery FAILED_SLOTS=0 SUCCESSFUL_SLOTS=1 ERROR=none RC=0 SIGNAL=0 ZOMBIE_DELTA=0
SEGV_COUNT=0
ZOMBIE_COUNT=0
ZOMBIE_BASELINE=0 ZOMBIE_DELTA=0
TEST_TREE_ZOMBIE_COUNT=0
ZOMBIE_PS_RAW_BEGIN
PID PPID STAT COMMAND
ZOMBIE_PS_RAW_END
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=9/9

OOM_CHECK_RUN=2 RC=0
FORKFAIL_CASE=run-parallel FAILED_SLOTS=6 SUCCESSFUL_SLOTS=14 ERROR=E_RUN_PARALLEL_FORK RC=0 SIGNAL=0 ZOMBIE_DELTA=0
FORKFAIL_CASE=http-process-limit FAILED_SLOTS=30 SUCCESSFUL_SLOTS=0 ERROR=HTTP_503 RC=0 SIGNAL=0 ZOMBIE_DELTA=0
FORKFAIL_CASE=http-recovery FAILED_SLOTS=0 SUCCESSFUL_SLOTS=1 ERROR=none RC=0 SIGNAL=0 ZOMBIE_DELTA=0
SEGV_COUNT=0
ZOMBIE_COUNT=0
ZOMBIE_BASELINE=0 ZOMBIE_DELTA=0
TEST_TREE_ZOMBIE_COUNT=0
ZOMBIE_PS_RAW_BEGIN
PID PPID STAT COMMAND
ZOMBIE_PS_RAW_END
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=9/9

OOM_CHECK_RUN=3 RC=0
FORKFAIL_CASE=run-parallel FAILED_SLOTS=6 SUCCESSFUL_SLOTS=14 ERROR=E_RUN_PARALLEL_FORK RC=0 SIGNAL=0 ZOMBIE_DELTA=0
FORKFAIL_CASE=http-process-limit FAILED_SLOTS=30 SUCCESSFUL_SLOTS=0 ERROR=HTTP_503 RC=0 SIGNAL=0 ZOMBIE_DELTA=0
FORKFAIL_CASE=http-recovery FAILED_SLOTS=0 SUCCESSFUL_SLOTS=1 ERROR=none RC=0 SIGNAL=0 ZOMBIE_DELTA=0
SEGV_COUNT=0
ZOMBIE_COUNT=0
ZOMBIE_BASELINE=0 ZOMBIE_DELTA=0
TEST_TREE_ZOMBIE_COUNT=0
ZOMBIE_PS_RAW_BEGIN
PID PPID STAT COMMAND
ZOMBIE_PS_RAW_END
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=9/9
```

### 실제 pool 진입점 3회

이후 변경된 OOM 검사를 포함하는 `tests/run-task942-pool.sh`를 각각 1회씩 총 3회 실행했다. heavy 시험 전 ps를 저장하고 각 호출을 `flock -o <가림>` 아래 순차 수행했다. `POOL_ENTRY_RUN`은 회차 식별을 위해 바깥 기록기가 붙인 헤더이며, 이어지는 `RC`와 test summary는 저장된 실행 출력의 원문이다.

```text
POOL_ENTRY_RUN=1 RC=0
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_SUMMARY=6/6
POOL_RESOURCE_STABLE=1
POOL_ZOMBIE_CHILDREN=0
POOL_SERVER_STOP_RC=0
POOL_CHILDREN_AFTER_STOP=0
POOL_WORKERS_ALIVE_AFTER_STOP=0
POOL_CHECK_ZOMBIE=1/1
POOL_SUMMARY=8/8
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=9/9
GLOBAL_ZOMBIES_BEFORE=14 GLOBAL_ZOMBIES_AFTER=14

POOL_ENTRY_RUN=2 RC=0
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_SUMMARY=6/6
POOL_RESOURCE_STABLE=1
POOL_ZOMBIE_CHILDREN=0
POOL_SERVER_STOP_RC=0
POOL_CHILDREN_AFTER_STOP=0
POOL_WORKERS_ALIVE_AFTER_STOP=0
POOL_CHECK_ZOMBIE=1/1
POOL_SUMMARY=8/8
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=9/9
GLOBAL_ZOMBIES_BEFORE=14 GLOBAL_ZOMBIES_AFTER=14

POOL_ENTRY_RUN=3 RC=0
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_SUMMARY=6/6
POOL_RESOURCE_STABLE=1
POOL_ZOMBIE_CHILDREN=0
POOL_SERVER_STOP_RC=0
POOL_CHILDREN_AFTER_STOP=0
POOL_WORKERS_ALIVE_AFTER_STOP=0
POOL_CHECK_ZOMBIE=1/1
POOL_SUMMARY=8/8
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=9/9
GLOBAL_ZOMBIES_BEFORE=14 GLOBAL_ZOMBIES_AFTER=14
```

세 회 모두 `run-task931.sh`의 raw 출력에서 `ZOMBIE_BASELINE=0 ZOMBIE_DELTA=0`, `TEST_TREE_ZOMBIE_COUNT=0`, `OOM_SUMMARY=12/12`, `FORKFAIL_SUMMARY=9/9`였다. pool 진입점은 세 번 모두 RC 0 및 `POOL_SUMMARY=8/8`로 끝났다. 전체 host 좀비 14개가 보였지만 새 검사 tree에는 포함되지 않았다. 수정된 범위에서 실패는 0/3회다.

## 2. 외부 도구 저장소와 BASE_RC

343행 자체는 `SUMMARY >= 9`와 `BASE_RC == 0`을 요구한다. `BASE_RC`는 `run-task938-load.sh:18-19`의 선행 quick 시험에서 오며, `run-task920.sh:5`가 다음 저장소를 요구한다.

- 이름: `freelang-tools`
- 기본 경로: `$ROOT/../freelang-tools` (v11 저장소의 형제 경로; 실제 절대 경로 `<가림>`). `FL_TOOLS_ROOT`로 대체 지정 가능.
- D-12 현재 관찰 HEAD: `5bbfb771e5f9c83f0b9664e306ff143a0a2b556c`
- 버전 고정: 없음. v11 runner는 외부 도구의 commit을 pin하지 않고, D-12 준비 문서에서도 특정 commit을 지정하지 않는다.

외부 도구 README와 추적 문서를 확인했으나 native D-12 시험에 쓸 clone URL/설치 위치/버전 선택·고정/설치·검증 절차를 찾지 못했다. README는 CLI 사용법과 별도 완료 상태를 설명한다. 따라서 누락점은 저장소 취득 위치와 신뢰할 URL, 요구 버전 또는 commit, 설치/생성 절차, 성공 여부 확인 명령이다. 절차를 추측해 실행하지 않았다.

지시대로 외부 도구 준비 후 전체·LOAD2 각 1회 재시험은 하지 않았다. 이 항목에 한해 준비 지침이 마련될 때까지 멈췄으며, zombie 범위 검증 작업은 계속했다. 이번 전체 pool 세 번은 `FL_HTTP_SKIP_FAST=1`인 pool 경로라 외부 도구 준비 후 전체/legacy LOAD2 시험으로 세지 않는다.

원인 판정: **환경 차이**. V-3 전체 시험 두 회의 첫 오류는 기본 형제 경로 `cd` 실패였고, LOAD2 `BASE_RC=1`은 `run-task920.sh` 실패 코드가 남은 채 `run-task938-load.sh:343`의 `test "$BASE_RC" -eq 0`이 실패한 것이다. 부하 10개 지표가 10/10이어도 wrapper RC 1일 수 있다. V-4의 세 pool 실행은 BASE_RC=0인 skip-fast 경로에서 모두 LOAD2 10/10이었다.

## 3. pool 6 FD 48→46 원인과 전·중·후 자료

이 항목은 V-3에서 보관한 clean 재현의 원본 계측을 사용했다. `tests/run-task938-load.sh`와 runtime 코드는 V-4에서 수정하지 않았다. 당시 LOAD2 출력 원문:

```text
LOAD_FAST_SUITE_RC=0
LOAD_RESOURCE_BASELINE_SETTLED=0 fd=48
LOAD_RESOURCE_WARM_BASELINE rss_kb=37992 fd=48
LOAD_RESOURCE_COLD_START rss_kb=12260 fd=40
LOAD_RESOURCE_START rss_kb=32264 fd=48
LOAD_RESOURCE_END rss_kb=29460 fd=46
LOAD_RESOURCE_STABLE=0
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
```

`tests/run-task938-load.sh:179-198`는 서버 PID와 직접 자식 PID들의 RSS/FD를 합산한다. 321행은 steady baseline과 final aggregate FD의 차이를 1 이내로 요구한다. 반면 worker는 `http_server.c:301,304-308,328-344`에서 request limit에 도달하면 교체된다. DB를 처음 쓰는 fork worker는 `db.c:87-102`의 child별 reopen 경로로 추가 DB/WAL FD를 열고, 그 worker가 끝나면 FD가 닫힌다.

| 시점 | FD/프로세스 목록 증거 | `ss -ltnp` 포트 증거 |
|---|---|---|
| 실행 전 | test load-server PID가 아직 없어 대상 `/proc/<pid>/fd`는 존재하지 않음. 전체 `before.ps` 저장 | `before.ss`에 대상 port 없음 |
| 실행 중, snapshot `000696.fd` | server 964212=8 FD; worker 995237=10 FD; workers 995239, 995595, 995958=각 10 FD. 합계 48 | snapshot `000693.ss`: port `35149`, listener socket inode `1322085395`, server/worker processes가 FD 7 공유 |
| worker 교체, snapshot `000697.fd` | PID 995237 종료, 교체 PID 996052=8 FD; server 964212=8 및 다른 worker 3개=각 10. 합계 46 | snapshot `000697.ss`: 같은 port `35149`, 같은 listener inode `1322085395`, FD 7을 교체 worker가 공유 |
| 실행 후 | server PID가 종료됨. `ls /proc/964212/fd` 사후 조회는 `AFTER_LS_RC=2`; 빈 FD 목록이라고 기록하지 않음. `after.ps` 저장 | `after.ss`에 target port 없음; server cleanup 후 listener 종료 |

두 감소 FD의 정체는 이전 worker 995237의 FD 9 `SQLITE_MAIN`과 FD 10 `SQLITE_WAL`이다. 그 inode/device는 각각 기본 상속 FD 3/4와 같은 DB/WAL 파일을 가리킨다. 새 PID 996052는 교체 직후 기본 FD 0–7만 보유했다. worker 시작/교체 로그 원문:

```text
HTTP_WORKER_STARTED slot=2 pid=995237
HTTP_WORKER_STARTED slot=2 pid=996052
HTTP_WORKER_RESTART slot=2 old_pid=995237 reason=request-limit detail=75 count=66 new_pid=996052
```

전/후 target port가 없고 실행 중 동일 listener inode를 유지한 점은 포트 충돌이나 listener 재생성 때문이 아님을 보여준다. 이는 worker 교체에 따른 DB handle 수명 변화와 `LOAD_RESOURCE_BASELINE_SETTLED=0`인 상태에서 비교한 aggregate 측정이다. 판정은 **시험 코드의 측정 시점/수명 상태 민감성**이며 FreeLang 언어 결함 증거는 없다. 사용자 허용 범위는 pool 1 검사뿐이므로 LOAD2 기준이나 코드는 수정하지 않았다. 후속 수정·측정 범위 조정이 필요하면 별도 결정이 필요하다.

## 4. V-3 점수

V-3 보고서 `docs/V-3-root-cause.md`의 기존 마지막 줄은 다음과 같다. 보고서는 V-4에서 수정하지 않았다.

```text
V3_SUMMARY 4/4
```

## 증거 파일 및 해시

모든 실제 저장 위치는 `<가림>`이다. pool1 evidence는 회차별 root log, LOAD2 log, nested `oom-suite.log`, heavy 실행 전후 ps를 보존한다. V-3 FD 증거는 원본 파일을 그대로 참조하며 SHA-256을 함께 적었다.

| 증거 | SHA-256 |
|---|---|
| pool entry 1 log | `0f92a4f7b4a0d292596f2a089cddd51d466fcb337c7a261fe46acb8e03bf9a56` |
| pool entry 1 LOAD2 log | `2908efe0d370f606558b8e560a194bef06d624c5350477e69a2cfd486310058e` |
| pool entry 1 OOM log | `f682cbd7130fd70b6d0a5356513db2f606943744894863addd9e81c5ec492325` |
| pool entry 1 before ps | `5d385f70e37e4634ef712838d0a7c6dd9527209730c685a92d59fc0fd8fc9b9f` |
| pool entry 1 after ps | `1de75bdf5eed2c75389119b9f77863baa4df131000edb0980bd436712573929e` |
| pool entry 2 log | `530042e6f141550b9a651d153a01bdc5f126b1870f9583c0ac08a91f382507a5` |
| pool entry 2 LOAD2 log | `df23d2ede41354d8a51e88d0c4ff2c5f9fb6b8369656075d13b77942416aa51b` |
| pool entry 2 OOM log | `e3610a827c49a2571471e79de4242ed1fdc2bbeeb688c59817d159c018039989` |
| pool entry 2 before ps | `544a80211d8e7886e4387627513b65a05257ee2f7c9066814a3d54a60f8c9992` |
| pool entry 2 after ps | `43fa9476f1ba9fb18cbbe85f7235d8508583097c0d97875e2772381caaf4f5b3` |
| pool entry 3 log | `0908d9d99dbf9697cdc0aaca69bbbdd9c4f6a9be889b8768cdb5ae4cc49cbcce` |
| pool entry 3 LOAD2 log | `369e68e25153bc400461bc0079b374b6f43dd61aa2a7881c2fe6cff1e78b1da8` |
| pool entry 3 OOM log | `91f8f7b3339d83a00d60b5e466d92e5306e6e0359e85f2c9886764b2045d1f70` |
| pool entry 3 before ps | `e3bbb2f0566981d16cfebe03e9e0e0e75d0a1f63020c4f8862e0de370e764166` |
| pool entry 3 after ps | `70e9426ebbcbeead781eff6809e7a1e0c9b263117382c1d542cd449cd6137d0b` |
| V-3 FD snapshot `000696.fd` | `8d2e88cef1220b788545ed65f5b44811118be9e00c2d825de62e9c6f7a1ca211` |
| V-3 FD snapshot `000697.fd` | `5c4119bd5a6b082d7240ff4ae67b8fb999102850f344073863fa611cc3425594` |
| V-3 ss snapshot `000693.ss` | `da08924be7932f2e5df6a934c494fc5afe463a2dffe0c970b5222116678f7151` |
| V-3 ss snapshot `000697.ss` | `fcb5afe0c26bbac06c705314706600ef7763ae9aa14a91c5edee5fa43d15c9c6` |
| V-3 before ss | `826915a8441c1d331b437cf057ea781e8fcd188b8c8782a820c919c996b9c520` |
| V-3 after ss | `e2f242fe07144197991f86a5746eb9f718c24add7778dc5d60c891a2b7600cf7` |
| V-3 after FD query | `a8c97108e990a294e8cf4b8daa2b49a3c4744a43f63b2d42198009c78dd3e793` |

### V-4 다섯 항목 판정

| 번호 | 항목 | 상태 |
|---:|---|---|
| 1 | pool 1 범위 축소와 3회 실행 | 완료: 3/3 RC 0, pool 3/3 `8/8` |
| 2 | 외부 도구/전체·LOAD2 | 완료: 저장소·경로·현재 commit 확인, D-12 native 준비 문서 없음 기록, 조건에 따라 미실행 |
| 3 | pool 6 FD/포트 원인 | 완료: V-3 원본 재현 스냅샷으로 두 FD 식별, 사전/사후 PID 부재 명시 |
| 4 | 판정표 및 언어/환경 구분 | 완료: 전체 시험은 환경 차이, pool 6은 시험 측정 코드 민감성, 언어 결함 증거 없음 |
| 5 | V-3 점수 | 완료: `V3_SUMMARY 4/4` 기록 |

V4_SUMMARY 5/5
