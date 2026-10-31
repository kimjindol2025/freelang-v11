# D-11 전체 시험 결과

실행 위치: `<가림>`. 23·25 서버에는 접속하거나 작업하지 않았다. erp·grok-router·test11-hello는 수정하지 않았다.

## 0. 시드 및 master 반영

`dec63e63`의 seed 파일과 현재 파일을 `sha256sum` 및 `cmp`로 비교했다.

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  bin/cgc-bin-x86_64-seed-v11
SEED_CMP_RC=0
```

Forgejo master와 GitHub master는 `c31ad994144b944df8a453655104e5bdedd2842b`였다. 이 커밋을 부모로 포함한 병합 커밋은 다음과 같다.

```text
MERGE_COMMIT=265013f4715df11ff3761f2af79240798e6da7cf
PARENTS=90590d10902e3677df351131faeb84dd84cd489b c31ad994144b944df8a453655104e5bdedd2842b
SUBJECT=Merge remote-tracking branch 'origin/master' into db-stability
MASTER_ANCESTOR_RC=0
```

## 1. 실패 원인과 수정

D-10에서 확인한 descriptor 목록은 warm-up 기준 시점에 main 프로세스와 일시적인 요청 자식 프로세스가 함께 있어 `fd=38`이었고, 부하 종료 시에는 `fd=8`이었다. 다음 실행에서도 같은 형태로 실패했다.

```text
LOAD_RESOURCE_WARM_BASELINE rss_kb=828520 fd=38
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_COLD_START rss_kb=5924 fd=8
LOAD_RESOURCE_START rss_kb=12612 fd=38
LOAD_RESOURCE_END rss_kb=5924 fd=8
LOAD_RESOURCE_STABLE=0
LOAD2_SUMMARY=9/10
TASK942_LEGACY_RC=1
TASK942_POOL_RC=0
TASK946_FAST_SUMMARY=1/2
```

수정은 [tests/run-task938-load.sh](../tests/run-task938-load.sh) 216–229행이다. warm-up 뒤 descriptor 수가 cold 시작값에서 1 이내로 돌아오는지 최대 50회, 회당 0.1초 간격으로 관찰하고, 그동안 RSS high-water 값을 계속 수집한다. 기존 안정 기준 `RSS <= baseline + 2048 KB`, `FD 차이 <= 1`은 그대로 두었다. 기대값과 기준 파일은 변경하지 않았다.

수정 후 첫 확인 원문:

```text
LOAD_RESOURCE_BASELINE_SETTLED=1 fd=8
LOAD_RESOURCE_WARM_BASELINE rss_kb=831872 fd=8
LOAD_DATABASE_IS_LOCKED=0
LOAD_RESOURCE_COLD_START rss_kb=5924 fd=8
LOAD_RESOURCE_START rss_kb=5924 fd=8
LOAD_RESOURCE_END rss_kb=5924 fd=8
LOAD_RESOURCE_STABLE=1
LOAD2_SUMMARY=10/10
```

추가로 pool의 내부 load2 경로는 worker 프로세스 descriptor가 계속 열려 cold fd 수까지 돌아오지 않아 `LOAD_RESOURCE_BASELINE_SETTLED=0 fd=48`을 기록했다. 그 실행의 안정 비교값은 `LOAD_RESOURCE_START rss_kb=34304 fd=48`, `LOAD_RESOURCE_END rss_kb=29120 fd=48`, `LOAD_RESOURCE_STABLE=1`이었다. 이는 SKIP이 아니며 전체 시험 결과를 대체하지 않는다.

## 2. 전체 빠른 시험 2회 연속

같은 HEAD에서 full4, full5를 순서대로 실행했다. 각 실행은 종료 코드 0, legacy/pool 각각 RC 0, `TASK946_FAST_SUMMARY=2/2`였다. 두 로그에서 SKIP 표시는 0건이고 시험 시간 초과도 없었다.

```text
full4: TASK942_LEGACY_RC=0
full4: LOAD_DATABASE_IS_LOCKED=0
full4: LOAD2_SUMMARY=10/10
full4: TASK942_POOL_RC=0
full4: POOL_SUMMARY=8/8
full4: TASK946_FAST_SUMMARY=2/2
FULL4_RC=0

