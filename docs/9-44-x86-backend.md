# 지시서 9-44 — x86 백엔드 막힘 조사

실행 위치: `freelang-v11` 작업본, 가지 `v11-x86-seed-public`. 시작 HEAD는 `56f28ecb`, 보충 지시 시작 HEAD는 `c65d409a`다. 프런트엔드가 생성한 `_app.fl`은 읽기 전용으로 썼다. 모든 상위 경로는 `<가림>`으로 표기했다. 23·25 서버에는 접속하거나 실행하지 않았다. 무거운 컴파일·최소 예제 묶음은 `flock /tmp/fl-heavy.lock`을 획득해 실행했다.

## 1. 단계별 결과

### 0 — 9-43 보고서와 16-worker 재측정

`docs/9-43-pool-perf.md`의 끝 판정을 최종 전수 실행 원문과 맞췄다. 현재 문서에는 `TASK942_ALL=PASS`, `POOL_SUMMARY=8/8`, `POOL_RESOURCE_STABLE=1`인 최종 검증과 일치하게 “최종 전수 실행에서는 … 통과했다”고 기록되어 있다. 따라서 앞의 최종 PASS와 끝 문단이 모순되지 않는다.

worker=16, `/ok`, 연결 1000개, 60초를 재측정하고 같은 구간에 부하 클라이언트 PID의 `pidstat`을 붙였다. 실행 위치는 `freelang-v11` 로컬 시험 환경이다.

```text
TASK944_EXECUTION_LOCATION=freelang-v11
LOAD_STAGE stage=94401 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.015 requests=2241009 rps=37341.01 p50_ms=25.879 p99_ms=84.682 max_ms=190.506 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2241009,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2241009
Average: %usr=37.97 %system=6306.18 %CPU=6344.15 Command=load-client
```

이번 재측정은 오류 0건이며 56.338% 오류는 재현되지 않았다. 부하 도구가 평균 CPU 6344.15%를 사용한 사실은 기록했지만, 과거 실패 구간 원자료가 없어 원인은 **미확인**이다. 부하 도구 또는 서버 어느 쪽이라고도 단정하지 않았다. 판정 기준·기대값은 바꾸지 않았다.

### 1 — 실제 `_app.fl` 컴파일

실제 입력 `<가림>/_app.fl`을 stage2 native compiler로 다시 빌드했다. 최신 코드의 마지막 실행 결과:

```text
APP_COMPILE_RC=1
APP_C_BYTES=1668835
APP_ERRORS=191
[CGC-ERR] generated C failed gcc -fsyntax-only: <가림>/app.c
```

멈춘 단계는 C 출력 뒤의 GCC 구문 검사다. stage2 프로세스 종료 코드는 1이고 C 출력 파일은 만들어졌지만 문법·심볼 검사가 실패했다. 컴파일러가 처리한 마지막 소스 식은 `<가림>/_app.fl:10460`의 `(server-start 40850)`이다. 마지막 stderr 진단 원문(경로만 가림):

```text
<가림>/app.c:10463:5: error: implicit declaration of function ‘style’ [-Wimplicit-function-declaration]
```

첫 남은 오류는 익명 함수 본문에서 `k`, `v`가 미선언된 것이고, 그 뒤에 누락 런타임 함수와 C 타입 오류가 이어진다. 전체 GCC 오류 191줄은 아래 3항에 원문(경로 가림)으로 붙였다. `_app.fl` 실행 파일 링크와 `/` HTTP 200 확인은 도달하지 못했다.

### 2 — 선커밋 최소 예제와 수정 순서

각 신규 최소 예제와 기대 출력은 시험 전에 커밋했다. 다음 순서로 진행했다.

- try/catch: 최소 예제 통과. 실제 앱에서도 이 항목의 실패 원문은 발견하지 못했다.
- 템플릿 문자열: 최소 예제 통과. 전역 변수 바인딩을 템플릿 환경에 포함했다.
- GCC 문법·심볼: 삼중 따옴표 문자열, 이름 충돌, 중복 함수, 전역/함수 이름 겹침, `$` 함수명, `fl-env-get`, 함수 식 `swap!`, 클로저의 함수 호출 캡처, `type`, `str-count`, `h` 기본/추가 인자, `s` 스타일 조각, ISO 날짜, secure random, regex 치환, 구조분해 lambda 인자를 개별 예제로 다뤘다. 통과한 기능은 각각 수정 후 고정점을 재확인했다.
- 소수 출력: 기대값을 바꾸지 않았다. 현재 출력은 기존 기대값과 계속 다르므로 미해결로 남겼다.

