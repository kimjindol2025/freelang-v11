# FreeLang v11 — Claude 빠른 레퍼런스

> **읽는 시간**: 5분 | **목적**: Claude가 FreeLang 코드를 즉시 작성할 수 있도록
> **런타임**: `node bootstrap.js run <file.fl>` | **PM2**: `pm2 restart <name>`

---

## ⚠️ 자주 틀리는 것 (먼저 읽기)

```fl
;; ❌ → ✅
(map [1 2 3] fn)        → (map fn [1 2 3])          ;; map: fn 먼저
(filter fn arr)         → (filter arr fn)            ;; filter: array 먼저
(server_listen 3000)    → (server_start 3000)
(get-or m k d)          → 직접 정의 필요 (내장 없음)
{a 1}                   → {:a 1}                     ;; 키워드 필수
(= x null)              → (nil? x)
(console.log x)         → (println x)
(str-to-int "42")       → (parse-int "42")
```

---

## 🔤 기본 문법

```fl
;; 변수
(define x 42)

;; 함수 (두 가지)
[FUNC add :params [$a $b] :body (+ $a $b)]
(defn add [$a $b] (+ $a $b))

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
(json_set m "age" 31)                         ;; 새 map 반환
(json_keys m)                                 ;; ["name","age"]
(map-entries m)                               ;; [["name","kim"],...]
(obj_merge {:a 1} {:b 2})                    ;; {:a 1 :b 2}
(obj_pick m ["name"])                         ;; {:name "kim"}
(obj_omit m ["age"])                          ;; {:name "kim"}
```

---

## 🌐 HTTP 서버

```fl
;; 라우트 등록 — 핸들러는 반드시 문자열
(server_get    "/path"     "handler-name")
(server_post   "/api/data" "handle-post")
(server_put    "/api/:id"  "handle-put")
(server_delete "/api/:id"  "handle-delete")
(server_start 40100)

;; 요청
(server_req_params $req)         ;; URL 파라미터 {:id "1"}
(server_req_query  $req "key")   ;; ?key=val
(server_req_body   $req)         ;; body (JSON 자동 파싱)
(server_req_cookie $req "name")  ;; 쿠키
(server_req_header $req "Authorization")

;; 응답
(server_html   "<h1>안녕</h1>")
(server_json   {:ok true :data result})
(server_text   "plain text")
(server_status 404 {:error "Not Found"})
(server_redirect "/login")
(server_static "public/app.css")   ;; ✨ NEW — MIME 자동, 바이너리 OK

;; 쿠키 포함
(server_html_cookie     "sid=abc; Path=/; HttpOnly" "<html>...")
(server_redirect_cookie "/home" "sid=; Path=/; Max-Age=0")
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
;; 파일
(file_read   "path/file.txt")
(file_write  "path/file.txt" "내용")
(file_append "log.txt" "한 줄\n")
(file_exists "path")             ;; → true/false
(file_mkdir  "dir/sub")          ;; 재귀 생성
(file_rmdir  "dir")              ;; 재귀 삭제
(file_delete "file.txt")
(file_size   "file.txt")         ;; → bytes
(file_is_dir "path")
(dir_list    "path")             ;; → [string]

;; 환경변수
(get_env     "PORT")             ;; → string | ""
(get_env_or  "PORT" "3000")     ;; → string (없으면 기본값)
(shell_env   "HOME")             ;; get_env와 동일

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
| 2026-04-28 | 런타임 에러 소스 라인+포인터 표시 | ✅ bootstrap.js |
| 2026-04-28 | `obj_merge` `obj_pick` `obj_omit` 추가 | ✅ bootstrap.js |
| 2026-04-27 | `file_mkdir` `file_rmdir` `get_env` `get_env_or` 추가 | ✅ bootstrap.js |
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
