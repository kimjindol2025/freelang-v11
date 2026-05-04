# FreeLang v11 — Claude 빠른 레퍼런스

> **읽는 시간**: 5분 | **목적**: Claude가 FreeLang 코드를 즉시 작성할 수 있도록
> **런타임**: `node bootstrap.js run <file.fl>` | **PM2**: `pm2 restart <name>`

---

## 📚 문서 링크

| 문서 | 용도 |
|------|------|
| **[CLAUDE_AI.md](./docs/CLAUDE_AI.md)** ⭐ | AI 통합 가이드 — stdlib 46개 + 커먼 패턴 (먼저 읽기) |
| **[MISTAKES-100.md](./docs/MISTAKES-100.md)** 🔴 | 실수 100선 — 코드 작성 전 반드시 확인 |
| **[TOOLS.md](./TOOLS.md)** | 전체 함수 레퍼런스 |
| **[README.md](./README.md)** | 프로젝트 개요 |

---

## 📋 Audit Log

```fl
;; 환경변수 필수: AUDIT_URL, AUDIT_SERVICE_KEY
;; 실패해도 nil 반환 — 본 작업 차단 없음

;; 기본
(audit_log "akl-accounting" $actor-id "create" "invoice/INV-001" "청구서 생성")

;; actorId 없으면 serviceId로 자동 대체
(audit_log "akl-accounting" nil "delete" "user/42" "사용자 삭제")

;; 추가 필드 포함
(audit_log_custom "akl-accounting" $actor-id "update" "invoice/1"
                  "금액 수정" {:before 1000 :after 2000})

;; 결과 확인 (선택)
(if (audit_log_ok? (audit_log ...)) (println "기록됨") (println "실패"))
```

---

## ⚠️ 자주 틀리는 것 TOP 20 (먼저 읽기)

> 전체 목록: `docs/MISTAKES-100.md` 참고

```fl
;; ── 인자 순서 (가장 많이 틀림) ───────────────────────────────────
(map [1 2 3] fn)        → (map fn [1 2 3])          ;; fn 먼저!
(filter arr fn)         → (filter fn arr)           ;; fn 먼저!
(reduce arr init fn)    → (reduce fn init arr)      ;; fn 먼저!

;; ── HTTP 반환값 ───────────────────────────────────────────────────
(json_parse (http_get url))          → (json_parse (get (http_get url) "body"))
(http_post url body)                 ;; 반환: {:status N :body "..."} — body 꺼내야 함

;; ── 전역 상태 변경 ───────────────────────────────────────────────
(define count 0) (set! count 1)     → (define count (atom 0)) (swap! count + 1)

;; ── let 문법 ─────────────────────────────────────────────────────
(let [x 1 y 2] ...)                 → (let [[$x 1] [$y 2]] ...)

;; ── 함수 선언 ([FUNC] deprecated, 경고 출력됨) ──────────────────
[FUNC f :params [x] :body ...]      → (defn f [$x] ...)

;; ── map 키 ───────────────────────────────────────────────────────
{name "kim"}                        → {:name "kim"}
(= x null)                          → (nil? x)

;; ── 함수명 오류 ──────────────────────────────────────────────────
(env "KEY") / (get_env "KEY")       → (shell_env "KEY")
(server_listen 3000)                → (server_start 3000)
(str-to-int "42")                   → (str-to-num "42")
(console.log x)                     → (println x)
(json_keys m)                       → (keys m)
(now-ms)                            → (now_ms)
(mariadb_all db sql p)              → (mariadb_query db sql p)
(obj_merge a b)                     → 미구현 — (assoc a "k" v) 직접
(obj_omit m ["k"])                  → (dissoc m "k")

;; ── 웹서버 버전 선택 ─────────────────────────────────────────────
;; 내부 API → server_* 직접 / 외부 노출 API → (load "src/express.fl")
;; 혼용 금지: express.fl 로드 후 server_get 사용 ❌
```

---

## 🛠️ 개발 명령어 (자주 모르는 것)

```bash
freelang watch server.fl          # 파일 저장 시 자동 재실행 ← 개발 중 필수!
freelang run server.fl --watch    # 동일 (--watch 플래그)
freelang check server.fl          # 문법 오류만 빠르게 확인
freelang fmt server.fl            # 코드 포맷
freelang debug server.fl          # 브레이크포인트 디버그
freelang fn-doc str_split         # 함수 문서 조회
```