최종 최소 예제 실행은 23개 중 22개가 통과했다. 실패한 하나는 float JSON 출력이다. 원문은 아래 3항에 있다.

### 3 — 전체 빠른 시험 1회

전체 빠른 시험은 `strace -f -e trace=execve` 아래 한 번 실행했다. 기존 실행기의 `examples/erp-vendors` 읽기는 허용된다는 보충 해석을 적용했다. 시험은 `tests/run-task931.sh`의 `oom-nofile` 구간에서 멈췄다. 30개 curl 응답이 모두 `000`이었고 서버 프로세스는 살아 있었으며, 실행기는 `wait "$SERVER_PID"`에서 끝나지 않았다. 수동 중단했다.

남은 SUMMARY가 출력되지 않아 실행기 시작 원문은 `TASK942_LEGACY_BEGIN`뿐이다. 완료 SUMMARY 원문 및 execve 집계는 확보되지 않았다. node·npm·npx·JS·Python 각 0건은 **확인되지 않음**이며 PASS로 보고하지 않는다. 실행 위치는 `freelang-v11` 로컬 시험 환경이다. 사용자 지시의 1회 제한에 따라 전체 빠른 시험을 다시 실행하지 않았다.

## 2. 고친 곳

- `docs/9-43-pool-perf.md:190`: 최종 전수 PASS 원문과 끝 판정을 일치시킴.
- `tests/run-task944-worker16-ok.sh:1-53`: 16-worker `/ok`와 같은 시간대 `pidstat` 측정.
- `tests/run-task944-backend.sh:1-55`, `tests/task944/*`: 선커밋된 최소 `.fl`·기대 출력과 compile/GCC/run 비교기.
- `self/cgc-main.fl:128-142`: multiline triple-quoted string lexer.
- `self/cgc-main.fl:218,693-858,972-978,1317-1329`: C 심볼 충돌, `$` 함수명 보존, 함수 식을 받는 `swap!` 호출 및 런타임 심볼 매핑.
- `self/cgc-main.fl:1348-1367`: 호출자 함수 이름을 클로저 캡처 분석에 포함하고 destructured lambda 인자를 `argv`에서 선언.
- `self/cgc-main.fl:1020-1030,1112`: `h` 누락/추가 인자와 `s`, `type`, `str-count` 백엔드 호출.
- `runtime/http_server.c:450-487,651-702,1137-1154`, `runtime/runtime.h:146-147`: 응답 헤더·리다이렉트 쿠키 API.
- `runtime/math.c:48-127`, `runtime/runtime.h:250-252`: regex 치환, 부분문자열 개수, 스타일 조각 결합, ISO 날짜 파싱.
- `runtime/auth.c:48-62`, `runtime/runtime.h:149`: secure bounded integer random.

## 3. 막힘 목록·최소 예제 원문

### try/catch

```text
예제: tests/task944/try.fl
(try
  (throw "example error")
  (catch [err]
    (println "TRY_CAUGHT")))
기대/실제: TRY_CAUGHT
COMPILE_RC=0 GCC_RC=0 OUTPUT=PASS
```

### 템플릿 문자열

```text
예제: tests/task944/template.fl
(define name "Ada")
(println "Hello ${name}")
기대/실제: Hello Ada
COMPILE_RC=0 GCC_RC=0 OUTPUT=PASS
```

### GCC 심볼·문법 실패와 수정 검증 예제

각 예제는 실행 전에 `.fl`과 `.expected`를 커밋했다. 대표 원문:

```text
예제: tests/task944/swap-fn.fl
(define idx (atom 0))
(swap! idx (fn [n] (+ n 1)))
(println (deref idx))
기대: 1
수정 전 GCC: error: implicit declaration of function ‘null’
수정 후: COMPILE_RC=0 GCC_RC=0 OUTPUT=PASS
```

```text
예제: tests/task944/closure-call.fl
(defn apply-one [f x]
  (map (fn [item] (f item)) [x]))
(println (get (apply-one (fn [n] (+ n 1)) 4) 0))
기대: 5
수정 전 GCC: error: ‘f’ undeclared
수정 후: COMPILE_RC=0 GCC_RC=0 OUTPUT=PASS
```

```text
예제: tests/task944/dollar-lambda-param.fl
(println (get (map (fn [$value] $value) [7]) 0))
기대: 7
수정 전 GCC: error: ‘value’ undeclared
수정 후: COMPILE_RC=0 GCC_RC=0 OUTPUT=PASS
```

