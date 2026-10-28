# 9-49 `_app.fl` GCC 재검증

## 1. 단계별 결과

실행 위치: 메인

| 항목 | 결과 | 근거 |
|---|---|---|
| a. 오류율 4조건 × 3회 | 통과 | `MATRIX_COMPLETED=12/12`, `MATRIX_RUNNER_RC=0`. 무추적 두 조건은 6회 모두 `errors=0`; strace 두 조건은 6회 모두 오류 발생. 9-48 기준의 결론은 **strace 환경 영향**. |
| b. `_app.fl` 최다 GCC 오류 원인 수정 | 미완료 | 41건 `invalid initializer`. 근본 원인 후보는 C 번역기가 런타임에 없는 HTTP/API 호출을 C 함수 호출로 내보내는 것. 이 API 구현은 새 기능 함수 추가 금지와 충돌해 소스를 바꾸지 않음. |
| c. 오류 종류별 수정 전·후 비교 | 미완료 | 수정하지 않아 후속 GCC 실행 및 “수정 후” 표가 없음. 아래는 기존 원본 빌드의 수정 전 표. |
| d. seed·고정점·strace 전체 시험 | 통과 | seed 유지, stage2=stage3=stage4, `NATIVE_FIXED_POINT=PASS`, `STRACE_FULL_RC=0`. `CGC_SYMBOL_SUMMARY=5/5`, `ABI_SUMMARY=8/8`. |

첫 오류율 행렬 실행은 pool의 strace 범위가 단독 실행과 달랐습니다. 그 실행 기록은 보존했고 결론에서 제외했습니다. 아래는 단독 실행과 pool 모두 서버 및 클라이언트를 함께 strace한 교정된 12회 기록입니다.

## 2. 고친 곳 (파일:줄)

작업 코드 및 컴파일러는 수정하지 않았습니다. 사전 커밋된 집계·기록 스크립트만 추가했습니다.

- `tests/run-task949-pool-matrix.sh:1` — 네 조건을 각 세 번 실행하고 회차별 원문 로그를 보존.
- `tests/run-task949-full-check.sh:1` — seed/stage 해시, 고정점, 전체 회귀·CGC 심볼·task920 ABI 결과를 보존·집계.
- `self/cgc-main.fl:1003` — 확인한 동적 함수 호출 생성기. 수정하지 않음.
- `self/cgc-main.fl:1394` — 확인한 미등록 호출 fallback. 수정하지 않음.

## 3. 오류율 비교 원문

아래는 교정된 행렬 실행에서 나온 `LOAD_STAGE`의 원문입니다. 각 조건의 완료 행은 뒤에 `MATRIX condition=... rc=0`을 출력했습니다.

```text
LOAD_STAGE stage=94401 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.017 requests=2220201 rps=36992.83 p50_ms=24.984 p99_ms=87.117 max_ms=223.760 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2220201,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2220201
LOAD_STAGE stage=94401 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.016 requests=2209465 rps=36814.43 p50_ms=25.015 p99_ms=88.132 max_ms=354.614 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2209465,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2209465
LOAD_STAGE stage=94401 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.017 requests=2218518 rps=36964.80 p50_ms=24.376 p99_ms=88.311 max_ms=246.742 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2218518,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2218518
LOAD_STAGE stage=94401 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=61.848 requests=20696 rps=334.63 p50_ms=3017.194 p99_ms=4095.081 max_ms=5122.109 errors=8692 error_pct=41.998 connect_refused=0 connect_timeout=6 connect_other=0 io_errors=8686 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=8686 recv_other=0 incomplete_response=0 invalid_status=8686 route_counts=ok:20696,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=0:8692,200:12004
LOAD_STAGE stage=94401 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=62.421 requests=19759 rps=316.54 p50_ms=3071.705 p99_ms=4158.217 max_ms=5183.866 errors=14604 error_pct=73.911 connect_refused=0 connect_timeout=25 connect_other=0 io_errors=14579 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=14579 recv_other=0 incomplete_response=0 invalid_status=14579 route_counts=ok:19759,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=0:14604,200:5155
LOAD_STAGE stage=94401 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=61.913 requests=20509 rps=331.26 p50_ms=3031.680 p99_ms=4096.523 max_ms=5184.949 errors=10395 error_pct=50.685 connect_refused=0 connect_timeout=6 connect_other=0 io_errors=10389 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=10389 recv_other=0 incomplete_response=0 invalid_status=10389 route_counts=ok:20509,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=0:10395,200:10114
LOAD_STAGE stage=94901 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.018 requests=2219016 rps=36972.41 p50_ms=24.445 p99_ms=88.384 max_ms=222.612 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2219016,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2219016
LOAD_STAGE stage=94901 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.017 requests=2211435 rps=36846.90 p50_ms=25.055 p99_ms=88.001 max_ms=213.059 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2211435,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2211435
LOAD_STAGE stage=94901 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.018 requests=2222348 rps=37027.88 p50_ms=24.519 p99_ms=87.916 max_ms=265.960 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2222348,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2222348
LOAD_STAGE stage=94901 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=61.938 requests=19339 rps=312.23 p50_ms=3071.979 p99_ms=5119.206 max_ms=5182.100 errors=16131 error_pct=83.412 connect_refused=0 connect_timeout=156 connect_other=0 io_errors=15975 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=15975 recv_other=0 incomplete_response=0 invalid_status=15975 route_counts=ok:19339,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=0:16131,200:3208
LOAD_STAGE stage=94901 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=62.099 requests=19791 rps=318.70 p50_ms=3071.763 p99_ms=4097.084 max_ms=5122.042 errors=14482 error_pct=73.175 connect_refused=0 connect_timeout=26 connect_other=0 io_errors=14456 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=14456 recv_other=0 incomplete_response=0 invalid_status=14456 route_counts=ok:19791,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=0:14482,200:5309
LOAD_STAGE stage=94901 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=62.081 requests=19374 rps=312.07 p50_ms=3072.102 p99_ms=5055.627 max_ms=5182.717 errors=17487 error_pct=90.260 connect_refused=0 connect_timeout=76 connect_other=0 io_errors=17411 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=17411 recv_other=0 incomplete_response=0 invalid_status=17411 route_counts=ok:19374,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=0:17487,200:1887
MATRIX_COMPLETED=12/12
MATRIX_RUNNER_RC=0
```

