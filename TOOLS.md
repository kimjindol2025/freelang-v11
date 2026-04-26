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
| `server_req_body req` | 요청 바디 |
| `server_req_query req key` | 쿼리 파라미터 |
| `server_req_param req name` | 경로 파라미터 |
| `server_req_header req name` | 헤더 |
| `server_req_cookie req name` | 쿠키 |

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
