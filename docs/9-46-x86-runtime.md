# 지시서 9-46 — x86 런타임 진행 보고

실행 위치: `<가림>`

## 1. 단계별 결과

- task920 충돌 계약: `tests/run-cgc-symbol-contract.sh` 결과 원문 `NATIVE_FORMS_SUMMARY=18/18`, `CGC_SYMBOL_SUMMARY=5/5`. 사용자 C 심볼 충돌은 오류로 처리한다. 전체 `run-task920.sh`는 이후 ABI 검사에서 중단됐다.
- 요청 헬퍼: `REQUEST_HELPERS_SUMMARY=6/6`. 경로, query, param, cookie, files, redirect-cookie를 확인했다.
- 암호 함수: 구현하지 않았고 공식 벡터 통과를 주장하지 않는다.
- `_app.fl`: checkout 및 인접 작업 폴더에서 파일을 찾지 못했다. 따라서 GCC 진단 수, 링크, HTTP 응답은 확인 불가다.
- 전체 빠른 시험: legacy와 pool 단계를 모두 시도했으나 양쪽 반환 코드가 1이다. pool 부하 측정 이후 내부 부하 회귀에서 실패해 worker 재시작·제한 후속 항목까지는 도달하지 못했다.

## 2. 고친 곳

- `self/cgc-main.fl:851` — 사용자 C 심볼 충돌을 자동 suffix 변경하지 않고 `[CGC-ERR]`로 실패시킨다.
- `self/cgc-main.fl:755-767` — 요청 helper 다섯 개의 런타임 이름을 등록한다.
- `runtime/http_server.c:433` — 기본 redirect의 303 동작을 보존한다.
- `runtime/http_server.c:482-488` — `server_redirect_cookie` 응답만 302로 설정한다.
- `runtime/http_server.c:622-667`, `runtime/runtime.h:168-172` — path, query, param, files, cookie 접근자를 추가했다.
- `tests/task946/request-helpers.fl`, `.expected`, `tests/run-task946-helpers.sh` — 요청 헬퍼의 최소 fixture와 확인 스크립트.
- `tests/task946/crypto-vectors.fl`, `.expected` — 벡터 fixture를 기록했지만 현재 입력의 HMAC 키 표현은 API의 UTF-8 문자열 의미와 맞지 않아 유효한 RFC 검증으로 판정하지 않았다.
- `tests/run-task946-full.sh` — legacy 실패 후에도 pool 단계를 실행하도록 분리한 집계 실행기. 기대값과 원 시험 파일은 변경하지 않았다.

## 3. 막힘 목록·예제 원문

- 요청·응답 대상은 15개다. 구현·예제 통과는 6개: `server_req_path`, `server_req_query`, `server_req_param`, `server_req_cookie`, `server_req_files`, `server_redirect_cookie`. HTTP client helper 9개(`http_post_json`, `http_post_form`, `http_get_json`, `http_put`, `http_delete`, `http_head`, `http_body`, `http_status`, `http_ok_p`)는 미구현이다.
- 요청 최소 예제 출력 원문:

```text
PATH=/users
QUERY=needle
PARAM=42
COOKIE=abc
FILES=2
REDIRECT=302|/next|sid=1
REQUEST_HELPERS_SUMMARY=6/6
```

- 암호·인코딩 7개(`hmac_sha256`, `base64_encode`, `base64_decode`, `aes_encrypt`, `aes_decrypt`, `scrypt_kdf`, `random_bytes`) 중 구현·공식 벡터 통과는 0개다.
- task920 전체 회귀의 ABI 검사 원문:

```text
--- abi-unmapped-dispatch-ops
+++ abi-lowered-ops
-doseq
-h
-s
dispatch builtin inventory changed without an ABI mapping or lowering record
```

  같은 diff에서 `min`이 `abi-lowered-ops` 쪽에만 나타났다. 기준 ABI 파일은 변경하지 않았다.
