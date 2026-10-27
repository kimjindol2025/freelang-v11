# 9-45 x86 런타임 함수 및 전체 시험 멈춤

실행 위치: `freelang-v11` 로컬 시험 환경. 서버 23·25에는 접속하거나 실행하지 않았다.

## 1. 단계별 결과

- task931 멈춤 재현·원인: 저 파일 디스크립터 실행에서 `flock` 잠금 FD가 테스트 자식에 상속됐다. `ulimit -n 5`에서 FD 0–4를 점유해 소켓 `accept()`가 `EMFILE`로 반복됐고, curl 30개가 `000`, 서버 `wait`가 끝나지 않았다. `flock -o`로 FD 상속을 차단하면 동일 구간은 `RESPONSES=30/30 HTTP_503=30 SERVER_RC=0`으로 끝났다. 원인은 서버 기능이 아니라 테스트 실행기와 fd 제한의 결합이다.
- 재발 방지: task931 서버 종료 대기를 10초로 제한하고 초과 시 종료시킨다. task942 legacy/pool 단계에는 각각 1800초 제한을 둔다. 기대값은 변경하지 않았다.
- 9-45 런타임: 최소 예제 13/13 통과. 현재 범위는 자료구조/수학식과 고차 호출 일부다.
- 앱 입력: 동일 `_app.fl`에 대해 seed 컴파일러 직접 사용은 비교 불가(오래된 백엔드)로 GCC 오류 580개였다. 현재 stage2 컴파일러 재실행 결과는 `CODEGEN_RC=1 GCC_RC=1 ERROR_COUNT=156`; 첫 오류 원문은 `implicit declaration of function ‘aes_decrypt’`, 마지막 오류 원문은 `implicit declaration of function ‘style’`이다. 남은 미선언 함수는 `aes_decrypt`, `aes_encrypt`, `base64_decode`, `base64_encode`, `db_one`, `format_date`, `hmac_sha256`, `http_body`, `http_delete`, `http_get_json`, `http_head`, `http_ok_p`, `http_post_form`, `http_post_json`, `http_put`, `http_status`, `js_keys`, `json_str`, `measure_time`, `random`, `random_bytes`, `scrypt_kdf`, `server_redirect_cookie`, `server_req_cookie`, `server_req_files`, `server_req_param`, `server_req_path`, `server_req_query`, `shell`, `shell_exec_stdout`, `style`이다. 또한 `invalid initializer` 등 연쇄 GCC 오류가 남았다. 앱 실행 파일·HTTP 200은 확인하지 못했다.
- 소수 출력 273.15: 정책 결정 대기 중. 기대값/동작을 변경하지 않았다.

## 2. 고친 곳

- `tests/run-task931.sh`: `wait_server_bounded` 10초 제한, nofile 응답 검사 실패 시 명시적 nonzero 종료.
- `tests/run-task942-all.sh`: legacy/pool 각 1800초 제한.
- `self/cgc-main.fl`: `doseq`, `$callback` 호출, `swap!`의 `assoc`·`dissoc`·`conj`, `min` 함수값 매핑.
- `runtime/math.c`, `runtime/runtime.h`: `min` 함수값 wrapper.
- `tests/run-task945-runtime.sh`, `tests/task945/*`: 출력 기대를 구현보다 먼저 커밋한 최소 예제.

## 3. 막힘 목록·예제 원문

요청·응답: `server_req_path`, `server_req_query`, `server_req_param`, `server_req_cookie`, `server_req_files`, `server_redirect_cookie`, `http_*` 미구현 항목의 최소 예제는 아직 작성·실행하지 못했다.

암호·인코딩: `hmac_sha256`, `base64_encode`, `base64_decode`, `aes_encrypt`, `aes_decrypt`, `scrypt_kdf`, `random_bytes`, `random`의 최소 예제 및 공식 벡터 대조는 아직 수행하지 못했다.

자료 다루기: `assoc`, `dissoc`, `conj`, `doseq`, `min`, `mod`, `quot`, `js_keys`, `json_str`는 최소 예제에 포함되어 모두 통과했다. `db_one`, `format_date`, `measure_time` 예제는 아직 작성·실행하지 못했다.