## ⚠️ 에러 메시지 포맷 (2026-05-03 개선)

에러 발생 시 **파일명:라인 + 소스 컨텍스트 + 콜 스택** 자동 표시:

```
실행 오류  app.fl:9
       8 │ (defn run []
  →    9 │   (undefined-func 42)    ← 에러 라인 빨간 강조
      10 │ )

  ✖ Function not found: undefined-func

콜 스택:
  → run (line 9)
    main (line 12)
```

## ⚠️ try/catch — $e 구조

```fl
(try
  (json_parse "bad")
  (catch $e
    (println $e)                  ;; "[line 2] json_parse: invalid JSON..."
    (get $e "message")            ;; 에러 메시지 문자열
    (get $e "line")               ;; 발생 줄 번호 (number)
    (get $e "file")))             ;; 발생 파일명
```

---

## 🆕 v11 최신 추가 함수 (모르면 손해)

```fl
;; ── 이미 되는 것 (몰랐으면 지금부터 사용) ────────────────────────────
(assoc {} "a" 1 "b" 2 "c" 3)          ;; assoc 다중 인자 ← 지금도 됨!
(->> $items (filter fn) (map fn))      ;; thread-last ← 이미 있음
(defn empty? [$x] ...)                 ;; ? 함수명 ← 이미 됨
(when-let [[$u (find-user $id)]] ...)  ;; when-let ← 이미 됨
(freelang repl)                        ;; REPL ← 이미 있음!

;; ── 깊은 객체 접근/수정 ────────────────────────────────────────────
(get-in m ["a" "b" "c"])               ;; 깊은 접근
(assoc-in m ["a" "b"] 99)             ;; 깊은 업데이트 (불변)
(update-in m ["count"] (fn [$n] (+ $n 1)))  ;; 깊은 함수 업데이트

;; ── 정규식 (re-* 별칭) ────────────────────────────────────────────
(re-match "\\d+" "abc123")            ;; → true
(re-find "\\d+" "abc123def")          ;; → "123"
(re-find-all "\\d+" "1a2b3c")         ;; → ["1" "2" "3"]
(re-replace "\\s+" "_" "a b c")       ;; → "a_b_c"
(re-split "[,;]" "a,b;c")             ;; → ["a" "b" "c"]
(re-groups "(\\w+)@(\\w+)" "a@b")     ;; → ["a" "b"] (캡처 그룹)

;; ── 구조화 로깅 ────────────────────────────────────────────────────
(log/info "user logged in" {:userId $uid})
(log/warn "rate limit" {:current 90 :limit 100})
(log/error "db failed" {:err $e})      ;; $e는 try/catch 에러 맵
(log/debug "query" {:sql $q})          ;; FL_DEBUG=1 일 때만 출력

;; ── PUT 패턴 단순화 ───────────────────────────────────────────────
(merge $existing (dissoc-nil $body))  ;; nil 필드 제거 후 머지

;; ── 파이프 확장 ────────────────────────────────────────────────────
(->> [1 2 3] (filter (fn [$x] (> $x 1))) (map (fn [$x] (* $x 2))))
(as-> $items $v
  (filter (fn [$x] (> $x 0)) $v)   ; $v = 중간값
  (map (fn [$x] (* $x 10)) $v))    ; 임의 위치 삽입 가능

;; ── nil-safe 접근 (?.) ─────────────────────────────────────────────
(?. $user :profile :name)          ; nil이면 즉시 nil 반환
(?. $user :address :city)          ; 중간에 nil → null

;; ── 타입 힌트 (선택, 런타임 무시) ──────────────────────────────────
(defn ^string greet [^string $name] (str "Hello " $name))
(defn ^number add [^number $a ^number $b] (+ $a $b))

;; ── 함수 탐색 ──────────────────────────────────────────────────────
;; freelang ls-fns           전체 목록
;; freelang ls-fns "http"    http 관련만
;; freelang fn-doc str_split 상세 설명

;; ── AI-Native 메타 (Phase 1) ──────────────────────────────────────
;; defn 첫 body에 맵을 두면 메타로 인식 (실행 안 됨, 분리됨)
(defn get-user [$req]
  {:context "Bearer 토큰으로 사용자 조회"
   :returns "User | nil"
   :effects [:http :db-read]
   :examples "(get-user $req) => {:id 1 :name \"kim\"}"}
  (http_get "http://auth/me"))

;; 런타임 메타 조회
(fn-meta "get-user")   ; => {:context "..." :returns "..." :effects [...]}

;; check 명령어: 메타 누락 함수 경고
;; freelang check server.fl
;; ⚠  line 9: no-meta — :context/:returns 없음
```