```text
예제: tests/task944/destructured-lambda.fl
(println (get (map (fn [[$key $value]] (str $key ":" $value)) [["a" 1]]) 0))
기대: a:1
수정 전 GCC: error: ‘key’ undeclared; error: ‘value’ undeclared
수정 후: COMPILE_RC=0 GCC_RC=0 OUTPUT=PASS
```

```text
예제: tests/task944/str-count.fl
(println (str-count "banana" "an"))
(println (str-count "banana" "z"))
기대: 2 / 0
수정 후: COMPILE_RC=0 GCC_RC=0 OUTPUT=PASS
```

```text
예제: tests/task944/h-varargs.fl
(defn h [tag attrs content] (str tag attrs content))
(println (h "<div>" "a" "b" "c"))
기대: <div>abc
수정 전 GCC: error: too many arguments to function ‘h’
수정 후: COMPILE_RC=0 GCC_RC=0 OUTPUT=PASS
```

```text
예제: tests/task944/parse-date.fl
(println (parse-date "1970-01-01T00:00:01.500Z"))
기대: 1500
수정 전 GCC: error: implicit declaration of function ‘parse_date’
수정 후: COMPILE_RC=0 GCC_RC=0 OUTPUT=PASS
```

```text
예제: tests/task944/random-int.fl
(define fixed (random_int 4 4))
(define bounded (random_int -3 7))
(println fixed)
(println (and (>= bounded -3) (<= bounded 7)))
기대: 4 / true
수정 후: COMPILE_RC=0 GCC_RC=0 OUTPUT=PASS
```

```text
예제: tests/task944/str-replace-regex.fl
(println (str_replace_in "a+b+c" "+" " "))
(println (str_replace_in "hi<br>x" "<[^>]+>" ""))
기대: a b c / hix
수정 후: COMPILE_RC=0 GCC_RC=0 OUTPUT=PASS
```

### 남은 실제 앱 GCC 진단

`APP_ERRORS=191`. 전체 진단 원문(로컬 경로는 `<가림>`으로 바꿈):