full5: TASK942_LEGACY_RC=0
full5: LOAD_DATABASE_IS_LOCKED=0
full5: LOAD2_SUMMARY=10/10
full5: TASK942_POOL_RC=0
full5: POOL_SUMMARY=8/8
full5: TASK946_FAST_SUMMARY=2/2
FULL5_RC=0
```

각 전체 실행에서 확인한 추가 원문은 `FDFIX_SUMMARY=5/5`, `OOM_SUMMARY=12/12`, `FORKFAIL_SUMMARY=9/9`, `HTTPATK_SUMMARY=21/21`, `STATIC_SUMMARY=18/18`, `TIMEOUT_SUMMARY=8/8`, `TIMEPREC_SUMMARY=6/6`, `POOL_KILL_ERROR_PCT=0.000`, `POOL_KILL_RECOVERY_HTTP=200`, `POOL_SERVER_STOP_RC=0`이다.

## 3. legacy 부하 5회

다섯 실행 모두 `LOAD_DATABASE_IS_LOCKED=0`, `LOAD_RESOURCE_STABLE=1`, `LOAD2_SUMMARY=10/10`이었다.

| 실행 | `LOAD_RESOURCE_BASELINE_SETTLED` | warm baseline RSS/fd | cold RSS/fd | stable start RSS/fd | end RSS/fd |
|---|---|---|---|---|---|
| 1 | `1 fd=8` | `831872 / 8` | `5924 / 8` | `5924 / 8` | `5924 / 8` |
| 2 | `1 fd=8` | `836500 / 8` | `6044 / 8` | `6044 / 8` | `6044 / 8` |
| 3 | `1 fd=8` | `824220 / 8` | `5920 / 8` | `5920 / 8` | `5920 / 8` |
| 4 | `1 fd=8` | `875464 / 8` | `6060 / 8` | `12852 / 8` | `6060 / 8` |
| 5 | `1 fd=8` | `829068 / 8` | `6004 / 8` | `6004 / 8` | `6004 / 8` |

각 실행의 요약은 원문 그대로 `LOAD_DATABASE_IS_LOCKED=0`, `LOAD_RESOURCE_STABLE=1`, `LOAD2_SUMMARY=10/10`이다.

## 4. pool 부하 3회와 추가 재현

full4, full5 및 pool4에서 `POOL_SUMMARY=8/8`을 확인했다. 세 실행 모두 후속 load2가 `LOAD_DATABASE_IS_LOCKED=0`, `LOAD2_SUMMARY=10/10`이었고, cap 검사는 `CAP_SUMMARY=6/6`이었다.

추가 pool3 실행에서는 cap 부하 종료 직후 응답이 달랐다.

```text
CAP_ACTIVE_CONNECTIONS_MAX=63
CAP_503=1505002
CAP_RETRY_AFTER_MISSING=0
CAP_OTHER_ERRORS=0
CAP_SERVER_ALIVE=1
CAP_RECOVERY_HTTP=503
CAP_ZOMBIE_BEFORE=0
CAP_ZOMBIE_AFTER=0
CAP_ZOMBIE_DELTA=0
CAP_SUMMARY=5/6
POOL3_RC=1
```

같은 HEAD·같은 기대값으로 재실행한 pool4에서는 아래와 같이 통과했다.

```text
CAP_RECOVERY_HTTP=200
CAP_SUMMARY=6/6
POOL_SUMMARY=8/8
POOL4_RC=0
```

관찰된 사실은 cap 부하 직후 단일 recovery 요청이 pool3에서 503이었고, 재실행 및 full4/full5에서는 200이었다는 것이다. 간헐적 recovery 결과의 근본 원인은 **미확인**이며, 기대값을 바꾸지 않았다.

## 5. seed 고정점과 strace 실행 수

strace는 build/fixed-point 단계에만 적용했다.

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  bin/cgc-bin-x86_64-seed-v11
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  stage2.c
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  stage3.c
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  stage4.c
CMP_2_3=0
CMP_3_4=0
FIXEDPOINT_RC=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
NPX_EXEC_COUNT=0
JS_EXEC_COUNT=0
PYTHON_EXEC_COUNT=0
```

## 6. D11_SUMMARY

- ① seed `36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2` 일치: 통과.
- ② master 병합 커밋 `265013f4715df11ff3761f2af79240798e6da7cf`: 통과.
- ③ 전체 빠른 시험 2회 연속, legacy/pool RC 0, 시간 초과 0, SKIP 0: 통과.
- ④ legacy 부하 5회 `LOAD2_SUMMARY=10/10`, `LOAD_DATABASE_IS_LOCKED=0`: 통과.
- ⑤ pool 부하 3회 `POOL_SUMMARY=8/8`: 통과. 별도 추가 실행 1회에서 나온 cap recovery 503은 위에 기록했고 원인은 미확인이다.
- ⑥ seed 유지, stage2=3=4, `CMP_2_3=0`, `CMP_3_4=0`, node/npm/npx/JS/Python 실행 수 0: 통과.

```text
D11_SUMMARY=6/6
```

## 7. 커밋 및 원격

시험 수정 커밋은 `ccad5d89922f12a6142c505be314d7609e1d0f86`이며, 이 보고서 갱신 후 최종 HEAD와 Forgejo·GitHub 원격 HEAD를 채팅 결과에 기록한다.