---

## 🔤 기본 문법

```fl
;; 변수
(define x 42)

;; 함수 — (defn ...) 만 사용
(defn add [$a $b] (+ $a $b))
;; [FUNC add :params [$a $b] :body ...] ← deprecated, 경고 출력됨

;; 조건
(if (> x 0) "양수" "음수")
(cond [(= x 1) "하나"] [(= x 2) "둘"] [true "기타"])

;; let
(let [[$x 10] [$y 20]] (+ $x $y))

;; do 블록
(do (define a 1) (define b 2) (+ a b))
```

---

## 📋 컬렉션

```fl
;; 배열
(get arr 0)                                   ;; 인덱스 접근
(length arr)                                  ;; 길이
(append arr 6)                                ;; 추가 (불변)
(slice arr 1 3)                               ;; 슬라이스
(map fn arr)                                  ;; ※ fn 먼저!
(filter arr fn)                               ;; ※ array 먼저!
(reduce fn init arr)
(join arr ", ")

;; map/object
(define m {:name "kim" :age 30})
(get m "name")                                ;; "kim"
(map-set m "age" 31)                         ;; 새 map 반환
(keys m)                                      ;; ["name","age"]
(map-entries m)                               ;; [["name","kim"],...]
(obj_merge {:a 1} {:b 2})                    ;; {:a 1 :b 2}
(obj_pick m ["name"])                         ;; {:name "kim"}
(obj_omit m ["age"])                          ;; {:name "kim"}
```

---

## 🌐 HTTP 서버 — 반드시 아래 기준으로 선택

> ⚠️ **아무 방식이나 섞어 쓰면 안 됨. 프로젝트 시작 시 둘 중 하나를 선택하고 고정.**

---

### ✅ 선택 기준

| 상황 | 사용 버전 |
|------|----------|
| 내부 API, 마이크로서비스, kimdb 클라이언트 | **가벼운 버전** (server_* 직접) |
| 외부 노출 API, CRUD 앱, 인증/캐시 필요 | **무거운 버전** (express.fl 로드) |

---

### 🪶 가벼운 버전 (직접 server_* 사용)

```fl
;; 예제: src/api/server.fl 패턴
(defn handle-health [$req]
  (server_json {:status "ok"}))

(defn handle-get-item [$req]
  (let [[$id (server_req_param $req "id")]]
    (server_json {:id $id :data "..."})))

(defn handle-post-item [$req]
  (let [[$body (json_parse (server_req_body $req))]]
    (server_json {:success true})))

(server_get    "/health"      "handle-health")
(server_get    "/api/:id"     "handle-get-item")
(server_post   "/api"         "handle-post-item")
(server_put    "/api/:id"     "handle-put-item")
(server_delete "/api/:id"     "handle-delete-item")
(server_start  40100)

;; 요청 헬퍼
(server_req_param  $req "id")          ;; URL :param
(server_req_query  $req "key")         ;; ?key=val
(server_req_body   $req)               ;; body 문자열
(server_req_header $req "Authorization")
(server_req_cookie $req "name")

;; 응답 헬퍼
(server_json   {:ok true})
(server_text   "plain text")
(server_html   "<h1>OK</h1>")
(server_status 404 {:error "Not Found"})
(server_redirect "/login")
(server_static "public/app.css")
(server_html_cookie     "sid=abc; Path=/; HttpOnly" "<html>...")
(server_redirect_cookie "/home" "sid=; Path=/; Max-Age=0")
```

---

### 🏋️ 무거운 버전 (express.fl 로드)

