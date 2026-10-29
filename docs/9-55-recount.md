# 9-55 재검증 및 GCC 재집계

검증 기준 브랜치: `v11-x86-seed-public`. 코드 작업은 별칭 lowering 회귀 범위에 한정했다. 기대값과 seed는 바꾸지 않았다. 전체 부하 실행과 strace 계약 실행은 각각 `flock -o -w 3600 /tmp/fl-heavy.lock` 아래에서 수행했고 모든 기록은 `<가림>`에 보존했다.

## a. Seed 확인

실행 원문(파일 경로 표기만 지침에 따라 `<가림>` 처리):

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>/bin/cgc-bin-x86_64-seed-v11
CMP=0
```

`git log --oneline dec63e63..HEAD -- bin/cgc-bin-x86_64-seed-v11` 출력은 비어 있다. 판정: **seed 변경 없음**.

## b. `_app.fl` 재집계와 이전 수치 차이

재집계 스크립트 `scripts/recount-task955-app-gcc.sh`는 실행 전에 `7756b4a7`, `3b5e2dab`로 커밋했다. 두 revision의 compiler를 각각 `git archive`로 풀고 같은 `_app.fl`을 복사해 생성·컴파일했다. 카운트 방식은 두 경우 모두 `awk '/error:/ {n++}'`이며, 입력의 SHA-256도 동일하다.

```text
REVISION=f0c7ed67ae29e18e74517cc26dd59627e2a72335
APP_SHA256=67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed
APP_COMPILE_RC=1
APP_GCC_RC=1
APP_GCC_ERROR_LINES=30
REVISION=5009f43e87625c376e03088437ed250f65f8b608
APP_SHA256=67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed
APP_COMPILE_RC=1
APP_GCC_RC=1
APP_GCC_ERROR_LINES=65
RECOUNT_SCRIPT_RC=0
```

9-53의 `30`은 이 방법으로 f0c7ed67에서 다시 얻었다. 9-54의 `73`은 같은 입력에 대해 더 앞선 compiler 변경 단계에서 기록됐다. 9-54 보고서에는 뒤이어 `json_parse` lowering을 추가한 뒤 `65`가 됐다고 기록돼 있다. 따라서 `30` 대 `65`는 여기서 사용한 줄 세기 차이가 아니라 revision별 생성 C 차이이고, `73` 대 `65`는 `json_parse` lowering 전후 차이다.

현재 커밋의 동일 입력 재빌드 결과:

```text
67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed  <가림>/_app.fl
APP_GCC_ERROR_LINES=8
```

## c. 중단된 전체 실행 및 동시 실행 확인

9-54의 첫 시도 작업 기록은 `2026-10-29 01:07:11`에 만들어졌고, 마지막 `full.log` 수정 시각은 `2026-10-29 01:18:39`다. 로그 끝은 다음 부하 단계 기록이며 완료/종료 코드 기록은 없다.

```text
LOAD_STAGE stage=1 concurrency=10 created=10 create_failures=0 duration_s=60 elapsed_s=60.170 requests=600 rps=9.97 p50_ms=1.673 p99_ms=11.497 max_ms=12.426 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=120 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:120,static:120,jwt:120,read:120,write:120,slow300:0 status_codes=200:600
LOAD_ACK_IDS_SAVED=120
LOAD_SERVER_METRIC concurrency=10 rss_start_kb=6036 rss_max_kb=6036 fd_start=8 fd_max=8 zombie_max=0 zombie_end=0
LOAD_RECOVERY concurrency=10 HTTP_STATUS=200
LOAD_SERVER_ALIVE concurrency=10 value=1
LOAD_STAGE stage=2 concurrency=50 created=50 create_failures=0 duration_s=60 elapsed_s=60.562 requests=3000 rps=49.54 p50_ms=1.574 p99_ms=21.448 max_ms=432.446 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=600 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:600,static:600,jwt:600,read:600,write:600,slow300:0 status_codes=200:3000
LOAD_ACK_IDS_SAVED=600
```

두 번째 시도는 `2026-10-29 06:50:11` 기록 기준 실행 로그와 seed 출력이 모두 0 byte이고 전체 실행 종료 코드도 보존되지 않았다. 뒤이어 시작한 세 번째 실행은 완료 코드 `FULL_CHECK_RC=1`을 남겼다. 두 중단 시점에 코1 등 다른 무거운 시험이 함께 돌았는지 확인할 당시의 프로세스/lock-holder 스냅샷이 없어 **미확인**이다. 세 번째 실행은 아래 원문처럼 flock을 실제 사용했다. 첫 시도의 명령은 `flock -o -w 3600 /tmp/fl-heavy.lock`을 사용한 기록이 남아 있으며, 두 번째의 전체 nohup wrapper 문자열은 보존되지 않았다.

```sh
flock -o -w 3600 /tmp/fl-heavy.lock bash -c 'set +e; bash tests/run-task949-full-check.sh <가림> > <가림> 2>&1; rc=$?; printf "FULL_CHECK_RC=%s\n" "$rc" | tee <가림>; exit 0'
```

## d. 전체 시험 및 strace 계약

변경 후 전체 시험은 strace 없이 위 flock 명령으로 1회 완주했다. stage2=stage3=stage4 고정점은 아래와 같다.

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>/bin/cgc-bin-x86_64-seed-v11
de88c34be0b65888ec2899c649d3e2acaf439bad6064c248d95565c12ec65839  <가림>/stage2.c
de88c34be0b65888ec2899c649d3e2acaf439bad6064c248d95565c12ec65839  <가림>/stage3.c
de88c34be0b65888ec2899c649d3e2acaf439bad6064c248d95565c12ec65839  <가림>/stage4.c
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
FULL_CHECK_RC=1
```

