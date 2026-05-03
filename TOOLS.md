# FreeLang v11 — 도구 & 기능 레퍼런스

> 경로: `/home/kimjin/freelang-v11`  
> 실행: `node bootstrap.js run <file.fl>`  
> 브라우저: `<script src="browser.js">` (1.1MB 번들)

---

## 🌐 웹 프레임워크 (Express.fl)

### REST API
```fl
(server_get    "/path" handler-fn)
(server_post   "/path" handler-fn)
(server_put    "/path" handler-fn)
(server_delete "/path" handler-fn)
(server_patch  "/path" handler-fn)
(server_start  3000)
```

### 응답 함수
| 함수 | 설명 |
|------|------|
| `server_json obj` | JSON 응답 |
| `server_html str` | HTML 응답 |
| `server_text str` | 텍스트 응답 |
| `server_status code body` | 상태코드 + 응답 |
| `server_redirect url` | 리다이렉트 |
| `server_static urlPrefix localDir` | 정적 파일 서빙 (CSS/JS/이미지) |

### 요청 파싱
| 함수 | 설명 |
|------|------|
| `server_req_body req` | 요청 바디 (raw string) |
| `server_req_json req` | 요청 바디 JSON 파싱 (Content-Type 무관) |
| `server_req_query req key` | 쿼리 파라미터 단일 값 |
| `server_req_params req` | 쿼리 파라미터 전체 맵 |
| `server_req_param req name` | 경로 파라미터 |
| `server_req_header req name` | 헤더 단일 값 |
| `server_req_headers req` | 헤더 전체 맵 |
| `server_req_cookie req name` | 쿠키 |
| `server_req_method req` | HTTP 메서드 (`"GET"` / `"POST"` 등) |
| `server_req_path req` | 요청 경로 (`"/api/users/42"`) |
| `server_req_id` | 현재 요청 ID (응답 보류용) |

### WebSocket (서버 내장)
```fl
(server_on_upgrade "ws-connect-handler")
(server_on_ws_message "ws-message-handler")
(ws_send_to_client sessionId data false)
```

### WebSocket (독립 서버)
```fl
(ws_start 8080)
(ws_send connId message)
(ws_broadcast message)
(ws_broadcast_json obj)
(ws_clients)        ; → [connId ...]
(ws_count)          ; → number
(ws_on_connect_fn "handler")
(ws_on_message_fn "handler")
```

### 캐싱
```fl
(cache_set key value ttl)   ; TTL: 초 단위
(cache_get key)             ; → value | null
(cache_del key)
(cache_clear)
(cache_size)
```

### 인증
```fl
; JWT
(auth_jwt_sign payload secret)      ; → token
(auth_jwt_verify token secret)      ; → payload | null

; 비밀번호
(auth_hash_password plain)          ; → "salt:hash"
(auth_verify_password plain hashed) ; → boolean

; 랜덤 토큰
(auth_random_token n)               ; → hex string (n bytes)

; API 키
(auth_api_key_generate)
(auth_api_key_verify key stored)
```

### 미들웨어
```fl
(middleware_use handler-fn)
(middleware_cors origin)
(middleware_rate_limit max window-ms)
(middleware_body_limit size-kb)
```

### 로깅
```fl
(log_info msg)
(log_warn msg)
(log_error msg)
(log_debug msg)
(log_json obj)     ; 구조화 로그
```

### 비동기 응답 보류 (Long-polling)
```fl
(define req-id (server_req_id))
(server_hold_response req-id)
; ... 나중에 다른 핸들러에서
(server_send_held req-id 200 (json_stringify {:data "..."}))
```

---

## 🔧 함수형 유틸리티