```text
<가림>/_app.c:2989:401: error: implicit declaration of function ‘aes_decrypt’ [-Wimplicit-function-declaration]
<가림>/_app.c:2989:401: error: incompatible type for argument 1 of ‘fl_or’
<가림>/_app.c:6457:20: error: implicit declaration of function ‘server_req_path’; did you mean ‘server_req_json’? [-Wimplicit-function-declaration]
<가림>/_app.c:6457:20: error: invalid initializer
<가림>/_app.c:6494:12: error: implicit declaration of function ‘server_req_cookie’; did you mean ‘server_req_json’? [-Wimplicit-function-declaration]
<가림>/_app.c:6494:12: error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
<가림>/_app.c:6551:570: error: ‘str’ undeclared (first use in this function)
<가림>/_app.c:6567:870: error: ‘str’ undeclared (first use in this function)
<가림>/_app.c:6574:19: error: implicit declaration of function ‘http_post_json’ [-Wimplicit-function-declaration]
<가림>/_app.c:6574:19: error: invalid initializer
<가림>/_app.c:6575:63: error: implicit declaration of function ‘http_ok_p’ [-Wimplicit-function-declaration]
<가림>/_app.c:6575:79: error: incompatible types when initializing type ‘long int’ using type ‘FLValue’
<가림>/_app.c:6575:101: error: implicit declaration of function ‘http_status’; did you mean ‘git_status’? [-Wimplicit-function-declaration]
<가림>/_app.c:6582:19: error: invalid initializer
<가림>/_app.c:6589:54: error: implicit declaration of function ‘base64_encode’ [-Wimplicit-function-declaration]
<가림>/_app.c:6592:19: error: implicit declaration of function ‘http_post_form’; did you mean ‘fl_http_post_stream’? [-Wimplicit-function-declaration]
<가림>/_app.c:6592:19: error: invalid initializer
<가림>/_app.c:6593:79: error: incompatible types when initializing type ‘long int’ using type ‘FLValue’
<가림>/_app.c:6634:25: error: invalid initializer
<가림>/_app.c:6635:23: error: incompatible type for argument 1 of ‘fl_not’
<가림>/_app.c:6636:25: error: implicit declaration of function ‘http_body’ [-Wimplicit-function-declaration]
<가림>/_app.c:6636:25: error: incompatible type for argument 1 of ‘get’
<가림>/_app.c:6637:24: error: implicit declaration of function ‘http_get_json’; did you mean ‘http_get’? [-Wimplicit-function-declaration]
<가림>/_app.c:6637:24: error: invalid initializer
<가림>/_app.c:6638:23: error: incompatible type for argument 1 of ‘fl_not’
<가림>/_app.c:6639:20: error: invalid initializer
<가림>/_app.c:6652:25: error: invalid initializer
<가림>/_app.c:6653:23: error: incompatible type for argument 1 of ‘fl_not’
<가림>/_app.c:6655:24: error: invalid initializer
<가림>/_app.c:6656:23: error: incompatible type for argument 1 of ‘fl_not’
<가림>/_app.c:6657:20: error: invalid initializer
<가림>/_app.c:6672:25: error: invalid initializer
<가림>/_app.c:6673:23: error: incompatible type for argument 1 of ‘fl_not’
<가림>/_app.c:6674:25: error: incompatible type for argument 1 of ‘get’
<가림>/_app.c:6675:24: error: invalid initializer
<가림>/_app.c:6676:23: error: incompatible type for argument 1 of ‘fl_not’
<가림>/_app.c:6677:20: error: invalid initializer
<가림>/_app.c:6690:25: error: invalid initializer
<가림>/_app.c:6691:23: error: incompatible type for argument 1 of ‘fl_not’
<가림>/_app.c:6692:25: error: incompatible type for argument 1 of ‘get’
<가림>/_app.c:6693:24: error: invalid initializer
<가림>/_app.c:6694:23: error: incompatible type for argument 1 of ‘fl_not’
<가림>/_app.c:6695:24: error: incompatible type for argument 1 of ‘get’
<가림>/_app.c:6721:19: error: invalid initializer
<가림>/_app.c:6722:16: error: incompatible type for argument 1 of ‘fl_truthy’
<가림>/_app.c:6722:143: error: incompatible types when initializing type ‘long int’ using type ‘FLValue’
<가림>/_app.c:6722:169: error: incompatible type for argument 1 of ‘get’
<가림>/_app.c:6722:344: error: incompatible type for argument 1 of ‘get’
<가림>/_app.c:6722:408: error: incompatible type for argument 1 of ‘get’
<가림>/_app.c:6728:19: error: invalid initializer
<가림>/_app.c:6729:16: error: incompatible type for argument 1 of ‘fl_truthy’
<가림>/_app.c:6735:19: error: invalid initializer
<가림>/_app.c:6736:79: error: incompatible types when initializing type ‘long int’ using type ‘FLValue’
<가림>/_app.c:6742:19: error: invalid initializer
<가림>/_app.c:6743:79: error: incompatible types when initializing type ‘long int’ using type ‘FLValue’
<가림>/_app.c:6749:19: error: invalid initializer
<가림>/_app.c:6750:16: error: incompatible type for argument 1 of ‘fl_truthy’
<가림>/_app.c:6750:282: error: incompatible type for argument 1 of ‘get’
<가림>/_app.c:6760:19: error: invalid initializer
<가림>/_app.c:6761:16: error: incompatible type for argument 1 of ‘fl_truthy’
<가림>/_app.c:6761:42: error: incompatible type for argument 1 of ‘get’
<가림>/_app.c:6769:19: error: invalid initializer
<가림>/_app.c:6770:16: error: incompatible type for argument 1 of ‘fl_truthy’
<가림>/_app.c:6771:27: error: incompatible type for argument 1 of ‘get’
<가림>/_app.c:6785:22: error: implicit declaration of function ‘hmac_sha256’ [-Wimplicit-function-declaration]
<가림>/_app.c:6785:22: error: invalid initializer
<가림>/_app.c:6786:24: error: invalid initializer
<가림>/_app.c:6787:25: error: invalid initializer
<가림>/_app.c:6788:25: error: invalid initializer
<가림>/_app.c:6784:29: error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
<가림>/_app.c:6797:19: error: implicit declaration of function ‘http_put’; did you mean ‘http_get’? [-Wimplicit-function-declaration]
<가림>/_app.c:6797:19: error: invalid initializer
<가림>/_app.c:6804:23: error: implicit declaration of function ‘base64_decode’ [-Wimplicit-function-declaration]
<가림>/_app.c:6804:23: error: invalid initializer
<가림>/_app.c:6806:19: error: invalid initializer
<가림>/_app.c:6817:19: error: implicit declaration of function ‘format_date’; did you mean ‘form_data’? [-Wimplicit-function-declaration]
<가림>/_app.c:6817:19: error: invalid initializer
<가림>/_app.c:6831:19: error: implicit declaration of function ‘http_delete’ [-Wimplicit-function-declaration]
<가림>/_app.c:6831:19: error: invalid initializer
<가림>/_app.c:6839:19: error: implicit declaration of function ‘http_head’; did you mean ‘http_get’? [-Wimplicit-function-declaration]
<가림>/_app.c:6839:19: error: invalid initializer
<가림>/_app.c:6847:20: error: invalid initializer
<가림>/_app.c:7245:48: error: implicit declaration of function ‘conj’ [-Wimplicit-function-declaration]
<가림>/_app.c:7245:53: error: incompatible type for argument 1 of ‘conj’
<가림>/_app.c:7245:48: error: too many arguments to function ‘conj’
<가림>/_app.c:7251:5: error: implicit declaration of function ‘doseq’ [-Wimplicit-function-declaration]
 7251 |     doseq((__extension__ ({ FLValue __fl_arr[2] = {callback, watchers}; fl_vec_from(__fl_arr, 2); })), (__extension__ ({ FLValue __fl_try_r_34; if (fl_try_top >= 64) { fl_throw(fl_str_val("try nest overflow")); } if (setjmp(fl_try_stack[fl_try_top].buf) == 0) { fl_try_top++; __fl_try_r_34 = _dollar_callback(record); fl_try_top--; } else { fl_try_top--; FLValue e = fl_try_stack[fl_try_top].err; __fl_try_r_34 = log_warn(fl_str_n(2, fl_str_val("Watcher error: "), e)); } __fl_try_r_34; })));
<가림>/_app.c:7251:52: error: ‘callback’ undeclared (first use in this function)
 7251 |     doseq((__extension__ ({ FLValue __fl_arr[2] = {callback, watchers}; fl_vec_from(__fl_arr, 2); })), (__extension__ ({ FLValue __fl_try_r_34; if (fl_try_top >= 64) { fl_throw(fl_str_val("try nest overflow")); } if (setjmp(fl_try_stack[fl_try_top].buf) == 0) { fl_try_top++; __fl_try_r_34 = _dollar_callback(record); fl_try_top--; } else { fl_try_top--; FLValue e = fl_try_stack[fl_try_top].err; __fl_try_r_34 = log_warn(fl_str_n(2, fl_str_val("Watcher error: "), e)); } __fl_try_r_34; })));
<가림>/_app.c:7251:293: error: implicit declaration of function ‘_dollar_callback’; did you mean ‘_dollar_topbar’? [-Wimplicit-function-declaration]
 7251 |     doseq((__extension__ ({ FLValue __fl_arr[2] = {callback, watchers}; fl_vec_from(__fl_arr, 2); })), (__extension__ ({ FLValue __fl_try_r_34; if (fl_try_top >= 64) { fl_throw(fl_str_val("try nest overflow")); } if (setjmp(fl_try_stack[fl_try_top].buf) == 0) { fl_try_top++; __fl_try_r_34 = _dollar_callback(record); fl_try_top--; } else { fl_try_top--; FLValue e = fl_try_stack[fl_try_top].err; __fl_try_r_34 = log_warn(fl_str_n(2, fl_str_val("Watcher error: "), e)); } __fl_try_r_34; })));
<가림>/_app.c:7251:293: error: incompatible types when assigning to type ‘FLValue’ from type ‘int’
<가림>/_app.c:7249:29: error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
 7251 |     doseq((__extension__ ({ FLValue __fl_arr[2] = {callback, watchers}; fl_vec_from(__fl_arr, 2); })), (__extension__ ({ FLValue __fl_try_r_34; if (fl_try_top >= 64) { fl_throw(fl_str_val("try nest overflow")); } if (setjmp(fl_try_stack[fl_try_top].buf) == 0) { fl_try_top++; __fl_try_r_34 = _dollar_callback(record); fl_try_top--; } else { fl_try_top--; FLValue e = fl_try_stack[fl_try_top].err; __fl_try_r_34 = log_warn(fl_str_n(2, fl_str_val("Watcher error: "), e)); } __fl_try_r_34; })));
<가림>/_app.c:7274:289: error: ‘_plus’ undeclared (first use in this function)
<가림>/_app.c:7291:197: error: ‘min’ undeclared (first use in this function)
<가림>/_app.c:7291:318: error: incompatible type for argument 1 of ‘fl_reduce_fn’
<가림>/_app.c:7291:446: error: ‘_plus’ undeclared (first use in this function)
<가림>/_app.c:7375:92: error: implicit declaration of function ‘random’; did you mean ‘rand_log’? [-Wimplicit-function-declaration]
<가림>/_app.c:7380:52: error: ‘callback’ undeclared (first use in this function)
 7380 |     doseq((__extension__ ({ FLValue __fl_arr[2] = {callback, watchers}; fl_vec_from(__fl_arr, 2); })), (__extension__ ({ FLValue __fl_try_r_57; if (fl_try_top >= 64) { fl_throw(fl_str_val("try nest overflow")); } if (setjmp(fl_try_stack[fl_try_top].buf) == 0) { fl_try_top++; __fl_try_r_57 = _dollar_callback(alert); fl_try_top--; } else { fl_try_top--; FLValue e = fl_try_stack[fl_try_top].err; __fl_try_r_57 = log_warn(fl_str_n(2, fl_str_val("Alert watcher error: "), e)); } __fl_try_r_57; })));
<가림>/_app.c:7380:293: error: incompatible types when assigning to type ‘FLValue’ from type ‘int’
 7380 |     doseq((__extension__ ({ FLValue __fl_arr[2] = {callback, watchers}; fl_vec_from(__fl_arr, 2); })), (__extension__ ({ FLValue __fl_try_r_57; if (fl_try_top >= 64) { fl_throw(fl_str_val("try nest overflow")); } if (setjmp(fl_try_stack[fl_try_top].buf) == 0) { fl_try_top++; __fl_try_r_57 = _dollar_callback(alert); fl_try_top--; } else { fl_try_top--; FLValue e = fl_try_stack[fl_try_top].err; __fl_try_r_57 = log_warn(fl_str_n(2, fl_str_val("Alert watcher error: "), e)); } __fl_try_r_57; })));
<가림>/_app.c:7382:6: error: type mismatch in conditional expression
<가림>/_app.c:7387:47: error: incompatible type for argument 1 of ‘conj’
<가림>/_app.c:7387:42: error: too many arguments to function ‘conj’
<가림>/_app.c:7402:35: error: implicit declaration of function ‘assoc’ [-Wimplicit-function-declaration]
<가림>/_app.c:7402:35: error: incompatible type for argument 2 of ‘fl_atom_reset’
<가림>/_app.c:7445:33: error: incompatible type for argument 2 of ‘fl_atom_reset’
<가림>/_app.c:7461:249: error: ‘_plus’ undeclared (first use in this function)
<가림>/_app.c:7562:125: error: implicit declaration of function ‘min’ [-Wimplicit-function-declaration]
<가림>/_app.c:7562:144: error: incompatible types when initializing type ‘long int’ using type ‘FLValue’
<가림>/_app.c:7632:12: error: implicit declaration of function ‘measure_time’ [-Wimplicit-function-declaration]
<가림>/_app.c:7632:12: error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
<가림>/_app.c:7701:17: error: implicit declaration of function ‘mod’ [-Wimplicit-function-declaration]
<가림>/_app.c:7701:17: error: invalid initializer
<가림>/_app.c:7702:34: error: incompatible type for argument 2 of ‘get’
<가림>/_app.c:7704:33: error: implicit declaration of function ‘quot’ [-Wimplicit-function-declaration]
<가림>/_app.c:7704:29: error: incompatible type for argument 2 of ‘get’
<가림>/_app.c:7705:115: error: incompatible types when initializing type ‘long int’ using type ‘FLValue’
<가림>/_app.c:7840:19: error: implicit declaration of function ‘shell_exec_stdout’ [-Wimplicit-function-declaration]
<가림>/_app.c:7840:19: error: invalid initializer
<가림>/_app.c:7958:20: error: implicit declaration of function ‘server_req_query’; did you mean ‘server_req_json’? [-Wimplicit-function-declaration]
<가림>/_app.c:7958:20: error: invalid initializer
<가림>/_app.c:7977:19: error: invalid initializer
<가림>/_app.c:8055:17: error: invalid initializer
<가림>/_app.c:8056:23: error: invalid initializer
<가림>/_app.c:8218:17: error: invalid initializer
<가림>/_app.c:8420:19: error: invalid initializer
<가림>/_app.c:8450:17: error: invalid initializer
<가림>/_app.c:8526:12: error: implicit declaration of function ‘db_one’ [-Wimplicit-function-declaration]
<가림>/_app.c:8526:12: error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
<가림>/_app.c:8543:28: error: implicit declaration of function ‘shell’ [-Wimplicit-function-declaration]
<가림>/_app.c:8543:28: error: incompatible type for argument 1 of ‘str_trim’
<가림>/_app.c:8665:12: error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
<가림>/_app.c:8675:90: error: type mismatch in conditional expression
<가림>/_app.c:8681:28: error: incompatible type for argument 1 of ‘fl_or’
<가림>/_app.c:8694:24: error: implicit declaration of function ‘server_req_files’; did you mean ‘server_req_json’? [-Wimplicit-function-declaration]
<가림>/_app.c:8694:24: error: invalid initializer
<가림>/_app.c:8746:12: error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
<가림>/_app.c:8774:12: error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
<가림>/_app.c:8789:32: error: incompatible type for argument 1 of ‘str_trim’
<가림>/_app.c:8829:23: error: invalid initializer
<가림>/_app.c:8878:12: error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
<가림>/_app.c:8974:30: error: incompatible type for argument 1 of ‘str_trim’
<가림>/_app.c:8989:26: error: incompatible type for argument 1 of ‘fl_or’
<가림>/_app.c:9011:21: error: incompatible type for argument 1 of ‘str_trim’
<가림>/_app.c:9035:26: error: incompatible type for argument 1 of ‘fl_or’
<가림>/_app.c:9067:19: error: invalid initializer
<가림>/_app.c:9093:5: error: implicit declaration of function ‘server_redirect_cookie’; did you mean ‘fl_resp_redirect_cookie’? [-Wimplicit-function-declaration]
<가림>/_app.c:9091:29: error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
<가림>/_app.c:9155:21: error: invalid initializer
<가림>/_app.c:9226:12: error: incompatible types when returning type ‘int’ but ‘FLValue’ was expected
<가림>/_app.c:9683:19: error: invalid initializer
<가림>/_app.c:9684:19: error: invalid initializer
<가림>/_app.c:9691:21: error: invalid initializer
<가림>/_app.c:9730:20: error: implicit declaration of function ‘random_bytes’ [-Wimplicit-function-declaration]
<가림>/_app.c:9730:20: error: invalid initializer
<가림>/_app.c:9731:19: error: invalid initializer
<가림>/_app.c:9732:19: error: implicit declaration of function ‘scrypt_kdf’ [-Wimplicit-function-declaration]
<가림>/_app.c:9732:19: error: invalid initializer
<가림>/_app.c:9733:23: error: implicit declaration of function ‘aes_encrypt’ [-Wimplicit-function-declaration]
<가림>/_app.c:9733:23: error: invalid initializer
<가림>/_app.c:9742:35: error: incompatible type for argument 2 of ‘fl_atom_reset’
<가림>/_app.c:9750:185: error: implicit declaration of function ‘dissoc’ [-Wimplicit-function-declaration]
<가림>/_app.c:9750:185: error: incompatible type for argument 2 of ‘fl_atom_reset’
<가림>/_app.c:9757:76: error: incompatible type for argument 2 of ‘fl_atom_reset’
<가림>/_app.c:9762:60: error: incompatible type for argument 2 of ‘fl_atom_reset’
<가림>/_app.c:9769:19: error: invalid initializer
<가림>/_app.c:9770:19: error: invalid initializer
<가림>/_app.c:9781:23: error: invalid initializer
<가림>/_app.c:9782:21: error: invalid initializer
<가림>/_app.c:9784:24: error: invalid initializer
<가림>/_app.c:9785:23: error: invalid initializer
<가림>/_app.c:9786:27: error: invalid initializer
<가림>/_app.c:9805:290: error: incompatible types when initializing type ‘long int’ using type ‘FLValue’
<가림>/_app.c:9825:27: error: incompatible type for argument 1 of ‘fl_or’
<가림>/_app.c:9892:25: error: implicit declaration of function ‘js_keys’ [-Wimplicit-function-declaration]
<가림>/_app.c:9892:25: error: incompatible type for argument 1 of ‘sort’
<가림>/_app.c:9903:18: error: implicit declaration of function ‘server_req_param’; did you mean ‘server_req_json’? [-Wimplicit-function-declaration]
<가림>/_app.c:9903:18: error: invalid initializer
<가림>/_app.c:9920:18: error: invalid initializer
<가림>/_app.c:9937:18: error: invalid initializer
<가림>/_app.c:9946:18: error: invalid initializer
<가림>/_app.c:9962:18: error: invalid initializer
<가림>/_app.c:9972:18: error: invalid initializer
<가림>/_app.c:10000:18: error: invalid initializer
<가림>/_app.c:10011:18: error: invalid initializer
<가림>/_app.c:10139:37: error: implicit declaration of function ‘json_str’ [-Wimplicit-function-declaration]
<가림>/_app.c:10139:37: error: incompatible type for argument 1 of ‘str_split’
<가림>/_app.c:10463:5: error: implicit declaration of function ‘style’ [-Wimplicit-function-declaration]
```

