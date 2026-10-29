# 9-56 GCC 오류 0 재검증

브랜치 `v11-x86-seed-public`, 시작 HEAD `b10599f3`. 전체 실행과 strace 계약 실행은 각각 `flock -o -w 3600 /tmp/fl-heavy.lock` 아래에서 했다. 실행 로그와 `ps` 기록은 보존했다. 로컬 경로는 `<가림>`으로 표시했다.

## a. seed 확인

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  bin/cgc-bin-x86_64-seed-v11
CMP=0
```

`git log --oneline dec63e63..HEAD -- bin/cgc-bin-x86_64-seed-v11` 출력은 비어 있었다. 판정: **seed 변경 없음**.

## b. `_app.fl` GCC 오류와 수정

동일 입력 `_app.fl` SHA-256은 다음과 같다.

```text
67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed
```

GCC 오류 줄 수는 `scripts/recount-task955-app-gcc.sh`로 재계산했다. 기록된 단계는 `8 → 3 → 2 → 0`이다.

| 단계 | 변경 | GCC 오류 줄 수 | `_app.fl` SHA-256 |
|---|---|---:|---|
| 시작 HEAD `b10599f3` | 기준 | 8 | `67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed` |
| `cf44c831` | `+`, `str` 함수값 lower | 3 | `67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed` |
| `1ad1eaa4` | `max` 함수값 lower | 2 | `67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed` |
| `2e3ccc17` | 검증 런타임 함수 추가 | 0 | `67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed` |
| 현재 `0b0f2450` | 선택 DB 인자 기본값 및 `str` 함수값 수정 포함 | 0 | `67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed` |

시작 시 오류 원문과 원인은 다음과 같다. 반복 개수는 GCC 오류 줄 수 집계 원문이다.

```text
3 ‘_plus’ undeclared (first use in this function)
2 ‘str’ undeclared (first use in this function)
1 incompatible type for argument 1 of ‘fl_reduce_fn’
1 implicit declaration of function ‘validate_range’ [-Wimplicit-function-declaration]
1 implicit declaration of function ‘validate_length’ [-Wimplicit-function-declaration]
```

`+`, `str`, `max`는 함수값으로 lower 되지 않았고, `validate_range`, `validate_length`는 x86 런타임 선언·구현이 없었다. 각 회귀 입력은 수정 전에 커밋했다. 마지막 재집계 출력:

```text
REVISION=HEAD
APP_SHA256=67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed
APP_COMPILE_RC=0
APP_GCC_RC=0
APP_GCC_ERROR_LINES=0
RECOUNT_RC=0
```

DB의 선택 인자를 생략하면 native lowering이 `nil`을 넘기는 회귀도 재현했다. 이미 커밋한 `task956-db-default-params`는 수정 전 `database parameters must be an array`로 실패했고, lowering이 빈 벡터를 넘기도록 수정한 뒤 결과는 다음과 같다.

```text
BACKEND_CASE=task956-db-default-params COMPILE_RC=0
BACKEND_CASE=task956-db-default-params GCC_RC=0
BACKEND_CASE=task956-db-default-params OUTPUT=PASS
BACKEND_CASES_PASSED=1
```

## c. 앱 `/ok`

GCC 오류 0인 생성 C를 runtime과 링크하고 앱을 실행했다. DB 선택 인자 오류는 사라졌지만, route 등록 단계에서 앱이 종료되어 `/ok` HTTP 응답은 없었다.

```text
APP_LINK_RC=0
CURL_RC=7
OK_HTTP_CODE=000
OK_BODY_FIRST_LINE=<none>
APP_EXIT_RC=1

실행 오류  <stdin>:1
  ✖ HTTP route capacity exceeded or handler is not a function
