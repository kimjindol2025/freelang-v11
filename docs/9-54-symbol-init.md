# 9-54 symbol collision / initializer 결과

브랜치 `v11-x86-seed-public`; 기준 HEAD `f0c7ed67`. 무거운 시험은 `fl-heavy.lock` 아래서 실행했다. 원문 경로는 `<가림>`으로 표시했다.

## a. Seed

명령 출력:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  bin/cgc-bin-x86_64-seed-v11
CMP=0
```

판정: seed 변경 없음.

## b. C 심볼 충돌

`cgc-invalid-c.fl`은 같은 원본 이름 `broken`의 전역과 함수가 변환 C에서 같은 심볼을 선언할 때 GCC가 거부하는지 확인한다. 현재 compiler 원문:

```text
CGC_INVALID_RC=1
CGC_INVALID_GCC_ERRORS=2
<가림>:7:16: error: ‘broken’ redeclared as different kind of symbol
<가림>:23:12: error: lvalue required as left operand of assignment
[CGC-ERR] generated C failed gcc -fsyntax-only: <가림>
```

이전 수정은 함수와 같은 C base 이름을 가진 전역을 전부 새 이름으로 바꾸어 `broken`도 GCC에 도달하기 전에 고쳐 버렸다. 원인은 충돌 여부만 확인하고 원본 이름이 같은지 구분하지 않은 점이다. 수정 후에는 전역과 함수의 원본이 다르고 하이픈/밑줄 치환 관계인 경우에만 전역 이름을 remap한다. 따라서 `broken`의 기존 거부 동작은 유지되고, `ui-btn` 전역과 `ui_btn` 함수처럼 치환 과정에서만 겹치는 이름은 함께 동작한다.

원본 기대값은 바꾸지 않았다. `<가림>/tests/cgc-invalid-c.fl` 및 기존 기대 파일 diff는 비어 있다. 회귀 입력은 `<가림>/tests/task944/template-global-function.fl:1-4`에서 실제 별칭 이름을 사용하도록 고쳤고 기대 출력은 유지했다. 결과:

```text
BACKEND_CASE=template-global-function COMPILE_RC=0
BACKEND_CASE=template-global-function GCC_RC=0
BACKEND_CASE=template-global-function OUTPUT=PASS
BACKEND_CASES_PASSED=1
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
```

수정 위치: `<가림>/self/cgc-main.fl:1814-1836`.

## c. `_app.fl` invalid initializer

수정 전 재현 시험을 먼저 커밋했다. 생성 C 한 줄과 GCC 오류:

```c
FLValue parsed = json_parse(raw);
```

```text
implicit declaration of function ‘json_parse’; did you mean ‘fl_json_parse’
error: invalid initializer
[CGC-ERR] generated C failed gcc -fsyntax-only: <가림>
```

원인은 `_app.fl`의 `json_parse` 호출이 runtime의 `fl_json_parse`로 lowering되지 않아 C가 선언되지 않은 정수 반환 함수로 처리한 것이다. `<가림>/self/cgc-main.fl:737-740`에 native 이름 대응 한 줄을 추가했다. 회귀 시험은 `json_parse` 호출을 컴파일하고 JSON의 `yes` 값을 출력한다.

| 단계 | `_app.fl` GCC 오류 줄 수 | `invalid initializer` |
|---|---:|---:|
| 별칭 충돌 범위 수정 후, `json_parse` 수정 전 | 73 | 13 |
| `json_parse` native lowering 후 | 65 | 8 |

회귀 출력:

```text
BACKEND_CASE=json-parse-alias COMPILE_RC=0
BACKEND_CASE=json-parse-alias GCC_RC=0
BACKEND_CASE=json-parse-alias OUTPUT=PASS
BACKEND_CASES_PASSED=1
```

## d. GCC 및 HTTP

GCC는 아직 통과하지 못했다. 남은 상위 5개 진단:

```text
12 lvalue required as left operand of assignment
8 invalid initializer
5 incompatible type for argument 3 of ‘fl_map_set’
4 incompatible types when initializing type ‘enum <anonymous>’ using type ‘FLValue (*)(FLValue,  FLValue)’
3 ‘_plus’ undeclared (first use in this function)
```

따라서 `_app.fl`의 `/ok` HTTP 상태는 확인하지 않았다.

## e. 전체 시험, 고정점, strace

전체 시험은 strace 없이 완료 실행 1회를 수행했다. 초기 두 번의 시도는 종료 원문을 남기지 못해 미완료로 기록을 보존했고, 완주한 실행은 별도 빈 작업 디렉터리에서 수행했다. 첫 실행의 종료 원인은 확인되지 않았다.

완주 실행 첫 실패 메트릭과 전체 원문:

```text
LOAD_DATABASE_IS_LOCKED=194
LOAD2_SUMMARY=9/10
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
FDFIX_RECOVERY_RC=0 ROWS=1
FDFIX_SUMMARY=4/5
FULL_FAST_RC=1
TASK942_LEGACY_RC=1
TASK942_POOL_RC=1
TASK946_FAST_SUMMARY=0/2
CGC_SYMBOL_SUMMARY=5/5
ABI_SUMMARY=8/8
TASK920_RC=0
FULL_CHECK_RC=1
```

고정점 출력:

```text
e8d1e9300b0ba7aaa966de0df31132b5aae0b6eb4dfd1eb9575f97398304329e  <가림>
e8d1e9300b0ba7aaa966de0df31132b5aae0b6eb4dfd1eb9575f97398304329e  <가림>
e8d1e9300b0ba7aaa966de0df31132b5aae0b6eb4dfd1eb9575f97398304329e  <가림>
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

strace 계약 시험은 `run-cgc-symbol-contract.sh` 범위에서 별도 실행했다:

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

## 커밋 및 남은 확인

- `3da4188e70b849e157c993dc46365de58803fa86` — 별칭 충돌 회귀 입력
- `128caf72523e618b3d3b387b0e607fbf13efc259` — 충돌 remap 범위 제한
- `587afeefba101a90eafffee0c9a60208444138d0` — `json_parse` initializer 회귀 시험
- `598b1097e756f4e5bc365d6ab2e8ea33be2a2a9b` — native `json_parse` lowering
- 민감정보 diff 검사: 커밋 전 각 `0`건.

X86_SUMMARY 2/5

미완료: `_app.fl` GCC 오류 65줄 및 initializer 8개, `/ok`, 전체 시험의 `LOAD_DATABASE_IS_LOCKED=194` 원인. 첫 두 전체시험 시도의 종료 원인도 미확인이다.