```fl
;; 예제: src/api/server.fl 패턴
(load "src/express.fl")   ;; ← 반드시 이 줄 먼저

(defn handle-health [$req]
  (res-json {:status "ok"}))

(defn get-user [$req]
  (let [[$id   (req-param $req "id")]
        [$body (req-body  $req)]]
    (res-json {:id $id})))

(defn post-user [$req]
  (let [[$body (req-body $req)]
        [$name (get $body "name")]]
    (if $name
      (res-status 201 {:success true})
      (res-status 400 {:error "name required"}))))

(app-get    "/health"        "handle-health")
(app-get    "/api/users/:id" "get-user")
(app-post   "/api/users"     "post-user")
(app-put    "/api/users/:id" "put-user")
(app-delete "/api/users/:id" "delete-user")
(app-listen 40100)

;; express.fl 제공 함수
;; 요청: req-param, req-query, req-body, req-header
;; 응답: res-json, res-send, res-status
;; 로그: log-info, log-error
```

---

### ❌ 금지 패턴

```fl
;; 가벼운 + 무거운 혼용 금지
(load "src/express.fl")
(server_get "/path" "handler")   ;; ❌ — express.fl 로드했으면 app-get만 써야 함

;; v10 [FUNC] 문법 금지
[FUNC handler :params [req] :body ...]  ;; ❌ — v11에서 동작 안 함
```

---

## 🗄️ MariaDB

```fl
(define DB (mariadb_connect {:host "localhost" :user "root"
                              :password "" :database "mydb"}))

(mariadb_query DB "SELECT * FROM users" [])            ;; → 배열
(mariadb_one   DB "SELECT * FROM users WHERE id=1" []) ;; → row or null
(mariadb_exec  DB "INSERT INTO t (name) VALUES (?)" ["kim"])

;; SQL 이스케이프 (내장 esc 함수 사용)
(str "SELECT * FROM users WHERE name=" (esc username))
```

---

## 🔐 인증

```fl
(auth_hash_password "test1234")           ;; → "salt:hash"
(auth_verify_password "입력값" "salt:hash") ;; → true/false
(auth_random_token 32)                    ;; → 64자 hex

(auth_jwt_sign   {:user_id 1} "secret" 3600)
(auth_jwt_verify token "secret")          ;; → payload or null
(auth_jwt_expired token)                  ;; → true/false
(auth_sha256 "data")
(auth_hmac "data" "secret")
```

---

## 🎯 패턴 매칭 ✨ 2026-04-27 완성

```fl
;; 기본
(match value
  (42    "마흔둘")
  ("ok"  "성공")
  (_     "기타"))

;; Map 패턴 — 변수 캡처
(match {:status "ok" :data 42}
  ({:status "ok"    :data $d} (str "성공: " $d))
  ({:status "error" :msg  $m} (str "에러: " $m))
  (_ "미상"))

;; 중첩 + 다중 캡처
(match {:user {:name "kim"} :role "admin"}
  ({:user {:name $n} :role "admin"} (str $n " 관리자"))
  (_ "일반"))
```

---

## 📁 파일 / 환경

```fl
;; ※ AI-First #3: snake_case ↔ kebab-case 양방향 허용 (snake_case 표준)
;; 파일
(file_read   "path/file.txt")    ;; snake_case 표준
(file_write  "path/file.txt" "내용")
(file_append "log.txt" "한 줄\n")
(file_exists "path")             ;; → true/false
(file_mkdir  "dir/sub")          ;; 재귀 생성
(file_delete "file.txt")
(dir_list    "path")             ;; → [string]

;; 환경변수 ※ shell_env만 실제 동작
(shell_env  "PORT")              ;; → string | null  ✅
;; ❌ get_env, get_env_or, env — 미구현

;; 쉘
(shell_exec "git log --oneline -3" "/path/to/repo")
;; → {:stdout "..." :stderr "..." :code 0 :ok true}
```

---

## 🤖 AI

```fl
;; ANTHROPIC_API_KEY 환경변수 필요
(ai-call "claude-sonnet-4-6" "질문")
(ai-call "claude-sonnet-4-6" {:prompt "질문" :max-tokens 2048})

;; 에이전트
(define a (agent_create "agent"))
(define a (agent_set a "goal" "목표"))
(agent_run_until a
  (fn [$a] (agent_done $a))
  (fn [$a] (agent_set $a "status" "done")))
```

---

## 🔄 워크플로우 / Saga / 병렬 (2026-04-28)

