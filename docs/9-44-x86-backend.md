# 지시서 9-44 — x86 백엔드 막힘 조사

실행 위치: `freelang-v11` 작업본, 가지 `v11-x86-seed-public`. 시작 HEAD는 `56f28ecb`였다. freelang-front의 `_app.fl`은 읽기 전용 입력으로 사용했고, 앞선 경로들은 `<가림>`으로 표기한다. 23·25 서버에는 접속하거나 실행하지 않았다. 부하·컴파일 시험은 `/tmp/fl-heavy.lock`을 획득한 뒤 실행했다.

## 1. 단계별 결과

### 0 — 9-43 보고서와 16-worker 재측정

`docs/9-43-pool-perf.md:190`의 끝 문장을 최종 통과 원문에 맞춰 고쳤다. 같은 문서에 `TASK942_ALL=PASS`, `POOL_SUMMARY=8/8`, `POOL_RESOURCE_STABLE=1`이 기록되어 있으므로 “풀 모드 전체 회귀는 통과하지 않았다”는 문장은 “최종 전수 실행에서는 … 통과했다”로 정정했다.

커밋된 감독 스크립트로 worker=16, `/ok`, 동시 연결 1000개, 60초를 한 번 측정하고 같은 시간 구간에 부하 클라이언트 PID의 `pidstat`을 붙였다. 실행 위치는 이 저장소의 로컬 시험 환경이다.

```text
TASK944_EXECUTION_LOCATION=freelang-v11
LOAD_STAGE stage=94401 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.015 requests=2241009 rps=37341.01 p50_ms=25.879 p99_ms=84.682 max_ms=190.506 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2241009,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2241009
Average: %usr=37.97 %system=6306.18 %CPU=6344.15 Command=load-client
```

재측정에서는 오류 0건이고 56.338% 오류는 재현되지 않았다. 서버 로그의 `database is locked`도 없었다. 부하 도구 CPU 사용률은 매우 높았지만, 과거 56.338% 오류의 종류별 원자료와 동일 실행의 CPU 자료가 없으므로 과거 원인은 **미확인**이다. CPU가 원인이었다고 단정하지 않는다. 판정 기준과 기대값은 바꾸지 않았다.

초기 감독 스크립트는 고정 시드를 앱 컴파일러로 직접 사용해 C API 오류로 측정 전 중단됐다. stage2를 만든 뒤 앱을 컴파일하도록 고쳐 다시 실행했다. 측정에 도달한 재실행 결과만 위에 기록했다.

### 1 — `_app.fl` 진단

입력은 `<가림>/_app.fl`이다. 전체 파일 컴파일은 C 출력 파일을 만들기 전에 자원 사용량이 계속 증가해 중단했다. 따라서 아래 최소 예제 결과가 전체 `_app.fl`의 모든 오류를 대체한다고 주장하지 않는다.

try/catch 최소 예제는 통과했다. 현재 백엔드에서 try 미지원은 재현되지 않았다.

```text
BACKEND_CASE=try COMPILE_RC=0
BACKEND_CASE=try GCC_RC=0
BACKEND_CASE=try OUTPUT=PASS
TRY_CAUGHT
```

템플릿 문자열도 IR 미지원 오류로 중단되지는 않았다. 대신 전역 `define` 값이 템플릿 바인딩 환경에 없어 출력이 비었다.

```text
BACKEND_CASE=template COMPILE_RC=0
BACKEND_CASE=template GCC_RC=0
BACKEND_CASE=template OUTPUT=FAIL
stdout: `Hello ` (끝에 공백 1개)
```

프런트엔드의 `server_html` 심볼을 고립한 최소 예제에서는 다음 GCC 진단이 재현됐다.

```text
<가림>/symbol.c:12:16: error: implicit declaration of function ‘server_html’ [-Wimplicit-function-declaration]
<가림>/symbol.c:12:16: error: incompatible types when assigning to type ‘FLValue’ from type ‘int’
```

프런트엔드 응답 헬퍼 4개를 최소 예제로 연결한 뒤 컴파일·링크·응답 맵 값 확인이 통과했다. 전체 앱에 추가 누락 심볼이나 C 문법 오류가 더 있는지는 전체 컴파일이 끝나지 않아 **미확인**이다.

소수 출력 예제는 JSON 직렬화에서 아래처럼 차이가 재현됐다.

```text
expected: {"kelvin":273.15}
actual:   {"kelvin":273.14999999999998}
```

### 2 — 최소 예제 선커밋 및 순차 수정

`tests/task944/{try,template,symbol,float}.fl`과 기대 출력은 실행 전에 `86d197d1`에서 커밋했다. 심볼 예제 확장은 `5cc8af9f`, 응답 헬퍼 검증은 `86039496`, `8f530a6e`에서 실행 전에 각각 커밋했다.

- try/catch: 기대 출력 `TRY_CAUGHT`, 통과. 수정 불필요.
- 템플릿: 기대 출력 `Hello Ada`. `define`한 전역 이름도 템플릿 환경에 넣어 통과.
- C 문법·심볼: 기대 출력 `SYMBOL_OK`. `server_html`, `server_status`, `server_header`, `server_redirect_cookie`를 런타임 응답 API에 연결해 통과.
- 소수 JSON 출력: 기대 출력은 `273.15`, 실제 출력은 긴 이진 부동소수 표현이며 아직 미해결.

소수 수정은 기존 `tests/task929/jsonnum.fl`의 고정 기대값 `0.1 → 0.10000000000000001`과 충돌한다. 이 작업에서 그 기준 파일이나 기대값을 바꾸지 않았다. 두 동작의 출력 계약을 함께 만족하는 수정은 확인하지 못했다.