나머지: `shell`, `shell_exec_stdout`, `style`, `_dollar_callback` 최소 예제는 아직 작성·실행하지 못했다. `$callback` 인자 호출은 `doseq-callback` 예제로 통과했다.

통과한 fixture 원문:

```text
TASK945_CASE=assoc PASS
TASK945_CASE=conj PASS
TASK945_CASE=dissoc PASS
TASK945_CASE=json_str PASS
TASK945_CASE=js_keys PASS
TASK945_CASE=min PASS
TASK945_CASE=mod PASS
TASK945_CASE=quot PASS
TASK945_CASE=swap-assoc PASS
TASK945_CASE=swap-conj PASS
TASK945_CASE=reduce-min PASS
TASK945_CASE=doseq PASS
TASK945_CASE=doseq-callback PASS
TASK945_RUNTIME_SUMMARY=13/13
```

## 4. 고정점·전체 시험 원문

seed SHA-256:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2
```

```text
5aee8f4bbaff240e997659ccb1803a0a2dc31364fd914aeba6feb602a1af0011  stage2
5aee8f4bbaff240e997659ccb1803a0a2dc31364fd914aeba6feb602a1af0011  stage3
5aee8f4bbaff240e997659ccb1803a0a2dc31364fd914aeba6feb602a1af0011  stage4
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

전체 빠른 시험은 `strace -f -e trace=execve` 아래 끝까지 실행기를 통과했으나 legacy 단계가 실패해 pool 단계까지 도달하지 않았다. 원문:

```text
FAST_TEST_RC=1
TASK942_LEGACY_BEGIN
LOAD_FAST_SUITE_RC=1
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
OOM_SUMMARY=12/12
LOAD2_SUMMARY=10/10
EXECVE_COUNTS node=0 npm=0 npx=0 JS=0 Python=0
```

`LOAD_FAST_SUITE_RC=1`의 중단 지점은 task920 C 심볼 계약 검사다. `run-cgc-symbol-contract.sh`는 `tests/cgc-symbol-collision.fl`을 거부하길 기대하지만 컴파일러가 `COLLISION_COMPILER_RC=0`으로 성공시켜 fixture가 실패했다. 기대값은 변경하지 않았다. 전체 실행의 완료 SUMMARY `TASK942_ALL=PASS`는 없다. 실행 위치는 `freelang-v11` 로컬 시험 환경이다.

## 5. X86_SUMMARY

a task931 멈춤 원인·제한시간 적용, 기대값 변경 0: PASS
b 묶음 가)~라) 최소 예제: 일부만 통과(자료 다루기 9/12; 나머지 미실행)
c 암호 공식 시험 벡터: 미실행
d `_app.fl` GCC 오류: 이전 191 → 현재 156; 링크/HTTP 200 미실행
e 시드·stage2=3=4: PASS
f 전체 빠른 시험 SUMMARY 및 node/npm/npx/JS/Python 실행 횟수: FAIL (`FAST_TEST_RC=1`, `TASK942_ALL=PASS` 없음; node/npm/npx/JS/Python 모두 0회)

## 6. 아직 남은 v11 필요 기능 목록

`server_req_path`, `server_req_query`, `server_req_param`, `server_req_cookie`, `server_req_files`, `server_redirect_cookie`, `http_*` 미매핑 호출, `hmac_sha256`, `base64_encode`, `base64_decode`, `aes_encrypt`, `aes_decrypt`, `scrypt_kdf`, `random_bytes`, `random`, `db_one`, `format_date`, `measure_time`, `shell`, `shell_exec_stdout`, `style`, `_dollar_callback`, 미완료 앱에서 드러나는 나머지 GCC 심볼·문법 오류, float 출력 정책 결정.

## 7. 커밋·두 원격 HEAD 및 미확인 항목

시작 커밋 `d43731da`와 seed `36a806b0`을 유지했다. 현재 작업 커밋은 `4fdc307d`이며, Forgejo/GitHub 푸시는 전체 시험·민감정보 검사와 보고서 확정 뒤 수행한다.

미확인: task942 pool 단계, 암호 함수 구현/벡터, 미실행 최소 예제, 앱 링크 및 HTTP 200, 소수 출력 정책. 두 원격 HEAD는 아직 확인되지 않았다.