- `_app.fl`는 입력 파일을 찾지 못해 GCC가 실행되지 않았다. 오류 수는 미확인이다.
- 미구현 runtime 필요 기능: 위 HTTP client helper 9개, 암호·인코딩 7개. `random`을 포함한 이전 작업 목록의 나머지 함수도 이 지시서에서 구현·검증하지 않았다.

## 4. 고정점·전체 시험 원문

시드 SHA256 원문:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2
```

stage2=3=4 SHA256 원문:

```text
bb145fd503583edaba6a0d5127c0fcbfee34f3f51d064bfd22fe2ccb3302a48d
bb145fd503583edaba6a0d5127c0fcbfee34f3f51d064bfd22fe2ccb3302a48d
bb145fd503583edaba6a0d5127c0fcbfee34f3f51d064bfd22fe2ccb3302a48d
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

전체 빠른 시험은 커밋된 `tests/run-task946-full.sh`를 `strace -f -e trace=execve` 아래 실행했다. 집계 원문:

```text
LOAD_FAST_SUITE_RC=1
OOM_SUMMARY=12/12
LOAD2_SUMMARY=10/10
TASK942_LEGACY_RC=1
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
TASK942_POOL_RC=1
TASK946_FAST_SUMMARY=0/2
EXECVE node=0 npm=0 npx=0 JS=0 Python=0
```

pool 단계의 부하 측정 원문에는 `workers=16 route=ok ... errors=16891 error_pct=90.052`가 포함된다. 기준을 바꾸지 않았다.

## 5. X86_SUMMARY

a. PARTIAL — 충돌 계약 시험 통과(`CGC_SYMBOL_SUMMARY=5/5`); 전체 task920은 ABI inventory 검사에서 실패했고 내부 이름 자동 변경의 별도 검증은 하지 못함.
b. PARTIAL — 요청 helper 6/15 예제 통과. 요청 목록의 총 대상 수는 15.
c. FAIL — 공식 암호 시험 벡터 통과 0/7.
d. UNVERIFIED — `_app.fl` 입력을 찾지 못해 GCC 오류 수·링크·HTTP 200 미측정.
e. PASS — 시드 유지, stage2=3=4.
f. FAIL — 전체 빠른 시험 종료 SUMMARY `TASK946_FAST_SUMMARY=0/2`; node·npm·npx·JS·Python 각각 0.

## 6. 아직 남은 v11 필요 기능 목록

- `http_post_json`, `http_post_form`, `http_get_json`, `http_put`, `http_delete`, `http_head`, `http_body`, `http_status`, `http_ok_p`.
- `hmac_sha256`, `base64_encode`, `base64_decode`, `aes_encrypt`, `aes_decrypt`, `scrypt_kdf`, `random_bytes`.
- task920 ABI dispatch 목록 불일치 원인 해결. 기준 ABI 기대 파일 수정은 하지 않았다.
- `_app.fl`을 제공된 read-only 입력 위치에서 재확인하고 GCC 오류 0, 링크, `/` HTTP 200까지 확인.
- task946 pool load2의 `LOAD2_SUMMARY=9/10`, `FDFIX_SUMMARY=4/5` 원인 미확인.

## 7. 커밋·원격 HEAD + 미확인 항목

이 작업에서 만든 커밋:

```text
d19b898e feat: add x86 request helper runtime functions
90f47ae3 test: record RFC crypto vector expectations
8c5b0f51 fix: preserve redirect status contracts
ee3cbeda test: ensure task 946 fast suite reaches pool phase
```

보고서 커밋: 후속 커밋으로 확인. push 순서: Forgejo 다음 GitHub. 두 원격 HEAD는 최종 채팅 보고에서 확인한다. 미확인: 암호 함수, HTTP client helper, `_app.fl` 빌드·HTTP, task920 ABI mismatch, pool load2/FDFIX 실패 원인.
