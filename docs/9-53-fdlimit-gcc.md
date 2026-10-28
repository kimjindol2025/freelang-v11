# 9-53 fd-limit / GCC 결과

기준 브랜치: `v11-x86-seed-public`. 시험은 메인 작업 위치에서 실행했다. 별도 73 실행은 하지 않았다.

## a. Seed

직접 확인한 원문:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
CMP=0
```

판정: seed 변경 없음.

## b. fd-limit 원인

집계 스크립트 `tests/task953/fdlimit-five.sh`를 먼저 커밋한 뒤, 같은 잠금 아래 수정 없는 스크립트를 5회 실행했다. 각 회차의 원문:

```text
FDFIX_ATTEMPT=1
TEMP_DIR_MODE=700 TEMP_DIR_TYPE=directory
DB_MODE=644 DB_TYPE=regular file DB_SIZE=8192
FDFIX_CASE=fd-limit RC=1 ERROR=db-exec: unable to open database file (sqlite=14)
EMFILE_EVENTS=4
FDFIX_ATTEMPT=2
TEMP_DIR_MODE=700 TEMP_DIR_TYPE=directory
DB_MODE=644 DB_TYPE=regular file DB_SIZE=8192
FDFIX_CASE=fd-limit RC=1 ERROR=db-exec: unable to open database file (sqlite=14)
EMFILE_EVENTS=4
FDFIX_ATTEMPT=3
TEMP_DIR_MODE=700 TEMP_DIR_TYPE=directory
DB_MODE=644 DB_TYPE=regular file DB_SIZE=8192
FDFIX_CASE=fd-limit RC=1 ERROR=db-exec: unable to open database file (sqlite=14)
EMFILE_EVENTS=4
FDFIX_ATTEMPT=4
TEMP_DIR_MODE=700 TEMP_DIR_TYPE=directory
DB_MODE=644 DB_TYPE=regular file DB_SIZE=8192
FDFIX_CASE=fd-limit RC=1 ERROR=db-exec: unable to open database file (sqlite=14)
EMFILE_EVENTS=4
FDFIX_ATTEMPT=5
TEMP_DIR_MODE=700 TEMP_DIR_TYPE=directory
DB_MODE=644 DB_TYPE=regular file DB_SIZE=8192
FDFIX_CASE=fd-limit RC=1 ERROR=db-exec: unable to open database file (sqlite=14)
EMFILE_EVENTS=4
```

각 시험은 `prlimit --nofile=4:4`로 실행을 요청했다. DB 경로는 `<가림>`이며, 디렉터리 `700`, DB 파일 `644`이다. 각 strace에서 DB `openat`은 fd `3`으로 성공하고 후속 SQLite 파일 `openat`은 `EMFILE`로 실패했다. 당시 프로세스의 fd `0,1,2,3`이 한도 4를 채운 것으로 판정한다. 이전 제한 없는 복구 기록은 `FDFIX_RECOVERY_RC=0 ROWS=1`이다. 근거상 런타임 fd 누수보다 시험 제한값이 지나치게 낮은 환경 문제다. 런타임은 변경하지 않았다.

대표 strace 원문(경로 가림):

```text
openat(AT_FDCWD<가림>, "<가림>", O_RDWR|O_CREAT|O_NOFOLLOW|O_CLOEXEC, 0644) = 3<가림>
openat(AT_FDCWD<가림>, "<가림>", O_RDWR|O_CREAT|O_NOFOLLOW|O_CLOEXEC, 0644) = -1 EMFILE (Too many open files)
openat(AT_FDCWD<가림>, "<가림>", O_RDONLY|O_NOFOLLOW|O_CLOEXEC) = -1 EMFILE (Too many open files)
```

## c. `_app.fl` GCC 오류

9-52 기록의 기준 오류는 139줄이며 상위 원인은 `fl_map_set` 인자 형식 61, lvalue 22, invalid initializer 13이었다. 생성 C 예:

```c
__fl_te = fl_map_set(__fl_te, fl_str_val("ui_btn"), ui_btn);
```

`ui_btn` 함수 포인터가 전역 값 자리에도 같은 C 이름으로 생성되어 인자 형식 및 lvalue 오류를 만들었다. 재현 시험 `template-global-function`과 기대 출력을 먼저 커밋했고 수정 후 시험 출력은 `TEMPLATE GLOBAL`, `FUNCTION`이다. 고친 곳은 `<가림>/self/cgc-main.fl:1813-1825`이다.

| 단계 | GCC 오류 줄 수 | 관찰 |
|---|---:|---|
| 이전 `_app.fl` 기록 | 139 | `fl_map_set` 61, lvalue 22, invalid initializer 13 |
| 이름 충돌 수정 후 | 30 | `fl_map_set` 0, lvalue 0, invalid initializer 13 |

현재 남은 주요 진단은 `invalid initializer` 13, `_plus` 미선언 3, `fl_or` 인자 형식 3, `str` 미선언 2, `get` 인자 형식 2이다. 미선언 호출 `time_now`, `date_now`, `req_query_default`, `json_parse`, `validate_range`, `validate_length` 등이 포함된다. 이 항목은 해결하지 않았다. GCC 통과가 아니므로 `/ok` HTTP 확인은 미실행이다.

## d. 전체 시험 및 고정점

전체 집계는 strace 없이 1회 실행했다. 첫 시도는 집계기 출력 파일을 작업 디렉터리 안에 만들면서 `task 9-49 work directory must be empty`로 본시험 전에 끝났다. 그 기록을 보존하고 별도 로그 위치 및 새 빈 작업 디렉터리로 본 실행을 진행했다.

전체 시험 출력:

```text
FULL_CHECK_RC=1
FULL_FAST_RC=1
LOAD2_SUMMARY=9/10
TASK942_LEGACY_RC=1
TASK942_POOL_RC=1
TASK946_FAST_SUMMARY=0/2
CGC_SYMBOL_SUMMARY=FAIL
CGC_SYMBOL_RC=1
ABI_SUMMARY=8/8
TASK920_RC=0
```

첫 실패는 `tests/run-cgc-symbol-contract.sh`의 `cgc-invalid-c.fl` 거부 기대 검사다. 이름 충돌 수정 뒤 해당 케이스가 계속 컴파일되어, 기존 부정 시험 기대와 새 동작이 충돌했다. 기대 파일은 수정하지 않았다. 이후 부하 시험도 요약상 실패했으나 별도 원인 분석은 하지 않았다.

고정점 원문(경로 가림):

```text
71e76efcc2bf87679ed2846e4e9a261604712e3462282088b10433ea693ab04c  <가림>
71e76efcc2bf87679ed2846e4e9a261604712e3462282088b10433ea693ab04c  <가림>
71e76efcc2bf87679ed2846e4e9a261604712e3462282088b10433ea693ab04c  <가림>
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