### 소수 출력 — 기대값 미변경

```text
예제: tests/task944/float.fl
(println (json-stringify {"kelvin" 273.15}))
기대값(tests/task944/float.expected): {"kelvin":273.15}
현재 출력: {"kelvin":273.14999999999998}
task929 기존 기대: (check (= decimal "0.10000000000000001") "0.1 output preserved")
```

현재 출력과 두 기대값의 관계는 float/JSON 직렬화 정책 결정이 필요하다. 기대값·기준 파일은 수정하지 않았고, 정책은 사장님 결정으로 남긴다. 실패 원인 범위는 binary float JSON serialization이며 더 세부적인 원인은 **추측**하지 않는다.

## 4. 고정점과 전체 시험 원문

현재 시드 SHA-256과 최종 고정점 원문:

```text
seed: 36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2
stage2: 4d384e850739cf4e8003d666d5b46f360b70476a7112da9c49039558b2a4d723
stage3: 4d384e850739cf4e8003d666d5b46f360b70476a7112da9c49039558b2a4d723
stage4: 4d384e850739cf4e8003d666d5b46f360b70476a7112da9c49039558b2a4d723
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

각 백엔드 수정 뒤 `scripts/verify-native-fixed-point.sh`를 다시 실행했다. 마지막 `cgc-main.fl` 변경 뒤에도 stage2=stage3=stage4다.

전체 빠른 시험 실행기 원문:

```text
TASK942_LEGACY_BEGIN
```

그 뒤 `task931`의 `oom-nofile` 구간에서 멈춰 종료했다. 완료된 SUMMARY 원문은 없다. 실행 명령은 `strace -f -e trace=execve` 아래였으나 종료 전에 execve 카운트를 산출하지 못했다. node/npm/npx/JS/Python 각 0건은 미확인이다.

## 5. X86_SUMMARY

```text
a 9-43 끝 판정 정리 및 16-worker/pidstat 재측정: PASS
b 실제 _app 막힘 전체 원문: PARTIAL (GCC 오류 191줄·누락 이름 목록 기록, 원인 기능 다수 미해결)
c 최소 예제 전부 통과: FAIL (22/23; float만 실패)
d seed 36a806b0 유지, stage2=3=4: PASS
e 전체 빠른 시험 strace 및 node/npm/npx/JS/Python 각 0: FAIL (중단, 완료 SUMMARY·집계 없음)
f 민감 정보 검사: 커밋 전 결과 아래 기록
X86_SUMMARY=3/6
```

## 6. 남은 v11 필요 기능

- `_app.fl` GCC 검사에 남은 191개 오류. 미선언 함수 심볼: `_dollar_callback`, `aes_decrypt`, `aes_encrypt`, `assoc`, `base64_decode`, `base64_encode`, `conj`, `db_one`, `dissoc`, `doseq`, `format_date`, `hmac_sha256`, `http_body`, `http_delete`, `http_get_json`, `http_head`, `http_ok_p`, `http_post_form`, `http_post_json`, `http_put`, `http_status`, `js_keys`, `json_str`, `measure_time`, `min`, `mod`, `quot`, `random`, `random_bytes`, `scrypt_kdf`, `server_redirect_cookie`, `server_req_cookie`, `server_req_files`, `server_req_param`, `server_req_path`, `server_req_query`, `shell`, `shell_exec_stdout`, `style`.
- C 생성 오류: `str`, `callback`, `_plus`, `min` 미선언; `conj` 인자 수 불일치; 누락 함수에서 파생된 `invalid initializer`, 반환형·인자형 불일치.
- `aes_*`, `scrypt_kdf`, request cookie/files/query/param, HTTP client JSON/form/status, base64/HMAC, shell, `doseq`, `js_keys` 등 앱 사용 기능의 안전한 런타임 구현 및 최소 예제.
- JSON 소수 출력 정책의 사장님 결정.
- 전체 빠른 시험은 task931 멈춤 원인을 해결하고 SUMMARY와 프로세스 집계를 얻어야 한다.
- 앱의 native 실행 파일 링크 및 `/` HTTP 200.

## 7. 커밋·두 원격 HEAD와 미확인 항목

```text
branch: v11-x86-seed-public
start: 56f28ecb
supplement_start: c65d409a
current_before_report_commit: 4959818c
seed sha256: 36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2
Forgejo: pending report commit and push verification
GitHub: pending report commit and push verification
```

미확인: `_app.fl`의 전체 빌드·실행과 HTTP 200, 191개 GCC 오류의 잔여 런타임 기능, float 정책, 중단된 전체 빠른 시험의 SUMMARY·execve 집계, 앱 실행 중 실제 UI/요청 경로.