각 행의 순서는 standalone-no-strace ×3, standalone-strace ×3, pool-no-strace ×3, pool-strace ×3입니다. 따라서 no-strace pool에서 오류가 없어 9-48 기준상 오류 요청 개별 추적은 해당하지 않습니다.

## 4. GCC 오류표 및 원인 조사

`_app.fl` 생성 C 파일의 원본 GCC 로그에서 위치 형식의 실제 진단은 `212`건입니다. 과거 느슨한 문자열 검색으로 기록된 `267`은 로그 안의 문맥 줄에도 `error:`가 들어간 경우를 포함한 수여서 실제 진단 수로 쓰지 않았습니다.

수정 전 종류별 개수 원문:

```text
41 error: invalid initializer
28 error: lvalue required as left operand of assignment
26 error: incompatible type for argument 3 of ‘fl_map_set’
25 error: incompatible type for argument 1 of ‘fl_fn_call’
9 error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
8 error: incompatible types when initializing type ‘long int’ using type ‘FLValue’
8 error: incompatible type for argument 1 of ‘fl_not’
5 error: incompatible type for argument 1 of ‘fl_truthy’
4 error: incompatible types when initializing type ‘enum <anonymous>’ using type ‘FLValue (*)(FLValue,  FLValue)’
4 error: incompatible type for argument 1 of ‘str_trim’
3 error: ‘_plus’ undeclared (first use in this function)
2 error: ‘str’ undeclared (first use in this function)
2 error: incompatible types when initializing type ‘enum <anonymous>’ using type ‘FLValue (*)(FLValue)’
2 error: incompatible types when initializing type ‘enum <anonymous>’ using type ‘FLValue (*)()’
1 error: ‘ui_spinner’ redeclared as different kind of symbol
1 error: ‘ui_form_group’ redeclared as different kind of symbol
1 error: ‘ui_empty’ redeclared as different kind of symbol
1 error: ‘ui_divider’ redeclared as different kind of symbol
1 error: ‘ui_card’ redeclared as different kind of symbol
1 error: ‘ui_btn’ redeclared as different kind of symbol
1 error: ‘ui_badge’ redeclared as different kind of symbol
1 error: ‘ui_avatar’ redeclared as different kind of symbol
1 error: ‘ui_alert’ redeclared as different kind of symbol
1 error: ‘note_card’ redeclared as different kind of symbol
1 error: ‘log_warn’ redeclared as different kind of symbol
1 error: ‘log_info’ redeclared as different kind of symbol
1 error: ‘log_error’ redeclared as different kind of symbol
1 error: ‘bg’ redeclared as different kind of symbol
1 error: ‘badge’ redeclared as different kind of symbol
1 error: type mismatch in conditional expression
1 error: incompatible type for argument 1 of ‘str_split’
1 error: incompatible type for argument 1 of ‘sort’
1 error: incompatible type for argument 1 of ‘fl_reduce_fn’
1 error: incompatible type for argument 1 of ‘fl_or’
1 error: incompatible type for argument 1 of ‘fl_map_fn’
1 error: implicit declaration of function ‘style’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘shell’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘shell_exec_stdout’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘server_redirect_cookie’; did you mean ‘server_req_cookie’? [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘scrypt_kdf’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘random’; did you mean ‘rand_log’? [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘random_bytes’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘measure_time’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘json_str’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘js_keys’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘http_put’; did you mean ‘http_get’? [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘http_post_json’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘http_post_form’; did you mean ‘fl_http_post_stream’? [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘http_ok_p’; did you mean ‘fl_http_ok_p’? [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘http_head’; did you mean ‘http_get’? [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘http_get_json’; did you mean ‘http_get’? [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘http_delete’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘hmac_sha256’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘format_date’; did you mean ‘form_data’? [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘db_one’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘base64_encode’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘base64_decode’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘aes_encrypt’ [-Wimplicit-function-declaration]
1 error: implicit declaration of function ‘aes_decrypt’ [-Wimplicit-function-declaration]
```

