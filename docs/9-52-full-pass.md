# 9-52a seed 재검증 및 전체 결과

## seed 재검증 — 가장 먼저 수행

요청한 명령 4개를 순서대로 실행했습니다. 첫 두 해시가 같고, seed 파일 변경 로그는 비어 있고, 바이트 비교는 `CMP=0`입니다.

```text
git show dec63e636a2b1225ba88b8d9b9e3a426e129f6f2:bin/cgc-bin-x86_64-seed-v11 | sha256sum
36a806b0aa9639ce34b4c5b3c04807944db9df3bfec3ae4e4780f22e8428edb2  -
sha256sum bin/cgc-bin-x86_64-seed-v11
36a806b0aa9639ce34b4c5b3c04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
git log --oneline dec63e63..HEAD -- bin/cgc-bin-x86_64-seed-v11
(출력 없음)
git cat-file -p dec63e63:bin/cgc-bin-x86_64-seed-v11 | cmp - bin/cgc-bin-x86_64-seed-v11; echo CMP=$?
CMP=0
```

판정: **seed 변경 없음**.

9-52a에서 실제 입력한 비교 명령은 다음과 같습니다(저장소 경로는 `<가림>` 처리).

```bash
sha256sum <가림>
sha256sum <가림> | awk '{print $1}' | diff - <(printf '%s\n' '36a806b0aa9639ce34b4c5b3c04807944db9df3bfec3ae4e4780f22e8428edb2')
expected='36a806b0aa9639ce34b4c5b3c04807944db9df3bfec3ae4e4780f22e8428edb2'
actual=$(sha256sum <가림> | cut -d ' ' -f1)
printf 'ACTUAL=%s\nEXPECTED=%s\n' "$actual" "$expected"
if [ "$actual" = "$expected" ]; then printf 'SEED_COMPARE=match\n'; else printf 'SEED_COMPARE=mismatch\n'; fi
```

`EXPECTED`는 파일에서 읽지 않고 지시서의 기준값을 작업자가 직접 옮겨 적은 값이었습니다. 그때 `SEED_COMPARE=mismatch`라고 보고했으나, 직접 입력 없이 Git blob·작업 파일을 비교한 이번 결과는 동일합니다. 앞선 mismatch는 seed 변경으로 재현되지 않았습니다. 어떤 문자 입력 차이가 났는지는 미확인입니다. 추측: 앞선 비교의 수기 입력 또는 비교식 구성 오류였습니다.

## b. 전체 시험 실패 원인

보존된 이전 전체 실행과 이번 재실행 모두 첫 실패는 legacy `fd-limit` 사례입니다. 오류는 DB 파일 열기 실패이며, `_app.fl` 외부 함수 변경과 연결되는 호출은 확인되지 않았습니다.

```text
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
```

이번 pool 하위 load2 기록에도 다음 실패가 있습니다.

```text
CASE=file-descriptor-limit-sqlite RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
OOM_SUMMARY=11/12
FORKFAIL_SUMMARY=8/9
```

## c. `style`, `random` 계약 시험 및 구현

시험과 기대 출력은 구현보다 먼저 커밋했습니다. 구현 전 시험은 예상대로 GCC에서 실패했습니다.

```text
PREIMPLEMENTATION_RC=1
<가림>/style-random.c:12:5: error: implicit declaration of function ‘style’ [-Wimplicit-function-declaration]
<가림>/style-random.c:13:13: error: implicit declaration of function ‘random’ [-Wimplicit-function-declaration]
<가림>/style-random.c:13:13: error: incompatible types when assigning to type ‘FLValue’ from type ‘int’
```

계약 시험 통과 출력:

```text
STYLE_RANDOM=PASS
```

`style`은 프런트엔드에서 CSS가 정적으로 생성된 뒤 실행 시에는 부수 효과가 없는 호출로 처리했습니다. `random`은 x86 호출을 `fl_random`에 매핑하고 `getrandom`의 상위 53비트로 `[0, 1)` 부동값을 반환합니다.

## d. `_app.fl` GCC 결과