### 고차함수
```fl
(map fn arr)                      ; 배열 변환
(filter fn arr)                   ; 조건 필터링
(reduce fn init arr)              ; 누적 (3인자)
(reduce fn arr)                   ; 누적 - 첫 원소를 초기값으로 (2인자)
(apply fn args)                   ; 배열 펼쳐서 호출: (apply + [1 2 3]) → 6
(apply fn a b [rest])             ; 중간 인자 + 배열 합산

(find arr pred-fn)                ; 조건 만족 첫 요소
(find arr value)                  ; 값으로 검색 → 요소 반환 (없으면 null)
(some fn arr)                     ; 하나라도 true이면 true
(every? fn arr)                   ; 모두 true이면 true
(any? fn arr)                     ; some의 alias

(zip arr1 arr2)                   ; [[a1 b1] [a2 b2] ...]
(drop-first n arr)                ; 앞 n개 제거
(drop-last n arr)                 ; 뒤 n개 제거
```

### 함수 래퍼
```fl
(memoize fn)                      ; 무한 캐시 메모이즈
(memoize fn maxSize)              ; LRU 크기 제한 메모이즈
(memo_call m args...)             ; 메모이즈된 함수 호출
(memo_size m)                     ; 캐시 항목 수
(memo_clear m)                    ; 캐시 초기화

(once fn)                         ; 최초 1회만 실행, 이후 첫 결과 재사용
(tap fn value)                    ; fn(value) 실행 후 value 반환 (->> 파이프용)
(tap value fn)                    ; 순서 무관 자동 감지
```

### 성능/추적
```fl
(time_exec fn)                    ; 실행 시간 측정 → {:result v :ms n}
(span name fn)                    ; 추적 스팬 → {:name s :result v :ms n :ok bool}
(batch_map fn arr batchSize)      ; 배치 단위 처리 (기본 10)
(log_trace msg)                   ; 추적 로그 출력
(log_trace msg data)              ; 추적 로그 + 데이터
```

### 빈도 제한
```fl
(rate_limit maxCalls windowMs)    ; Rate limiter 생성
(rl_call limiter fn args...)      ; Rate-limited 함수 호출
```

### Predicate
```fl
(nil? v)        (nil-or-empty? v)
(fn? v)         (map? v)       (array? v)   (string? v)
(number? v)     (boolean? v)   (zero? v)
(pos? v)        (neg? v)       (even? v)    (odd? v)
(empty? v)      (any? fn arr)  (every? fn arr)
```

### 모나드
```fl
(ok value)                        ; Result Ok
(err code msg)                    ; Result Err
(some value)                      ; Option Some
(none)                            ; Option None
(left value)                      ; Either Left
(right value)                     ; Either Right
(success value)                   ; Validation Success
(failure errors)                  ; Validation Failure
(bind monad fn)                   ; 체이닝 (배열도 지원)
```

---

## 🌍 HTTP 클라이언트

> ⚠️ 모두 `spawnSync curl` 동기 실행. 서버 핸들러 안에서 호출 시 이벤트 루프 블로킹 주의.

모든 함수는 `{:status N :body "string"}` 반환.

```fl
(http_get url)                        ; GET
(http_post url body)                  ; POST (string 또는 object 자동 JSON.stringify)
(http_put url body)                   ; PUT
(http_patch url body)                 ; PATCH
(http_delete url)                     ; DELETE (body 없음)
(http_get_bearer url token)           ; GET + Authorization: Bearer
(http_get_key url api-key)            ; GET + X-API-Key
(http_post_key url body api-key)      ; POST + X-API-Key
(http_post_form url body)             ; POST + application/x-www-form-urlencoded
(http_head url)                       ; HEAD → body 빈 문자열
(http_status url)                     ; 상태코드만 반환 (숫자)
(http_json url)                       ; GET + JSON 자동 파싱 → {:status N :data {...} :error nil}
```

---

## 🛠️ CLI 도구

