# V-3 D-12 재현 실패 원인 확정

접수번호: RUN-20261102-07 / 담당: 코1

- 새 복제본 시작 브랜치: `recheck-v1`
- 새 복제본 시작 HEAD: `c22dc19c59208d78c6fd30398c3a6f3fe9a45c4c`
- 대상 `db-stability` HEAD: `963632add97cb0534a04d4707956ffe45d9e7e0e`
- 시작 상태: CLEAN
- 증거 파일은 저장소 밖의 격리된 디렉터리에 보존했다. 경로는 `<가림>`.
- 소스·기대값·문턱값·제한시간·seed는 바꾸지 않았다. strace는 사용하지 않았다. 서버 23·25에 접속하거나 작업하지 않았고, erp·grok-router·test11-hello도 건드리지 않았다.

## 판정 요약

| V-3 항목 | 원인/판정 | 증거 | 다음 조치 |
|---|---|---|---|
| 외부 도구 및 전체·LOAD2 준비 | 환경 차이: 새 복제본에는 필수 형제 저장소가 없고 D-12 준비 절차도 찾지 못함 | `run-task920.sh:5`, V-2 로그 A1/A2 및 저장소 문서 검색 | 준비 지침을 정한 뒤 별도 실행 승인. 이번에는 임의 설치·시험하지 않음 |
| 전역 좀비 검사 | 시험 불안정: 검사 대상이 호스트 전체 좀비 수이며, 시험 부모 좀비 검사도 별도로 존재 | `run-task931.sh:13,292-307,324-326`; OOM 전후 ps 및 재현 로그 | 범위 변경 전 질문 필요. 이번에는 검사 코드를 바꾸지 않음 |
| pool FD 48→46 | 시험 측정 불안정: 요청 수에 따른 작업자 교체가 열린 SQLite FD 수를 바꿈. 언어 결함 증거 없음 | `run-task938-load.sh:179-198,321`; `db.c:87-102`; `http_server.c:301,304-308,328-344`; FD·inode·ss 스냅샷 | 동일 작업자 수명 상태의 시작·종료값을 비교할지 먼저 결정. 기대값은 바꾸지 않음 |
| 환경 비교와 원격 | 표에서 과거 미수집 값과 현재 관측값을 분리. 이 보고서 커밋 뒤 Forgejo→GitHub 순으로 HEAD 확인 | 아래 비교표와 원격 검증 기록 | 커밋·두 원격 ref 확인 후 완료 |

### 언어 결함 여부

재현된 LOAD2 실패는 런타임 의미 오류나 데이터 손상으로 나타나지 않았다. LOAD2 요약은 `9/10`이며 직접 빠진 항목은 자원 안정 검사다. 48→46 구간에서 종료한 작업자의 `SQLITE_MAIN`, `SQLITE_WAL` FD가 사라졌고 새 작업자는 이 추가 FD를 아직 열지 않은 상태였다. SQLite DB 처리 후 요청 한도에 따라 worker를 교체하는 실행 상태와 시험의 시점별 서버·직접 자식 FD 합산값이 달라진 것이다. 따라서 현재 증거로는 **언어 결함이 아니라 시험 측정의 수명 상태 민감성**으로 판정한다. 메모리·DB 정확성 관련 지표는 별도 로그 원문을 보존했다. 이 판정은 과거 pool 6 실패 순간의 PID를 이번 PID와 동일시하지 않는다.

## 1. 외부 도구 저장소·준비 문서

`tests/run-task920.sh:5`가 요구하는 저장소 이름은 `freelang-tools`다. 기본 위치는 v11 저장소의 상위 폴더에 있는 형제 `freelang-tools`이며 `FL_TOOLS_ROOT`로 경로를 지정할 수 있다. 실제 경로는 보고서에서 `<가림>` 처리했다.

D-12의 현재 형제 도구 저장소 HEAD는 `5bbfb771e5f9c83f0b9664e306ff143a0a2b556c`다. 이것은 현재 관찰된 버전이지 v11 시험 스크립트가 고정하거나 D-12 문서가 지정한 버전이 아니다. D-12 도구 실행 파일 해시는 다음과 같다.

```text
cgc-native b9681984c7b92d581da56bf73af84053817efc5a618192ab5c9586a58c91e814
fl-cgc-run 55321a11271135b3c27bc1a4e6cd393e6a812de5b208db47884afb7c0e5cd16c
```

