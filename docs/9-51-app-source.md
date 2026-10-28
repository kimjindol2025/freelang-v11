# 9-51 `_app.fl` 원본 추적과 x86 외부 호출

## 1. 단계별 결과

실행 위치: 메인 로컬 x86 작업 트리. 무거운 전체 시험과 별도 strace 스모크는 공유 잠금 안에서 실행했습니다.

### a. `_app.fl` 입력 원본

단일 생성 파일을 찾았습니다. 저장소 안의 파일이 아니라 보존된 빌드 산출물입니다. 당시 9-48/9-49 GCC 실행 기록에는 입력 파일 SHA-256이 없으므로 아래 해시를 당시 기록의 해시라고 단정할 수 없습니다. 프런트엔드 커밋과 생성 시각을 고정해 다시 만든 파일은 아래 해시와 일치했습니다.

```text
10459 <가림>/_app.fl
67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed  <가림>/_app.fl
FRONTEND_HEAD=9c1202dae761f1faff777c48887ed19f5960b3c9
```

복원 스크립트 `scripts/rebuild-task951-app-source.sh`는 해당 프런트엔드 커밋을 아카이브하고 빌드 산출물의 기록된 생성 시각을 적용합니다. 스크립트와 결과 해시는 보존했으며, 재생성 결과는 보존된 입력 파일과 `cmp` 일치했습니다. 이 스크립트는 원본을 찾고 다시 만드는 데 쓰였으며, 기본 x86 빌드가 JS를 실행하지 않는다는 증거로 사용하지 않습니다.

기록상 9-48은 `267`, 9-49는 `212` GCC 오류를 보고했으나 당시 실행 입력의 해시나 실행 명령 전체가 보존되어 있지 않습니다. 따라서 그 숫자를 새로 만든 입력에 대한 동일 조건 측정으로 재현하지 못했습니다.

### b–c. 동일 입력 GCC 기준 및 함수별 변화

복원한 동일 `_app.fl`에서 각 시점의 런타임/컴파일러로 다시 생성한 C를 GCC 검사했습니다. GCC는 통과하지 않았습니다. 9-50 누락 함수 목록에서 남은 호출을 오류 순서대로 진행했으며 각 테스트/기대 출력 커밋을 구현 커밋보다 먼저 만들었습니다.

| 측정 시점 | HEAD | GCC 종료 코드 | 위치 오류 행 수 |
|---|---|---:|---:|
| 9-50 구현 전 기준 | `17bb1d1fd60a14512b79aca5684fc6857e7e2b18` | 1 | 205 |
| 이번 작업 시작 | `c4d7736798cd0f4c6a80827ed51678c0b69a4f7e` | 1 | 115 |
| `http_head` 구현 후 | 이번 작업 커밋 | 1 | 113 |
| `http_delete` 구현 후 | 이번 작업 커밋 | 1 | 111 |
| `base64_encode` 구현 후 | 이번 작업 커밋 | 1 | 110 |
| `base64_decode` 구현 후 | 이번 작업 커밋 | 1 | 108 |
| `server_redirect_cookie` 구현 후 | `6b7c4bfee40081fd7460bbb9696b81411f6da124` | 1 | 106 |

각 수치는 보존된 단계별 GCC 로그의 위치 오류 행 집계입니다. 9-50 누락 목록에서 `style`과 `random`은 구현하지 않았습니다. 현재 GCC 실패로 `/ok` 실행을 진행하지 않았습니다.

이번 작업 추가 시험의 보존된 출력:

```text
PRE_RC=1
HTTP_HEAD_STATUS=200 HTTP_DELETE_STATUS=204 SERVER_VALID=1
BASE64_PRE_RC=1
BASE64_ENCODE=SGVsbG8h BASE64_DECODE=Hello!
PRE_RC=1
REDIRECT_COOKIE_STATUS=302 FIELDS_VALID=1
```

시험은 구현 전 기대 동작 및 HTTP 응답 필드를 검사합니다. ARM/기존 JS 구현과 직접 결과 비교는 수행하지 않았습니다.

최종 남은 GCC 오류 종류 상위 5개 원문:

```text
26 incompatible type for argument 3 of ‘fl_map_set’
22 lvalue required as left operand of assignment
13 invalid initializer
4 incompatible types when initializing type ‘enum <anonymous>’ using type ‘FLValue (*)(FLValue,  FLValue)’
3 ‘_plus’ undeclared (first use in this function)
```

### d–e. 앱 및 전체 시험

GCC가 실패하므로 앱 서버와 `/ok` HTTP 200은 미검증입니다. 전체 고정점/회귀 스크립트는 한 번 실행했으며 종료 코드 `1`입니다. 기록에는 `LOAD2_SUMMARY=9/10`, `FDFIX_SUMMARY=4/5`, `TASK942_LEGACY_RC=1`, `TASK946_FAST_SUMMARY=1/2`가 있고, 같은 실행 중 후속 반복에는 `LOAD2_SUMMARY=10/10`, `FDFIX_SUMMARY=5/5`, `POOL_SUMMARY=8/8`가 있습니다. 따라서 전체 시험 성공으로 보고하지 않습니다.

seed 및 고정점 해시(보존된 전체 시험 출력):