전체시험 첫 실패 및 관련 원문:

```text
FAIL 50 reads and 20 creates return all responses
FAIL concurrent creates add exactly twenty SQLite items
BULK_RESPONSES=GET_50/50 POST_20/18
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=18 DELTA=18
CONC_SUMMARY=6/8
LOAD_DATABASE_IS_LOCKED=194
LOAD2_SUMMARY=9/10
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
FDFIX_SUMMARY=4/5
TASK942_LEGACY_RC=1
```

pool 실행의 load2는 다음 값을 남겼지만 전체 pool은 실패했다. `POOL_SUMMARY`는 출력되지 않았다. 자원/worker-kill 단계의 완료 원인은 해당 단계 종료 코드가 저장되지 않아 **미확인**이다.

```text
LOAD_DATABASE_IS_LOCKED=0
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
CAP_SUMMARY=6/6
TASK942_POOL_RC=1
TASK946_FAST_SUMMARY=0/2
CGC_SYMBOL_SUMMARY=5/5
ABI_SUMMARY=8/8
TASK920_RC=0
```

strace 계약은 별도로, flock 안에서 `strace -f -e trace=execve -o <가림> bash tests/run-cgc-symbol-contract.sh`로 실행했다.

```text
STRACE_CONTRACT_RC=0
NODE_EXECUTIONS=0
NPM_EXECUTIONS=0
NPX_EXECUTIONS=0
JS_EXECUTIONS=0
PYTHON_EXECUTIONS=0
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
```

## e. 8개 invalid initializer 수정 및 GCC 결과

원인은 `_app.fl`에서 직접 사용한 `time_now`, `date_now`, `req_query_default` 이름이 x86 backend의 하이픈 표기 runtime lowering과 연결되지 않은 것이었다. 수정 전 별도 회귀 입력은 GCC에서 implicit declaration / 잘못된 `int` 반환형 오류로 실패했다. 입력과 기대 출력 커밋 `9458820f` 이후 `self/cgc-main.fl`의 이름 대응을 보완했다(수정 커밋 `0a1557c2`). 기존 기대 파일은 수정하지 않았다.

```text
BACKEND_CASE=native-time-query-underscore COMPILE_RC=0
BACKEND_CASE=native-time-query-underscore GCC_RC=0
BACKEND_CASE=native-time-query-underscore OUTPUT=PASS
BACKEND_CASES_PASSED=1
```

새 `_app.fl` 생성 결과에서 `invalid initializer`는 8개에서 0개로 줄었다. 전체 GCC 오류는 8개 남아 통과하지 못했다. 오류 상위 5종은 현재 남은 전부다.

```text
APP_GCC_ERROR_LINES=8
3 ‘_plus’ undeclared (first use in this function)
2 ‘str’ undeclared (first use in this function)
1 incompatible type for argument 1 of ‘fl_reduce_fn’
1 implicit declaration of function ‘validate_range’ [-Wimplicit-function-declaration]
1 implicit declaration of function ‘validate_length’ [-Wimplicit-function-declaration]
```

GCC 미통과이므로 `/ok` HTTP 요청은 실행하지 않았다. 남은 8개 오류는 이 지시서의 invalid initializer 수정 범위 밖으로 남았다.

## 변경 파일 및 커밋

- `scripts/recount-task955-app-gcc.sh` — 집계 전 커밋 `7756b4a7`, `3b5e2dab`.
- `tests/task944/native-time-query-underscore.fl:1` — 별칭 회귀 입력.
- `tests/task944/native-time-query-underscore.expected:1` — 신규 사례 기대 출력.
- `tests/run-task944-backend.sh:17` — 신규 사례를 backend runner에 포함.
- `self/cgc-main.fl:741-745`, `self/cgc-main.fl:829-830` — underscore runtime aliases.
- 민감정보 패턴 diff 검사: 두 기능 커밋 전 각각 `SENSITIVE_DIFF_MATCHES=0`.

보고서 작성 시 로컬 branch HEAD: `0a1557c28b86aaaa8efe6126249b27cb0d19810f`. 보고서 커밋과 원격 push 뒤 실제 두 원격 HEAD는 최종 작업 응답에 명령 출력 그대로 기록한다. 두 중단 시험 당시의 동시 시험/프로세스 상태 및 legacy/pool 실패 단계의 종료 원인은 미확인이다.

## X86_SUMMARY

`X86_SUMMARY=4/5` — seed 유지, 같은 입력/같은 카운트 방식 재집계, 전체 및 strace 시험 수행, invalid initializer 8개 제거를 확인했다. 과거 두 실행 시점의 동시 시험 여부는 로그/프로세스 스냅샷 부재로 검증할 수 없다. 전체 부하 시험은 `FULL_CHECK_RC=1`이며 `_app.fl`은 GCC 오류 8개가 남았다.
