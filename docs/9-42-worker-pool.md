# TASK 9-42 — HTTP worker pool report

## 1. 구조와 변경 위치

- `runtime/http_server.c:215-248`: persistent worker가 공유 listen 소켓에서 accept하고 요청을 처리한다.
- `runtime/http_server.c:250-310`: 부모 감독자가 자식 종료를 회수하고 재시작하며 요청 수 상한 종료를 교대한다.
- `runtime/http_server.c:1066-1070`: `FL_HTTP_WORKERS` 기본값은 `0`, `FL_HTTP_WORKER_MAX_REQ` 기본값은 `10000`이다. `runtime/http_server.c:1091-1100`에서 연결 상한 기본값 `256`을 읽는다.
- `runtime/http_server.c:1182-1207`: 기존 요청별 fork 방식도 유지하며, 연결 상한 초과와 fork 실패 시 503을 반환한다.
- 설정 설명은 `docs/HTTP_WORKERS.md`에 있다.
- `tests/run-task942-all.sh`가 기존 빠른 회귀와 풀 시험을 한 번의 실행 묶음으로 호출한다. `tests/run-task942-pool.sh`가 방식별 부하, LOAD2/CAP, 자식 재시작·교대·종료, 풀 모드 HTTP 보안 회귀를 검사한다.
- 최종 시험 중 빈 자식 목록에서 `ps`가 1을 돌려주는 환경을 고려해 `tests/run-task942-pool.sh`의 종료 확인을 보정했다. 변경 커밋은 `1b1fc75d`이다.

## 2. 1000 동시 접속 처리량

각 칸은 초당 요청 수 / p50 ms / p99 ms / 오류율이다. 각 실행은 60초, 동시 접속 1000개였다.

| workers | 경로 | RPS | p50 ms | p99 ms | 오류율 |
|---:|---|---:|---:|---:|---:|
| 0 | ok | 582.12 | 1712.937 | 1845.909 | 0.000% |
| 0 | mixed | 547.09 | 1837.071 | 1946.223 | 0.000% |
| 4 | ok | 690.53 | 1471.257 | 1667.883 | 0.000% |
| 4 | mixed | 517.24 | 1913.031 | 2196.724 | 0.000% |
| 8 | ok | 462.94 | 2146.582 | 2606.867 | 0.000% |
| 8 | mixed | 515.63 | 1921.673 | 2252.575 | 0.032% |
| 16 | ok | 316.17 | 3071.956 | 4158.743 | 85.260% |
| 16 | mixed | 625.19 | 1488.375 | 2385.775 | 0.210% |

목표인 mixed 800 RPS 또는 p99 1000ms 미만은 달성하지 못했다. 16 workers의 `ok` 실행에는 연결·I/O 오류가 85.260% 발생했다. 작업자 수를 늘리면 처리량이 계속 증가한다는 결과는 확인되지 않았다. 이 측정은 현재 시험 호스트의 자원 경쟁을 분리하지 않은 결과다.

## 3. POOL 결과

```text
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_ACTIVE_CONNECTIONS_MAX=63
CAP_503=59011
CAP_OTHER_ERRORS=0
CAP_RECOVERY_HTTP=200
CAP_ZOMBIE_DELTA=0
CAP_SUMMARY=6/6
LOAD_200_IDS_MISSING_FROM_DB=0
LOAD_DB_ONLY_IDS=0
LOAD_DUPLICATE_IDS=0
LOAD_DB_INTEGRITY=ok
LOAD_DATABASE_IS_LOCKED=0
POOL_KILL_ERROR_PCT=0.002
POOL_KILL_RECOVERY_HTTP=200
POOL_RESOURCE_START rss_kb=36860 fd=48
POOL_RESOURCE_END rss_kb=14556 fd=40
POOL_RESOURCE_STABLE=1
POOL_ZOMBIE_CHILDREN=0
POOL_SERVER_STOP_RC=0
POOL_CHILDREN_AFTER_STOP=0
POOL_WORKERS_ALIVE_AFTER_STOP=0
POOL_ROTATION_SERVER_STOP_RC=0
HTTPATK_SUMMARY=21/21
STATIC_SUMMARY=18/18
TIMEOUT_SUMMARY=8/8
POOL_SUMMARY=8/8
```

풀 스트레스에서 시험 설정은 `FL_HTTP_CAP_WORKERS=64`, `FL_HTTP_CAP_MAX_CONN=63`을 사용했다. 따라서 풀에서 관측한 상한 63은 런타임 기본 상한 256을 넘지 않는다. 256 worker 포화는 별도의 기존 방식 CAP 회귀에서 `CAP_ACTIVE_CONNECTIONS_MAX=256`으로 확인했다.

## 4. 작업자 강제 종료와 교대 로그

```text
POOL_KILLED_WORKER_RESTART=HTTP_WORKER_RESTART slot=0 old_pid=2515708 reason=signal detail=9 count=20 new_pid=2515843
POOL_KILL_ERROR_PCT=0.002
POOL_KILL_RECOVERY_HTTP=200
POOL_ROTATION_LOG=HTTP_WORKER_RESTART slot=0 old_pid=2515946 reason=request-limit detail=75 count=1 new_pid=2515959
POOL_ROTATION_SERVER_STOP_RC=0
POOL_CHILDREN_AFTER_STOP=0
POOL_WORKERS_ALIVE_AFTER_STOP=0
```

## 5. 고정점과 시드

컴파일러 단계는 이번에 수정하지 않았고 고정점은 바뀌지 않았다. 마지막으로 기록된 부트스트랩 결과:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  cgc-bin-x86_64-seed-v11
ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba  stage2.c
ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba  stage3.c
ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba  stage4.c
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

## 6. 빠른 시험과 단일 strace

최종 실행은 기능·시험 커밋 `1b1fc75d`에서 한 번의 `strace -f -e trace=execve`로 수행했다. 요약 출력:

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

## 7. 최종 커밋, 원격 HEAD와 위험

- 기능 및 시험 실행 커밋: `1b1fc75d` (`test: tolerate ps with no remaining worker children`). 전체 시험은 이 커밋에서 통과했다.
- 이 보고서는 그 실행의 결과를 보존한다. 첫 보고서 커밋 `bd2a5b65`를 Forgejo 다음 GitHub에 푸시했고 두 원격의 HEAD가 같음을 확인했다.

첫 보고서 푸시 확인 원문:

```text
bd2a5b6572149898b19ac5b153375302927e5f50	refs/heads/v11-x86-seed-public
bd2a5b6572149898b19ac5b153375302927e5f50	refs/heads/v11-x86-seed-public
```

커밋 전 보고서 검사 원문:

```text
REPORT_HOME_MATCHES=0
REPORT_ADDRESS_MATCHES=0
REPORT_IP_MATCHES=0
REPORT_KEY_MATCHES=0
```

## 7. 미확인 항목과 위험

- 처리량 목표는 미달이며 16 workers `/ok`에서 높은 오류율이 관측됐다. 상용 부하를 권장할 성능 결과는 아니다.
- 풀 CAP 스트레스는 runner 부담 때문에 63 연결로 설정했다. 256 상한 자체는 기존 방식 CAP 시험에서 확인했으며, 풀 방식에서 256 연결을 지속 포화시키는 시험은 하지 않았다.
- 이 문서의 최종 보정 커밋은 첫 보고서 푸시 다음에 생성되므로, 최종 원격 HEAD는 최종 커밋 후 별도로 대조한다.