첫 `invalid initializer` 진단은 `http_post_json(...)` 호출 결과를 `FLValue` 변수에 넣는 위치였습니다. 그 직후 GCC는 `http_post_json` 선언이 없다고도 기록했습니다. 번역기는 `self/cgc-main.fl`의 `cgc-dispatch`/`cgc-dispatch-fallback`에서 미등록 호출을 C 호출 형태로 내보내고, 이 호출은 등록된 런타임 함수가 아닙니다. HTTP, crypto 등 빠진 함수 구현을 추가하면 금지된 새 기능 함수가 됩니다. 의미를 보존하는 기존 함수 대체도 확인되지 않아, 이 제한 아래서는 안전한 오류 감소 변경이 없었습니다. 재현 전용 시험 커밋과 수정 후 GCC 표는 만들지 않았습니다.

## 5. `X86_SUMMARY`

```text
X86_SUMMARY=2/4
```

통과한 네 항목 중 a, d가 통과했습니다. b, c는 GCC 오류를 줄이지 못해 미완료입니다.

전체 시험의 표준 출력 원문:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>/bin/cgc-bin-x86_64-seed-v11
7f4c9ed6025846737bc04feb6efc21c634e6a296a89e7d273b3bc7c3c4ed4dcb  <가림>
7f4c9ed6025846737bc04feb6efc21c634e6a296a89e7d273b3bc7c3c4ed4dcb  <가림>
7f4c9ed6025846737bc04feb6efc21c634e6a296a89e7d273b3bc7c3c4ed4dcb  <가림>
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
FULL_FAST_RC=0
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
TASK942_LEGACY_RC=0
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
POOL_SUMMARY=8/8
TASK942_POOL_RC=0
TASK946_FAST_SUMMARY=2/2
PASS slash names and punctuation separation
PASS C symbol collision rejected
PASS invalid generated C rejected
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
CGC_SYMBOL_RC=0
ABI_SUMMARY=8/8
TASK920_RC=0
STRACE_FULL_RC=0
```

단일 전체 실행의 `execve` trace 카운트:

```text
execve_lines=77036
successful_execve=12276
js_mentions=0
py_mentions=0
node_npm_npx_python_success=0
```

`execve` 성공 항목 중 node, npm, npx, Python은 각각 0회였고, 인자로 전달된 `.js`와 `.py` 파일도 각각 0회였습니다. 전체 시험은 공용 flock을 획득한 뒤 메인에서 수행했습니다.

## 6. 누적 기능 목록

v11에 필요한 기능 목록은 이전 기록에서 이어서 갱신하지 않았습니다. 이번 작업 범위의 GCC 원인 조사에서 확인한 누락 함수는 `http_post_json`, `http_get_json`, `http_post_form`, `http_put`, `http_delete`, `http_head`, `http_ok_p`, `aes_encrypt`, `aes_decrypt`, `base64_encode`, `base64_decode`, `hmac_sha256`, `scrypt_kdf`, `random_bytes`, `format_date`, `db_one`, `server_redirect_cookie`, `shell`, `shell_exec_stdout`, `measure_time`, `json_str`, `js_keys`, `style`, `random`입니다. 이 목록은 진단에서 관찰된 이름이며 구현했다는 뜻이 아닙니다.

## 7. 커밋·원격 HEAD·미확인 항목

작업 HEAD: `e1f8a92e18886a7200c8a9599c9bb944b61a06ef`

검증 종료 시 원격 조회 결과:

```text
forgejo: fabdd1ae1d69ed45f50a1d8865e849328a7e5e12
github:  fabdd1ae1d69ed45f50a1d8865e849328a7e5e12
```

보고서 커밋 전 기준 HEAD와 두 원격을 읽었습니다. 보고서 추가 후 Forgejo에 먼저, GitHub에 다음으로 같은 브랜치를 푸시하고 원격 HEAD를 재확인해야 합니다.

미확인/미완료: `_app.fl` GCC 최다 오류 수정, 수정 후 진단 개수표. 이번에는 `_app.fl` 재컴파일을 수정 후 다시 하지 않았습니다. 첫 행렬 실행은 scope 불일치로 폐기했으나 원문 기록은 보존했습니다.