```fl
;; ── workflow_run ─────────────────────────────────────────────────
(define step (workflow_step "process"
  (fn [$ctx] {:count (length (get $ctx "data"))})
  {:if (fn [$ctx] (> (length (get $ctx "data")) 0))
   :retry 2 :on_error (fn [$e] {:fallback true})}))
(define r (workflow_run (workflow_create "wf" [$step]) {:data [1 2 3]}))
(workflow_ok r)           ;; true/false
(workflow_get r "count")  ;; context 값
(workflow_summary r)      ;; 텍스트 요약

;; ── saga_run — 보상 트랜잭션 ─────────────────────────────────────
(saga_run
  [{:name "db"    :action (fn [$c] {:id 1}) :compensate (fn [$r] (println "롤백"))}
   {:name "email" :action (fn [$c] (error "SMTP")) :compensate (fn [$r] nil)}]
  {})
;; → {:ok false :failed_step "email" :compensated ["db"] :results [...]}

;; ── workflow_parallel — best-effort 병렬 ──────────────────────────
(workflow_parallel
  [(workflow_step "a" (fn [$c] {:a 1}) {})
   (workflow_step "b" (fn [$c] {:b 2}) {})
   (workflow_step "x" (fn [$c] (error "fail")) {:required false})]
  {})
;; → {:ok false :results [4개] :errors [1개] :context {:a 1 :b 2}}

;; ── workflow_parallel_any — 최초 성공 반환 ────────────────────────
(workflow_parallel_any [(workflow_step "a" (fn [$c] {:v 1}) {})] {})
;; → {:ok true :name "a" :result {:v 1} :ms N}

;; ── batch_map — 배치 처리 ─────────────────────────────────────────
(batch_map [1 2 3 4 5 6] 2 (fn [$b] (map (fn [$x] (* $x 10)) $b)))
;; → {:ok true :results [10 20 30 40 50 60] :total 6 :batches 3}

;; ── distribute — N 워커 분산 ──────────────────────────────────────
(distribute [1 2 3 4 5 6] 3 (fn [$batch $w] (map (fn [$x] (+ $x $w)) $batch)))
;; → {:ok true :results [...] :worker_results [{:worker 0 :ok true}...]}

;; ── 관찰성 ────────────────────────────────────────────────────────
(time_exec (fn [] (+ 1 2)))        ;; → {:ok true :result 3 :ms N}
(span "my-op" (fn [] 42))         ;; → {:label "my-op" :result 42 :ms N}
(log_trace "users" {:count 42})   ;; stderr 출력, 원본 값 반환

;; ※ 예약어 map 키 허용: {:if fn :let 1 :do "x"}
```

---

## 🔒 P2: 보안 / 성능 / DAG (2026-04-28)

```fl
;; ── sandbox_run — 격리 실행 ──────────────────────────────────────
(sandbox_run (fn [] (+ 1 2 3)) {:timeout 5000})
;; → {:ok true :result 6 :ms N :calls N}
(sandbox_run (fn [] (error "위험")) {:timeout 1000})
;; → {:ok false :error "위험" :ms N}

;; ── memoize — LRU 캐싱 ───────────────────────────────────────────
(define square (fn [$x] (* $x $x)))   ;; 기명 함수도 직접 전달 가능
(define m (memoize square 128))       ;; LRU maxSize=128 (0=무제한)
(memo_call m 5)   ;; → 25 (계산)
(memo_call m 5)   ;; → 25 (캐시 적중)
(memo_size m)     ;; → 1
(memo_clear m)    ;; 캐시 초기화

;; ── rate_limit — 호출 빈도 제한 ──────────────────────────────────
(define rl (rate_limit square 10 1000)) ;; 10회/1초
(rl_call rl 5)   ;; → 25 (정상)
;; 11번째 호출 → error: "rate_limit: 10회/1000ms 초과"

;; ── workflow_dag — 의존성 그래프 실행 ────────────────────────────
;; :depends [names] → 위상정렬 후 실행, 순환 감지
(workflow_dag
  [(workflow_step "a" (fn [$c] {:x 1}) {})
   (workflow_step "b" (fn [$c] {:y (get $c "x")}) {:depends ["a"]})
   (workflow_step "c" (fn [$c] {:z (+ (get $c "x") (get $c "y"))}) {:depends ["a" "b"]})]
  {})
;; → {:ok true :order ["a" "b" "c"] :context {:x 1 :y 1 :z 2}}

;; ── ※ 기명 함수 → 고차함수 직접 전달 (2026-04-28 인터프리터 수정) ─
;; (define f (fn [$x] ...)) 후 f를 fn-value 객체로 전달 가능
(map square [1 2 3])          ;; → [1 4 9]
(workflow_step "s" square {}) ;; fn 자리에 기명 함수
(saga_run [{:action square :compensate square}] {})
```