README 및 추적 문서에서 D-12 native 시험에 해당하는 clone 위치·버전 선택·준비 명령은 찾지 못했다. 외부 도구 README는 CLI 사용법을, v11의 일부 quickstart는 구형 npm/Node bootstrap 흐름을 설명하지만 이는 이 native D-12 준비 절차가 아니다. 따라서 문서에 없는 절차를 추측해 저장소를 clone하거나 설치하지 않았다. 새 V-3 복제본에는 기본 형제 도구 저장소가 없고 `FL_TOOLS_ROOT`도 설정되지 않았다.

지시의 “문서가 없으면 빠진 점만 기록” 조건에 따라 관찰 버전을 준비하지 않았으며, 그 준비를 전제로 한 전체 시험 1회와 LOAD2 1회는 **미실행**이다. V-2에 기록된 전체 시험 2회 실패 원문을 아래 재인용한다. 별도 FD 재현은 `FL_HTTP_SKIP_FAST=1` pool 경로이며, 전체 시험이나 외부 도구 준비 후 LOAD2 재실행으로 세지 않았다.

## 2. 전체 시험의 첫 실패 원문과 RC

V-2 보관 로그 A1/A2의 두 전체 시험은 모두 같은 첫 오류에서 멈췄다. 첫 줄의 경로는 비밀·환경 경로 보호를 위해 `<가림>`으로 표기했다. 다음 20줄은 각 로그의 시작 부분이다.

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

| 회차 | 최초 실패 | TASK920 RC | legacy LOAD2 RC | pool RC | 전체 RC |
|---:|---|---:|---:|---:|---:|
| 1 | `run-task920.sh:5` 기본 `freelang-tools` 경로 `cd` | 1 | 1 | 0 | 1 |
| 2 | `run-task920.sh:5` 기본 `freelang-tools` 경로 `cd` | 1 | 1 | 0 | 1 |

이 줄 뒤 OOM의 RC 71과 `E_RUN_PARALLEL_FORK`는 별도 의도된 한도 시험 결과이며 최초 오류가 아니다. V-2의 A1 SHA-256은 `4f047fdc285e67407d417fd0168677d69843c58546e9754cbaab16d8bbea3971`, A2는 `a9f3c8b431d59fe1f60823e69bcc6ede996fe54b2718b3a44f08ca8ba1332c59`다. 각 시험 명령 전체 RC는 `1`이다.

원인 분류는 **환경 차이**다. 새 복제본에서 기대값을 바꾸지 않고 실행 경로를 확인했을 때 필요한 형제 저장소가 없었다. 현재 D-12 실행 환경과 새 clone에서 확인된 차이다. D-12 시험 당시의 모든 환경 변수를 사후에 재구성한 것은 아니다.

## 3. LOAD2 BASE_RC=1

`tests/run-task938-load.sh:15-24`는 `BASE_RC=0`으로 시작한다. 빠른 시험 경로의 18행에서 `run-task920.sh` 실패 RC를 `BASE_RC`에 저장한다. 이후 19행의 OOM 검사가 성공하면 `|| BASE_RC=$?`가 실행되지 않아 앞서 저장된 `1`은 그대로 남는다. 343행은 부하 결과 외에도 `BASE_RC`가 0인지 검사한다.

```bash
printf 'LOAD2_SUMMARY=%s/10\n' "$SUMMARY" | tee "$WORK/final-summary.log"
test "$SUMMARY" -ge 9 && test "$BASE_RC" -eq 0
```

이는 V-2에서 확인한 quick 경로의 BASE_RC 문제다. V-3 세 번째 pool 계측은 `FL_HTTP_SKIP_FAST=1`로 실행되어 `LOAD_FAST_SUITE_RC=0`이었다. 그 실행은 외부 도구 준비 후 LOAD2 재시험이 아니다.

## 4. 전역 좀비 검사와 시험 전후 ps

코드 위치를 보면 전역 및 시험 범위 검사를 구분해서 수행한다.