고정점 해시는 새 번역기 변경이 반영된 생성 C다. 세 단계가 서로 일치한다.

## e. strace 실행 계약

별도 strace 계약 실행 범위는 커밋된 `template-global-function` 백엔드 회귀 시험이다. 원문:

```text
STRACE_CONTRACT_RC=0
NODE_EXECUTIONS=0
NPM_EXECUTIONS=0
NPX_EXECUTIONS=0
JS_EXECUTIONS=0
PYTHON_EXECUTIONS=0
BACKEND_CASE=template-global-function COMPILE_RC=0
BACKEND_CASE=template-global-function GCC_RC=0
BACKEND_CASE=template-global-function OUTPUT=PASS
BACKEND_CASES_PASSED=1
```

이 결과는 해당 회귀 경로에 한정되며, 전체 시험을 strace로 실행한 결과가 아니다.

## 변경 및 이력

- `<가림>/tests/task953/fdlimit-five.sh:20-44`: fd-limit 5회 기록기. 최초 시도에서 strace 자체에도 낮은 fd 한도가 적용되는 하네스 오류가 나와, 한도를 `prlimit` 대상 프로세스에만 적용하도록 고쳤다.
- `<가림>/tests/task944/template-global-function.fl:1-4`, `<가림>/tests/task944/template-global-function.expected:1-2`, `<가림>/tests/run-task944-backend.sh`: 회귀 입력, 기대 출력, 실행 연결.
- 민감 정보 diff 검사: 커밋 전 모두 `0`건.
- 이번 작업 커밋: `53eac7f67753f276705a7840d7b8f1d6a378bacd`, `99fb085ad8f1f5e4b307f49e1d473b8d6e51065b`, `d8d897a1c02e7657dee218ada7794dcc18308943`, `8e53473007c8dac949138869b2534403074477eb`.
- 푸시 직전 두 원격 HEAD는 모두 `abd1f00454df51dd62eb748db4ffa4850d32cb7a`였다. 보고서 커밋 및 최종 푸시 HEAD는 푸시 후 확인한다.

X86_SUMMARY 2/5

미확인: `_app.fl` 남은 GCC 오류의 수정, `/ok`, 전체 시험 실패의 원인 수정. 전체 시험 및 5회 fd 시험 기록은 보존했다.