```bash
# 실행
node bootstrap.js run <file.fl>
node bootstrap.js run <file.fl> --watch    # hot reload
node bootstrap.js repl                      # 대화형 REPL
node bootstrap.js check <file.fl>           # 문법 검사
node bootstrap.js fmt <file.fl>             # 포맷

# 빌드
node bootstrap.js build --static            # 정적 HTML export
node bootstrap.js build --oci <app.fl> --tag <tag>  # OCI 이미지

# 문서
node bootstrap.js doc <file.fl>             # Markdown 문서 생성
node bootstrap.js doc --dir src/            # 디렉토리 전체

# 테스트
node bootstrap.js ci                        # 전체 .fl CI
node bootstrap.js ci <file.fl>
```

---

## 🤖 AI 에이전트

### Task 패턴
```fl
[FUNC my-task :params [$input]
  :body (
    (define state (agent_create "worker"))
    (define state (agent_set state "input" $input))
    (define result (do-work (get state "input")))
    (agent_set state "result" result)
  )
]
```

### 상태 관리 (불변)
```fl
(agent_create name)                    ; → AgentState
(agent_set state key value)            ; → 새 AgentState
(agent_get state key)                  ; → value
(agent_update state {k1 v1 k2 v2})    ; → 새 AgentState (다중 키)
(agent_steps state)                    ; → number
(agent_status state)                   ; → string
(agent_done state)                     ; → boolean
```

### 워크플로우
```fl
(plan_create ["step1" "step2" "step3"])
(plan_next plan)          ; → 현재 단계
(plan_advance plan result); → 다음 단계로
(plan_done plan)          ; → boolean
(plan_progress plan)      ; → 0.0 ~ 1.0
```

### 결정론 / SHA 검증
```fl
(auth_hash_password plain)   ; SHA256 + salt → 재현 가능
```

---

## 📚 표준 라이브러리 목록

| 모듈 | 함수 수 | 주요 기능 |
|------|---------|----------|
| `str_*` | 47개 | Python str 동등 수준 |
| `arr_*` | 15개 | 배열 조작 |
| `json_*` | 12개 | JSON 파싱/직렬화 |
| `file_*` | 13개 | 파일 I/O |
| `http_*` | 10개 | HTTP 클라이언트 |
| `server_*` | 25개 | HTTP 서버 |
| `ws_*` | 10개 | WebSocket |
| `auth_*` | 8개 | 인증/암호화 |
| `cache_*` | 6개 | 인메모리 캐시 |
| `agent_*` | 15개 | AI 에이전트 |
| `plan_*` | 6개 | 워크플로우 |
| `mariadb_*` | 8개 | MariaDB |
| `time_*` | 10개 | 날짜/시간 |
| `math_*` | 20개 | 수학 함수 |
| `matrix_*` | 12개 | 행렬 연산 |
| `stats_*` | 10개 | 통계 |
| `val_*` | 10개 | 입력 검증 |
| `dom_*` | 20개 | DOM (브라우저) |
| `fetch_*` | 4개 | HTTP (브라우저) |
| `storage_*` | 4개 | localStorage |

**총 661개 내장 함수**

---

## 🌐 브라우저 지원

```html
<script src="/path/to/browser.js"></script>
<script>
  const fl = FreeLang.FreeLang;
  fl.evaluate('(str_upper "hello")');  // → "HELLO"
</script>

<!-- 자동 실행 -->
<script type="text/freelang">
  (dom_set_text (dom_by_id "result") "FreeLang 실행!")
</script>
```

---

## 📁 주요 파일 경로

| 파일 | 설명 |
|------|------|
| `/home/kimjin/freelang-v11/bootstrap.js` | Node.js 실행 엔트리 (1.2MB) |
| `/home/kimjin/freelang-v11/browser.js` | 브라우저 번들 (1.1MB) |
| `/home/kimjin/freelang-v11/src/` | TypeScript 소스 |
| `/home/kimjin/freelang-v11/src/stdlib-*.ts` | 표준 라이브러리 |
| `/home/kimjin/freelang-v11/examples/` | 예제 코드 |
| `/home/kimjin/freelang-v11/TOOLS.md` | **이 파일** |

---

*최종 업데이트: 2026-04-26*