- `run-task931.sh:13`: 기준을 `ps -eo stat=`으로 세어 **호스트 전체** 좀비 수를 구한다.
- `run-task931.sh:292-298`: 이후에도 같은 전역 수를 세어 기준과의 delta를 계산한다. 실제로 시스템에 있는 모든 PID를 대상으로 하므로 이 시험의 descendants 전용 검사가 아니다.
- `run-task931.sh:299`: 별도로 `ps -eo ppid=,stat=` 중 현재 시험 셸 PID와 직접 parent가 같은 좀비만 센다. 전체 descendant tree가 아니라 직접 자식만 포함한다.
- `run-task931.sh:306-307,324-326`: 전역 delta와 직접 parent 수 둘 다 0이어야 OOM/FORKFAIL 검사가 통과한다.

주석 310행은 전역 좀비가 기존부터 있을 수 있음을 설명하지만 검사는 전역 delta 0을 여전히 요구한다. 검사 범위나 소스를 수정하지 않았다.

V-3 standalone OOM 시험의 실행 전후 `ps -eo pid,ppid,stat,etime,comm`에서 좀비는 각각 14개였고 PID 집합 차이는 0행이었다. 시험 출력은 다음과 같다.

```text
OOM_BEFORE_ZOMBIES=14
OOM_AFTER_ZOMBIES=14
SEGV_COUNT=0
ZOMBIE_COUNT=14
ZOMBIE_BASELINE=14 ZOMBIE_DELTA=0
TEST_PARENT_ZOMBIE_COUNT=0
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=9/9
ZOMBIE_PID_SET_DIFF_LINES=0
```

전후 명단은 아래 14개 PID/PPID/STAT/COMMAND이며 양쪽 파일에서 일치한다.

```text
4285 4255 Z python3
4338 4326 Z next-server
4341 4326 Z next-server
4345 4326 Z node
591321 572450 Z+ chrome
607730 572450 Z+ chrome
991955 485096 Z+ chrome
1240516 485096 Z+ chrome
2491727 2491705 Z sh
2915926 995828 Z+ chrome
3315584 995828 Z+ chrome
3386701 3293128 Zs xdg-open
3410131 3293128 Zs xdg-open
3519754 3293128 Zs xdg-open
```

추가 관측인 FD trial 2의 선행 OOM 시험에서는 `FORKFAIL_CASE=run-parallel ... ZOMBIE_DELTA=-1`로 중단됐다. 전역 수가 기준보다 감소한 것이다. 이 실행은 LOAD2 FD 서버에 도달하지 않았다. V-1 pool 1에서 관찰된 전역 증가 실패와 V-3의 standalone 통과 및 감소 실패를 함께 보면, global `ps` 수의 시점 변동이 시험 결과를 바꿀 수 있다는 점을 확인한다. 다만 과거 pool 1 실패 때 늘어난 한 PID가 어느 프로세스 소유였는지는 미확정이다.

증거에는 OOM 시험 전·후 전체 ps 파일과 FD trial 3 전·후 전체 ps 파일이 있다. 경로는 `<가림>`이다. 아래 표의 ps 목록은 trial 3 시험 서버 실행 중 프로세스도 포함한 스냅샷이다. 원 pool 1 실패 당시의 사후 ps를 새 목록으로 대체하지 않았다.

## 5. pool FD와 포트 증거

V-3에서 세 번째 clean FD 계측은 무거운 실행 전 ps를 저장하고 `/tmp/fl-heavy.lock`으로 보호해 수행했다. 첫 부하 전 `LOAD_RESOURCE_START fd=48`, 실행 후 `LOAD_RESOURCE_END fd=46`, 종료 RC `1`이었다. LOAD2 및 FDFIX 출력 원문:

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

원 시험 `run-task938-load.sh:321`의 대칭 FD 차이 조건은 시작/steady `48`과 끝 `46`의 차이 2를 허용하지 않는다. 343행은 요약 9와 BASE_RC 0을 받아 진행하고, 359행의 정확한 `LOAD2_SUMMARY=10/10` 검색은 실패해 361행에서 종료 RC 1이 된다. 실패 시점 첫 경로의 종료 코드는 `1`이다.

시험 중 스냅샷 `000696.fd`(UTC `2026-11-02T10:03:17.683213214Z`)와 다음 `000697.fd`(UTC `2026-11-02T10:03:18.072272096Z`)를 비교했다. FD 관찰 도구는 각 PID에 `ls -ln /proc/<pid>/fd`, 파일 inode/device/type을 저장했다. 보고서 밖 실제 경로는 모두 가렸다.