---

## 🏗️ 전체 서버 앱 패턴

```fl
(define DB (mariadb_connect {:host "localhost" :user "root"
                              :password "" :database "mydb"}))

;; 세션 헬퍼
[FUNC get-session :params [$req]
  :body (
    (define sid (server_req_cookie $req "app_sid"))
    (if (= sid null) null
      (mariadb_one DB
        (str "SELECT * FROM sessions WHERE session_id='" sid
             "' AND expires_at > NOW()") []))
  )
]

;; 인증 핸들러
[FUNC handle-get-users :params [$req]
  :body (
    (define sess (get-session $req))
    (if (= sess null)
      (server_status 401 {:ok false :error "인증 필요"})
      (server_json {:ok true
                    :data (mariadb_query DB "SELECT * FROM users" [])}))
  )
]

(server_get "/api/users" "handle-get-users")
(server_start 40100)
```

---

## 📦 최신 변경 이력

| 날짜 | 기능 | 상태 |
|------|------|------|
| 2026-04-28 | **기명 함수 → fn-value 전달 (인터프리터 근본 수정)** | ✅ bootstrap.js |
| 2026-04-28 | P2: `sandbox_run` `memoize/memo_call` `rate_limit/rl_call` `workflow_dag` | ✅ bootstrap.js |
| 2026-04-28 | P1: `saga_run` `workflow_parallel` `batch_map` `distribute` `time_exec` `span` | ✅ bootstrap.js |
| 2026-04-28 | P0: `workflow_run` `:if` 조건부 실행, `:on_error`, `:fallback`, 체크포인트 | ✅ bootstrap.js |
| 2026-04-28 | 파서: `[{...}]` 배열 제너릭 오인 방지, 예약어 map 키 허용 | ✅ bootstrap.js |
| 2026-04-28 | `obj_merge` `obj_pick` `obj_omit` 추가 선언 | ⚠️ 미구현 → `assoc`/`dissoc` 사용 |
| 2026-04-27 | `get_env` `get_env_or` 추가 선언 | ⚠️ 미구현 → `shell_env` 사용 |
| 2026-04-27 | `file_mkdir` `file_rmdir` 추가 | ✅ bootstrap.js |
| 2026-04-27 | `server_req_body` JSON 자동파싱 | ✅ bootstrap.js |
| 2026-04-27 | `shell_exec` / `server_static` 추가 | ✅ bootstrap.js |
| 2026-04-27 | Map 패턴 매칭 `{:key $var}` | ✅ bootstrap.js |

---

## ⚙️ 실행

```bash
node /home/kimjin/freelang-v11/bootstrap.js run app.fl
pm2 restart <name>
pm2 logs <name>
FL_DEV=1 node bootstrap.js run app.fl   # 개발 모드
```

**경로**: `/home/kimjin/freelang-v11/bootstrap.js`
**포트**: 신규 40000-43000 | v10 보호 43000-49999

---

## 🔧 괄호 오류 / 문법 검사 (필수 커맨드)

> **괄호 수가 틀릴 때 손으로 세지 말 것 — 아래 명령어로 한 번에 해결**

```bash
# 1. 문법 검사 — 오류 위치 + 라인 번호 출력
node /home/kimjin/freelang-v11/bootstrap.js check 파일.fl

# 2. 자동 포맷 — 들여쓰기 + 괄호 정렬 인플레이스 수정
node /home/kimjin/freelang-v11/bootstrap.js fmt 파일.fl

# 3. 포맷 확인만 (수정 없이) — CI용
node /home/kimjin/freelang-v11/bootstrap.js fmt --check 파일.fl
```

**작업 순서**: `fmt` → `check` → 에러 없으면 실행

```bash
# 한 번에
node /home/kimjin/freelang-v11/bootstrap.js fmt 파일.fl && \
node /home/kimjin/freelang-v11/bootstrap.js check 파일.fl && \
echo "✅ OK"
```