```

생성 C의 route 인자는 `fl_str_val("page_about")` 같은 문자열이고 `fl_http_route`는 `FL_FN` handler를 요구한다. 앱 프로세스는 종료됐다. 이 route 문제는 이번 GCC 오류 수정 범위에서 고치지 않았다.

## d. 전체 시험

실행 명령은 `flock -o -w 3600 /tmp/fl-heavy.lock` 아래에서 `bash tests/run-task949-full-check.sh <가림>`이었다. 실행 직전과 직후 `ps -eo pid,ppid,stat,etime,args`를 저장했다.

```text
FULL_CHECK_RC=1
PS_BEFORE_LINES=1060
PS_AFTER_LINES=1069
```

전체 실행 중간의 `ps`에는 별도 `verify-l08-phase3-self.sh` 검사 프로세스도 보였다. 그 프로세스의 시작·종료 시각과 flock 사용 여부는 기록으로 확인되지 않아, 완전한 단독 실행 여부는 **미확인**이다.

전체 로그의 최초 실패 원문:

```text
LOAD_FAST_SUITE_RC=1
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
FDFIX_RECOVERY_RC=0 ROWS=1
```

요청한 전체 결과:

```text
CONC_SUMMARY: 출력 없음
LOAD_DATABASE_IS_LOCKED=187
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
TASK942_LEGACY_RC=1
LOAD_DATABASE_IS_LOCKED=0
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
TASK942_POOL_RC=1
TASK946_FAST_SUMMARY=0/2
FULL_FAST_RC=1
FULL_CHECK_RC=1
```

DB 관련 실패는 기록만 했으며 DB 코드는 수정하지 않았다. 전체 실행 중 native forms에서 `str expects two arguments`가 발생해 묶음의 `CGC_SYMBOL_SUMMARY=FAIL`이 기록됐다. 이 회귀는 기존 `str` 함수값의 단항 호출 실패였고, `runtime/math.c` 수정 뒤 별도 strace 계약에서 재검증했다(아래 e). 전체 시험 자체는 후속에 다시 돌리지 않았다.

## e. 고정점 및 strace 계약

전체 실행의 stage2/3/4 출력:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>/bin/cgc-bin-x86_64-seed-v11
1b27d3d6c66a5a80c6a10fdc108fb9faeb3aa7401c63b31b2a4d24c1e05294d9  <가림>/stage2.c
1b27d3d6c66a5a80c6a10fdc108fb9faeb3aa7401c63b31b2a4d24c1e05294d9  <가림>/stage3.c
1b27d3d6c66a5a80c6a10fdc108fb9faeb3aa7401c63b31b2a4d24c1e05294d9  <가림>/stage4.c
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

첫 strace 계약 실행은 기존 native forms 검사에서 아래 오류로 실패했다. `str` 함수값을 가변 인자 문자열 결합으로 수정한 뒤 같은 계약 시험을 다시 실행했다.

```text
실행 오류  <stdin>:1
  ✖ str expects two arguments
```

수정 후 실행 원문:

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

전체 시험에서 ABI 결과도 보존했다.

```text
ABI_SUMMARY=8/8
TASK920_RC=0
```

## 변경 파일 및 커밋

- `tests/task944/task956-reduce-callables.fl`, `tests/task944/task956-reduce-max.fl`, `tests/task944/task956-validate-calls.fl`, `tests/task944/task956-validate-reject.fl`, `tests/task944/task956-db-default-params.fl` — 회귀 입력 및 기대 결과.
- `self/cgc-main.fl:951-954` — builtin 함수값 lowering.
- `self/cgc-main.fl:1354-1355` — 생략된 DB params의 빈 벡터 기본값.
- `runtime/math.c:685-695` — `str` closure 함수값의 인자 처리.
- `runtime/math.c:710-742`, `runtime/runtime.h` — `validate_range`, `validate_length`.
- 기능별 수정 전 민감정보 diff 검사 출력은 `SENSITIVE_DIFF_MATCHES=0`이었다.

작업 커밋은 `5e6b65b8`, `cf44c831`, `f366d84b`, `1ad1eaa4`, `7ad48944`, `2e3ccc17`, `c198fb1c`, `bf1a1ba5`, `0b0f2450` 순이다. 첫 보고서 커밋 `673387c1`을 푸시한 직후 양 원격 HEAD는 다음과 같았다.

```text
673387c1f9c94aa170bd0c0d500f5b71554df683	refs/heads/v11-x86-seed-public
673387c1f9c94aa170bd0c0d500f5b71554df683	refs/heads/v11-x86-seed-public
```

위 출력 순서는 Forgejo, GitHub다. 보고서의 최신본은 [GitHub에서 확인](https://github.com/kimjindol2025/freelang-v11/blob/v11-x86-seed-public/docs/9-56-gcc-zero.md)할 수 있다. 최신 보고서 커밋 이후 최종 양 원격 HEAD는 최종 응답에 기록한다.

## X86_SUMMARY

`X86_SUMMARY=3/5` — a(seed 유지), b(GCC 오류 0), e(고정점 및 수정 뒤 strace 계약)는 확인했다. c(`/ok`)는 앱 초기화 실패, d(전체 시험)는 `FULL_CHECK_RC=1`로 미통과다. DB 실패 및 전체 시험 동시 부하는 미확인 상태로 남긴다.