| 관측 | 이전 `000696.fd` | 이후 `000697.fd` |
|---|---|---|
| 서버 PID | 964212, 8 FD | 964212, 8 FD |
| 작업자 PID | 995237, 10 FD | 종료 |
| 교체 작업자 PID | 없음 | 996052, 8 FD |
| 다른 동일 PID | 995239, 995595, 995958, 각 10 FD | 같은 PID, 각 10 FD |
| FD 수 | 총 48 (`SQLITE_MAIN=9`, `SQLITE_WAL=9`, `SQLITE_SHM=5`, `SOCKET=5`, `PIPE=0`) | 총 46 (`SQLITE_MAIN=8`, `SQLITE_WAL=8`, `SQLITE_SHM=5`, `SOCKET=5`, `PIPE=0`) |

교체된 PID 995237의 열린 파일은 다음과 같다. FD 0–7은 상속된 기본 FD이고, FD 9와 10은 SQLite main/WAL 추가 FD다.

```text
0 DEV_NULL
1 LOG
2 LOG
3 SQLITE_MAIN inode=136325961 device=64768
4 SQLITE_WAL inode=136325962 device=64768
5 SQLITE_SHM inode=136325963 device=64768
6 PUBLIC_DIR
7 SOCKET inode=1322085395 device=9
9 SQLITE_MAIN inode=136325961 device=64768
10 SQLITE_WAL inode=136325962 device=64768
```

교체된 PID 996052는 FD 0–7만 보유했다. 이전 작업자의 FD 9와 10이 닫히면서 aggregate 2가 감소했다. inode/device/type 기록에서 FD 9의 main DB inode는 기본 FD 3과 같고, FD 10의 WAL inode는 기본 FD 4와 같다. 새 작업자는 교체 직후 아직 추가 SQL handle을 열지 않은 상태다.

같은 순간 서버 로그는 다음을 기록했다.

```text
HTTP_WORKER_STARTED slot=2 pid=995237
HTTP_WORKER_STARTED slot=2 pid=996052
HTTP_WORKER_RESTART slot=2 old_pid=995237 reason=request-limit detail=75 count=66 new_pid=996052
```

`ss -ltnp`의 대상 listener는 두 스냅샷에서 같은 port `35149`, 같은 server/listener socket inode `1322085395`를 보였다. 전 스냅샷에는 PID 995237, 후 스냅샷에는 PID 996052가 같은 listener FD 7을 공유했다. 종료 후 listener는 server cleanup으로 사라졌다. 시스템 전체 before/after ss 파일과 시험 중 반복 ss 스냅샷을 별도 증거로 보존했다. port의 주소는 `<가림>` 처리했다.

이 재현은 V-1의 pool 6 실패 순간 PID를 복원하지 않는다. 다만 동일한 48→46 하락과 같은 LOAD2 항목 실패를 재현했고, 추가 FD 두 개가 종료 작업자에서 사라진 이유를 직접 확인했다. 이를 누수나 언어 런타임 결함으로 해석할 증거는 없다. 원인은 **시험 불안정/작업자 생명주기와 FD 합계 측정의 상태 불일치**로 분류한다.

전·중·후 관측 가능 범위도 구분한다. 실행 전에는 대상 load-server가 아직 없으므로 해당 PID의 `/proc/<pid>/fd` 목록은 존재하지 않는다. 그 시점의 전체 ps 및 전역 ss를 저장했다. 실행 중에는 매 0.25초 간격(마지막 부하 단계 중 약 0.02초 간격)으로 서버와 직접 자식 각각의 FD 목록/inode와 포트 표를 저장했다. 시험이 끝난 뒤 PID 964212는 이미 종료되어 `ls /proc/964212/fd` 결과는 `AFTER_LS_RC=2`였다. 따라서 사후 프로세스의 열린 FD 목록은 존재하지 않는다고 기록하고, 대신 종료 후 ps/ss 및 `SERVER_EXITED_PID=964212`를 보존했다. 종료된 프로세스에 대한 실패한 ls를 빈 FD 목록이라고 바꾸어 쓰지 않았다.

## 6. 환경 비교표

역사적 D-12 실행 당시 원본 ps·전체 설정 스냅샷이 없으므로 현재 관찰값과 그때의 값을 섞어 쓰지 않는다. V-2 보고서의 확인값을 이어받고 V-3 관찰을 추가했다.