GCC는 통과하지 않아 앱 실행 및 `/ok` HTTP 응답은 확인하지 않았습니다. 오류 수는 `error:` 진단 행을 센 값이며, 9-51 문서의 위치 진단 집계와는 집계 방식이 다릅니다.

| 시점 | GCC 오류 행 수 |
|---|---:|
| 작업 전 보존 GCC 로그 | 141 |
| `style` 구현 뒤 동일 생성 C | 140 |
| `random` 매핑 뒤 새 생성 C | 139 |

```text
APP_GCC_RC=1
APP_GCC_ERROR_LINES=139
```

남은 오류 종류 상위 5개:

```text
61 incompatible type for argument 3 of ‘fl_map_set’
22 lvalue required as left operand of assignment
13 invalid initializer
4 incompatible types when initializing type ‘enum <anonymous>’ using type ‘FLValue (*)(FLValue,  FLValue)’
3 ‘_plus’ undeclared (first use in this function)
```

## e. seed 고정점·전체 시험·실행 감사

전체 시험은 strace 없이 1회 실행했습니다. seed와 stage2=3=4의 해시 및 종료/요약 출력:

```text
36a806b0aa9639ce34b4c5b3c04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
d7751d4b654fbee80c9e166650dc87016fc84dc90cb39ce055de87d6b9aed4b4  <가림>/stage2.c
d7751d4b654fbee80c9e166650dc87016fc84dc90cb39ce055de87d6b9aed4b4  <가림>/stage3.c
d7751d4b654fbee80c9e166650dc87016fc84dc90cb39ce055de87d6b9aed4b4  <가림>/stage4.c
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
FULL_FAST_RC=1
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
TASK942_LEGACY_RC=1
TASK942_POOL_RC=1
TASK946_FAST_SUMMARY=0/2
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
CGC_SYMBOL_RC=0
ABI_SUMMARY=8/8
TASK920_RC=0
FULL_CHECK_RC=1
```

금지 실행 파일 확인은 별도 `strace`로 계약 시험 실행만 추적했습니다. 전체 회귀 시험의 strace 결과가 아닙니다.

```text
TRACE_TEST_RC=0
STYLE_RANDOM=PASS
EXECVE_LINES=282
NODE_EXEC=0
NPM_EXEC=0
NPX_EXEC=0
PYTHON_EXEC=0
JS_ARG=0
PY_ARG=0
```

민감정보 패턴 diff 검사와 공백 검사는 다음 결과였습니다.

```text
SENSITIVE_DIFF_MATCHES=0
git diff --check=PASS
```

## 변경 파일

- `runtime/process.c:24` — `style`; `runtime/process.c:29` — `fl_random`
- `runtime/runtime.h:382-383` — 함수 선언
- `self/cgc-main.fl:740` — `random`의 `fl_random` 호출 매핑
- `tests/task952/style-random.fl:1-5`, `tests/task952/style-random.expected:1`, `tests/task952/run-style-random.sh:1-12` — 계약 시험과 기대 출력

## 커밋 및 미확인 사항

테스트 선행 커밋 `78ba3f8e`; `style` 구현 및 C 호출 호환 수정 `a07fff8c`, `920275ac`; `random` 구현 `e4ae72bd`.

푸시 전 원격 HEAD 원문:

```text
0c40b68da172fbb8e0b8608c3f3fc4d2b7b9c93c	refs/heads/v11-x86-seed-public
0c40b68da172fbb8e0b8608c3f3fc4d2b7b9c93c	refs/heads/v11-x86-seed-public
```

문서와 작업 커밋은 Forgejo, GitHub 순서로 푸시하고 ref를 검증했습니다. 최종 ref는 전달 요약에 기록합니다.

미확인/실패: GCC 통과 및 `/ok` HTTP 200; 전체 회귀 종료 코드 `0`; legacy와 pool의 DB 파일 열기 실패 원인; 이전 `EXPECTED` 수기 입력에서의 정확한 문자 차이.

```text
X86_SUMMARY 4/5
```