## 2. 고친 곳

- `docs/9-43-pool-perf.md:190`: 최종 회귀 원문과 맞도록 마지막 판정 문장 정정.
- `tests/run-task944-worker16-ok.sh:1-53`: 16-worker `/ok`와 동시간대 `pidstat` 수집.
- `tests/run-task944-backend.sh:1-55`, `tests/task944/*`: 최소 예제, 고정 기대 출력, 컴파일·링크·실행 확인.
- `self/cgc-main.fl:700-727`: snake_case 프런트 응답 헬퍼의 네이티브 심볼 매핑.
- `self/cgc-main.fl:1392-1397,1660-1666`: 템플릿 환경에 전역 `define` 이름 포함.
- `runtime/runtime.h:146-147`: 응답 헤더 및 리다이렉트 쿠키 API 선언.
- `runtime/http_server.c:450-487,651-702,1137-1154`: 안전한 응답 헤더 검증·전송, `server_header` 및 `server_redirect_cookie` 구현.

## 3. 막힘 목록과 예제 원문

### try/catch

```text
예제: tests/task944/try.fl
(try
  (throw "example error")
  (catch [err]
    (println "TRY_CAUGHT")))
기대: TRY_CAUGHT
실제: TRY_CAUGHT
```

최소 예제에서는 재현되지 않았다. 전체 `_app.fl`의 try 관련 실패 원문은 확보하지 못했다.

### 템플릿 문자열

```text
예제: tests/task944/template.fl
(define name "Ada")
(println "Hello ${name}")
기대: Hello Ada
초기 실제: `Hello ` (끝에 공백 1개)
수정 후 실제: Hello Ada
```

템플릿 IR 미지원은 이 최소 입력에서 재현되지 않았다. 실제 결함은 전역 바인딩 누락이었다.

### gcc 문법·심볼

```text
예제: tests/task944/symbol.fl
(define response (server_html "SYMBOL_OK"))
(define headed (server_header response "X-Example" "ok"))
(define status (server_status 201 "SYMBOL_OK"))
(define redirect (server_redirect_cookie "/ok" "session=ok; Path=/; HttpOnly"))
...
```

매핑 전 GCC 원문은 1항에 기록했다. 수정 후 이 예제는 `GCC_RC=0`, `OUTPUT=PASS`, `SYMBOL_OK`였다. 전체 `_app.fl` GCC 진단은 **미확인**이다.

### 소수 출력

```text
예제: tests/task944/float.fl
(println (json-stringify {"kelvin" 273.15}))
기대: {"kelvin":273.15}
실제: {"kelvin":273.14999999999998}
```

## 4. 고정점과 전체 시험 원문

시드 SHA-256은 `36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2`로 유지했다. 마지막 성공한 고정점 실행은 응답 헬퍼 매핑·런타임 변경을 포함했고, `stage2=stage3=stage4`였다. 단계별 SHA-256:

```text
seed:   36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2
stage2: 00144b52f5a4d35ed124f9bd8e895d4ecc564e055dabde885417ed596fec2f8e
stage3: 00144b52f5a4d35ed124f9bd8e895d4ecc564e055dabde885417ed596fec2f8e
stage4: 00144b52f5a4d35ed124f9bd8e895d4ecc564e055dabde885417ed596fec2f8e
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

막힌 입력 전체 컴파일과 전체 빠른 시험은 통과로 보고하지 않는다. 전체 빠른 실행기 `tests/run-task920.sh`는 `examples/erp-vendors`를 실행하므로 금지 규칙에 따라 실행하지 않았다. 이 때문에 전체 빠른 시험의 `strace`와 Node/npm/npx/JS/Python 집계도 **미실행**이다. 개별 백엔드 예제는 모두 네이티브 C 컴파일·링크 경로로 실행했다.

## 5. X86_SUMMARY

```text
a 9-43 문서 정정 및 pidstat 재측정: PASS
b _app 전체 막힘 원문 확보: FAIL (전체 컴파일 중단, 일부 최소 입력 진단만 확보)
c 최소 예제 전체 통과: FAIL (3/4 통과, float JSON 출력 미해결)
d 시드 및 stage2=3=4: PASS
e 전체 빠른 시험 strace 및 실행기 집계: UNVERIFIED (ERP 금지로 미실행)
f 민감 정보 검사: 아래 보고서 커밋 전 검사 결과 0건
X86_SUMMARY=3/6
```

## 6. 남은 v11 필요 기능

- JSON 소수 출력 정책: `273.15`의 사용자 기대와 기존 `0.1` 고정 기대값을 동시에 만족하는 호환 규칙.
- 1만 줄 프런트 생성 입력을 끝까지 컴파일하고 원문 GCC·심볼 진단을 수집할 수 있는 컴파일 경로. 실험한 누적 최적화는 stage2=3=4를 확인하지 못해 모두 되돌렸다.
- 전체 앱 컴파일 후 드러날 추가 런타임 심볼·C 문법 요구사항. 현재는 **미확인**이며 `/` HTTP 200도 확인하지 않았다.

## 7. 커밋·원격 HEAD와 미확인 항목

보고서 커밋 직전 HEAD에는 이 작업의 코드·시험 커밋 10개가 포함됐다. 보고서 커밋과 Forgejo·GitHub 푸시 후 두 원격의 브랜치 HEAD를 확인해 여기에 기록한다.

```text
branch: v11-x86-seed-public
seed sha256: 36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2
unconfirmed: _app 전체 원문 오류, 추가 누락 심볼, float 출력 정책 충돌, 전체 빠른 시험, 민감정보 정밀 패턴 외의 유출 여부, _app 실행 및 / HTTP 200
```