| 비교 항목 | D-12 작업 환경(관찰 가능한 범위) | 새 V-3 복제본/시험 | 결론·한계 |
|---|---|---|---|
| v11 대상 | `db-stability` `963632add97cb0534a04d4707956ffe45d9e7e0e` | 같은 대상 HEAD를 기준으로 새 `recheck-v1` 복제본에서 조사 | 소스 차이를 원인으로 볼 근거 없음 |
| 도구 저장소 | 형제 `freelang-tools` 존재, 현재 관측 HEAD `5bbfb771e5f9c83f0b9664e306ff143a0a2b556c` | 기본 형제 저장소 없음, `FL_TOOLS_ROOT` 미설정 | V-2 전체 시험 첫 실패를 설명하는 직접 차이. 스크립트나 문서가 이 버전을 pin하지 않음 |
| 무시/미추적 파일 | V-2 시점 현재 작업본: ignored 0, untracked 0 | V-3 clone 시험 전: CLEAN, ignored 파일 없음 | 테스트 중 만들어진 산출물은 외부 증거·work 디렉터리에 저장 |
| 생성물 | 외부 도구의 tracked native 실행 파일 존재. D-12 당시 임시 생성물은 미보존 | native stage2 compiler와 시험 결과물은 저장소 밖에 생성 | 과거 생성물 전체 목록 비교는 불가 |
| 남은 저장소 lock/pid | V-2 검사 당시 0 | V-3 시작 상태 CLEAN, 시험 산출물은 별도 위치 | 저장소 내부 시험 잔여물은 발견되지 않음 |
| 잠금 | D-12 과거 실행의 전체 동시 프로세스 목록 미보존 | 각 heavy run 전 ps 확인, `flock -o /tmp/fl-heavy.lock`; V-3 trial 3은 잠금 아래 실행 | 잠금 대기·동시 실행을 과거 D-12와 동일시할 수 없음 |
| 설정 파일/환경 변수 | 과거 `FL_TOOLS_ROOT` 원값 미보존 | 현재 미설정; 검색 범위 `.env*` 파일 없음 | 비밀값은 수집하지 않음 |
| 한도값 | D-12 당시 호스트 한도 미보존. 시험 내부 nproc=6, fd-limit=4는 의도된 입력 | trial 3 OOM 출력 `PARALLEL_ULIMIT_U=6`, `PARALLEL_EFFECTIVE_ULIMIT_U=6`; FD 제한 케이스는 그대로 유지 | 테스트가 설정한 한도와 호스트의 사전 한도를 구분 |
| 동시 프로세스 | D-12 실패/통과 시점 원본 ps 미보존 | FD trial 3의 `before.ps`, 반복 process snapshot, `after.ps` 보존 | 현재 ps가 과거 상태를 증명하지 않음 |
| 포트 | D-12 시험 당시 점유표 미보존 | 전체 before/after ss와 반복 ss 보존. 대상 listener는 port `35149`, socket inode `1322085395` | V-3 실행에서 포트 충돌 증거 없음. 원 D-12 점유 상태 미확정 |

환경 원인으로 확정할 수 있는 비교점은 외부 도구 저장소 부재다. 이전에 실행된 V-2 부하의 BASE_RC=1을 전역 zombies나 FD 하락과 혼동하지 않는다. FD 하락은 환경 차이라기보다 요청 한도 작업자 교체가 만들고 시험이 관측한 생명주기 변화다.

## 7. 제안 및 범위 변경 질문

수정은 하지 않았다. 제안은 외부 도구 저장소와 버전을 D-12 재현 문서에 명시하고, 준비 후 재시험하는 것이다. 좀비 검사에 대해서는 지금처럼 전역 좀비 delta를 요구할지 시험 프로세스 계보로 한정할지 결정이 필요하다. FD 검사는 기준을 완화하지 않고 동일한 worker/DB handle 상태를 비교하도록 증거 수집 시점을 정해야 한다. 이들은 후속 시험 계약 또는 코드 변경 후보이며 이번 보고서에서는 실행하지 않았다.

**전역 좀비 검사의 범위를 바꾸기 전에 확인 요청:** 앞으로의 검사 범위를 이 시험이 만든 프로세스 계보로 제한하는 변경을 허용할지, 현재 호스트 전역 검사 계약을 유지할지 결정해 달라. 허용 답변 전까지 코드/범위를 바꾸지 않는다.