```text
36a806b0aa9639ce34b4c5b3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>/bin/cgc-bin-x86_64-seed-v11
7f4c9ed6025846737bc04feb6efc21c634e6a296a89e7d273b3bc7c3c4ed4dcb  <가림>/stage2.c
7f4c9ed6025846737bc04feb6efc21c634e6a296a89e7d273b3bc7c3c4ed4dcb  <가림>/stage3.c
7f4c9ed6025846737bc04feb6efc21c634e6a296a89e7d273b3bc7c3c4ed4dcb  <가림>/stage4.c
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

별도 유지 확인의 원문:

```text
POOL_SUMMARY=8/8
CGC_SYMBOL_SUMMARY=5/5
CGC_SYMBOL_RC=0
ABI_SUMMARY=8/8
TASK920_RC=0
```

## 2. 고친 곳

이번 9-51 변경 파일과 구현 위치:

- `runtime/process.c:24` — `base64_encode`; `runtime/process.c:58` — `base64_decode`; `runtime/process.c:1130` — `http_head`; `runtime/process.c:1133` — `http_delete`
- `runtime/http_server.c:491` — `server_redirect_cookie`
- `runtime/runtime.h:151,378-381` — 선언
- `tests/task950/base64-app.c:5-6`, `tests/task950/http-head-delete.c:45-46`, `tests/task950/redirect-cookie.c:5` — 계약 시험
- `scripts/rebuild-task951-app-source.sh:1` — 재생성 절차

테스트와 기대 출력은 구현보다 앞선 별도 커밋에 기록했습니다. 이 작업에 무관한 함수는 추가하지 않았습니다.

## 3. 원본·비교 원문

```text
FRONTEND_HEAD=9c1202dae761f1faff777c48887ed19f5960b3c9
10459 <가림>/_app.fl
67ce06645151efb7c23011494914b2019a95524f734a174f07d0767801b823ed  <가림>/_app.fl
BASE_GCC_RC=1
BASE_GCC_ERROR_LINES=205
CURRENT_INITIAL_GCC_RC=1
CURRENT_INITIAL_GCC_ERROR_LINES=115
APP_GCC_RC=1
APP_GCC_ERROR_LINES=106
```

위 `BASE_GCC_ERROR_LINES=205`는 `17bb1d1f` 기준의 이번 재생성/재측정 값입니다. 과거 보고서의 `267` 및 `212`와는 입력 해시를 연결할 기록이 없어 차이가 남습니다.

## 4. strace 및 실행 파일 감사

전체 회귀 시험은 요청대로 strace 없이 실행했습니다. 별도 네이티브 컴파일러 스모크만 strace로 실행해 금지 런타임 실행 여부를 확인했습니다. 이는 전체 회귀 시험을 strace로 추적한 결과가 아닙니다.

```text
TRACE_RUN_RC=0
EXECVE_LINES=25
NODE_EXEC=0
NPM_EXEC=0
NPX_EXEC=0
PYTHON_EXEC=0
JS_ARG=0
PY_ARG=0
```

변경 diff의 민감 정보 패턴 검사 및 whitespace 검사:

```text
SENSITIVE_DIFF_MATCHES=0
git diff --check=PASS
```

## 5. `X86_SUMMARY`

원본 복원/기준 측정, 외부 함수 시험 및 구현, seed 고정점 확인의 세 부분은 증거를 확보했습니다. 앱 GCC 통과 및 전체 시험 성공은 확인하지 못했습니다.

```text
X86_SUMMARY 3/5
```

## 6. v11 누적 필요 기능

이전 지시에서 기록한 언어/런타임 필요 기능 목록:

```text
regex_match
md5
try
template-string
소수 출력: 273.15 → 273.14999999999998
```

이번 `_app.fl` 외부 호출 누락 작업에서 완료된 항목은 9-50 목록의 앞선 구현 기록을 포함해 `http_head`, `http_delete`, `base64_encode`, `base64_decode`, `server_redirect_cookie`입니다. 아직 남긴 호출은 `style`, `random`이며, GCC 상위 오류의 뿌리 원인도 미해결입니다.

## 7. 커밋·원격 HEAD 및 미확인 항목

이번 변경 커밋은 테스트 선행 순서로 기록했습니다. 주요 커밋:

```text
03105665 test: preserve task 951 app source regeneration
1a3c3f6c fix: run app source builder from project root
3104c276 fix: reproduce task 951 app source timestamp
02c15efe test: define app http head and delete contracts
ff84c439 feat: add app http_head wrapper
25010a3a feat: add app http_delete wrapper
17a9e270 test: define app base64 conversion contract
f451e238 feat: add app base64 encoder
a36d5dd3 feat: add app base64 decoder
678add4e test: define redirect cookie extern contract
90cc7acf feat: add redirect cookie app alias
6b7c4bfe test: link redirect cookie runtime module
```

작업 전 Forgejo와 GitHub의 `v11-x86-seed-public` HEAD는 각각 다음과 같았습니다.

```text
c4d7736798cd0f4c6a80827ed51678c0b69a4f7e
c4d7736798cd0f4c6a80827ed51678c0b69a4f7e
```

푸시 후 양쪽 HEAD는 보고서 커밋으로 검증해 기록합니다. 미확인/미통과 항목: `style`, `random` 구현; `_app.fl` GCC 통과 및 `/ok` HTTP 200; 전체 회귀 스크립트의 0 종료; ARM/JS 레퍼런스 직접 비교; 9-48·9-49 당시 입력 파일 해시와 새 재현 입력의 동일성.