## 증거 파일 식별

아래는 저장소 밖 증거의 별칭과 SHA-256이다. 실제 경로는 `<가림>`이다. `fd-3-observation`에는 각 시점의 `ls /proc/<pid>/fd`, inode 메타데이터, ps, 반복 ss가 저장됐다. `before.ss`, `after.ss`는 시험 전후 전역 listener 표다.

| 별칭 | 내용 | SHA-256 |
|---|---|---|
| OOM log | V-3 독립 OOM 시험, RC 0 | `7a9d3f4313d6a352cf19b9f92189b31f1dc4019f18bf5342d6e59a0d00ed3273` |
| OOM before ps | 시험 전 전체 ps | `feb4261447562fc382a82fc8e62bd775c070a02f88ef6dc30591257e5327919d` |
| OOM after ps | 시험 후 전체 ps | `a69e964420f11476d751921a5c6cdb559d9d73220d831f77379bce3d9b087e90` |
| FD trial 2 OOM | 전역 zombie delta=-1로 LOAD2 부하 전에 종료 | `b948c84db8b1aa9f41c05566dbc61c16e1ee07cb8c114e720789337afe52ad14` |
| FD trial 2 RC | 종료 코드 | `4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865` |
| FD trial 3 LOAD2 log | LOAD2 요약/RC 결과 | `ddf3f19aa3412824dc845b62b223078ff538bc198251652d23f0bc8e214ae27b` |
| FD trial 3 RC | 종료 코드 1 | `4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865` |
| FD trial 3 OOM | 선행 OOM 통과 | `536a9313ae01e259eb9ba99c6539a1c0499e34630a9853cef8a40b110b58a8c5` |
| FD trial 3 server log | 작업자 시작/교체 및 포트 | `49c1f0c3d3348e4af0c0fd4c191a43dffb5d3ae413592a2de6af4d9e82a5156a` |
| FD snapshot 000696 | 교체 전 PID/FD 목록+inode | `8d2e88cef1220b788545ed65f5b44811118be9e00c2d825de62e9c6f7a1ca211` |
| FD snapshot 000697 | 교체 후 PID/FD 목록+inode | `5c4119bd5a6b082d7240ff4ae67b8fb999102850f344073863fa611cc3425594` |
| ss snapshot 000693 | 교체 전 listener | `da08924be7932f2e5df6a934c494fc5afe463a2dffe0c970b5222116678f7151` |
| ss snapshot 000697 | 교체 후 listener | `fcb5afe0c26bbac06c705314706600ef7763ae9aa14a91c5edee5fa43d15c9c6` |
| FD trial before ps | 시험 전 전체 ps | `50af4a2e9a71a4e723a230749bbe9d8f428759a9cd0fc506da64469f02475fff` |
| FD trial after ps | 시험 후 전체 ps | `8f4a6e6bc08cb822e5d4a56d45a6b4b0e863d3916260229fbe56914696afcbaf` |
| FD trial after fd | 종료 후 PID 조회 결과 `AFTER_LS_RC=2` | `a8c97108e990a294e8cf4b8daa2b49a3c4744a43f63b2d42198009c78dd3e793` |
| FD trial request ps | heavy lock 요청 전 전체 ps | `98c7faf7810a1a21e9cd7445232bbb584b02682c2a9bcf9e37b5b2cd255d7c46` |
| FD trial before ss | 시험 전 전역 포트 사용 | `826915a8441c1d331b437cf057ea781e8fcd188b8c8782a820c919c996b9c520` |
| FD trial after ss | 시험 후 전역 포트 사용 | `e2f242fe07144197991f86a5746eb9f718c24add7778dc5d60c891a2b7600cf7` |

### V-3 네 항목 판정

| 항목 | 상태 |
|---:|---|
| 1. 전체·LOAD2 실패 원인 및 외부 도구 준비 문서/누락점 | 확인. 준비 문서 부재 때문에 재시험은 수행하지 않음 |
| 2. 전역/시험 프로세스 zombie 범위와 전후 ps | 확인 |
| 3. pool FD 목록·포트와 두 FD의 정체 | 재현 확인. 원 pool 6 PID는 복원 불가 |
| 4. 원인/증거/다음 조치 표 및 언어 결함 구분 | 확인 |

V3_SUMMARY 4/4
