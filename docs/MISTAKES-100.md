# FreeLang v11 — 실수하는 100선

> **목적**: Claude와 개발자가 반복하는 실수 모음. 코드 작성 전 반드시 확인.  
> **업데이트**: 새 실수 발견 시 즉시 추가.

---

## 🔴 Category 1: 인자 순서 (가장 많이 틀림)

```lisp
;; #1 — map: fn 먼저, 배열 나중
(map [1 2 3] fn)            ;; ❌
(map fn [1 2 3])            ;; ✅

;; #2 — filter: fn 먼저
(filter arr fn)             ;; ❌
(filter fn arr)             ;; ✅

;; #3 — reduce: fn 먼저, 초기값 두 번째
(reduce arr init fn)        ;; ❌
(reduce fn init arr)        ;; ✅

;; #4 — sort-by: fn 먼저
(sort-by arr key-fn)        ;; ❌
(sort-by key-fn arr)        ;; ✅

;; #5 — assoc: map, key, value 순서
(assoc "key" "val" m)       ;; ❌
(assoc m "key" "val")       ;; ✅

;; #6 — dissoc: map 먼저
(dissoc "key" m)            ;; ❌
(dissoc m "key")            ;; ✅

;; #7 — str-contains: 문자열, 패턴 순서
(str-contains "lo" "hello") ;; ❌
(str-contains "hello" "lo") ;; ✅

;; #8 — str-replace: str, from, to 순서
(str-replace "new" "old" s) ;; ❌
(str-replace s "old" "new") ;; ✅

;; #9 — get: map 먼저, key 나중
(get "name" m)              ;; ❌
(get m "name")              ;; ✅

;; #10 — cache_set: key, value, ttl 순서
(cache_set val key ttl)     ;; ❌
(cache_set key val ttl)     ;; ✅
```

---

## 🔴 Category 2: HTTP 클라이언트 반환값

```lisp
;; #11 — http_get 반환: 구조체, body 직접 아님
(json_parse (http_get url))                     ;; ❌ — 구조체 파싱 시도
(json_parse (get (http_get url) "body"))        ;; ✅

;; #12 — http_post 반환: 동일
(json_parse (http_post url body))               ;; ❌
(json_parse (get (http_post url body) "body"))  ;; ✅

;; #13 — http_get 상태코드 확인
(= (http_get url) 200)                          ;; ❌ — 구조체와 비교 불가
(= (get (http_get url) "status") 200)           ;; ✅

;; #14 — http_get_key / http_post_key (API Key 인증)
(http_get url)                                  ;; ❌ — API Key 서버에 401
(http_get_key url api-key)                      ;; ✅

;; #15 — http_post body는 문자열
(http_post url {:data item})                    ;; ❌ — 맵 직접 전달
(http_post url (json_stringify {:data item}))   ;; ✅
```

---

## 🔴 Category 3: 전역 상태 변경

```lisp
;; #16 — define 재정의가 전역에 안 반영됨
(define count 0)
(define count 1)       ;; ❌ — 로컬 스코프에만 반영
(set! count 1)         ;; ❌ — 클로저 내부에서 전역 미반영

;; ✅ 올바른 방법: atom
(define count (atom 0))
(reset! count 1)                    ;; 덮어쓰기
(swap! count + 1)                   ;; 함수 적용
(deref count)                       ;; 읽기

;; #17 — 맵 전역 상태 변경
(define state {})
(set! state (assoc state "k" "v"))  ;; ❌ — 전역 미반영

(define state (atom {}))
(swap! state assoc "k" "v")         ;; ✅

;; #18 — 배열 전역 상태 append
(define items [])
(set! items (append items [x]))     ;; ❌

(define items (atom []))
(swap! items (fn [$a] (append $a [x])))  ;; ✅

;; #19 — deref 누락
(get state "key")                   ;; ❌ — atom을 바로 get
(get (deref state) "key")           ;; ✅

;; #20 — swap! fn 인자
(swap! ref (fn [] new-val))         ;; ❌ — 현재값 인자 누락
(swap! ref (fn [$cur] new-val))     ;; ✅
```

---

## 🔴 Category 4: let 문법

```lisp
;; #21 — v10 let (동작 안 함)
(let [x 1 y 2] (+ x y))            ;; ❌

;; #22 — v11 let 정상 문법
(let [[$x 1] [$y 2]] (+ $x $y))    ;; ✅

;; #23 — 단일 바인딩도 이중 괄호
(let [$x 1] $x)                    ;; ❌
(let [[$x 1]] $x)                  ;; ✅

;; #24 — let body는 마지막 식이 반환값
(let [[$x 1]]
  (println "debug")
  (+ $x 1))                        ;; ✅ — (+ $x 1) 반환

;; #25 — let 안에서 이전 바인딩 참조
(let [[$x 1] [$y (+ $x 1)]] $y)   ;; ✅ — 순서대로 평가됨
```

---

## 🔴 Category 5: 함수 선언

```lisp
;; #26 — v10 [FUNC] 문법 v11에서 동작 안 함
[FUNC add :params [a b] :body (+ a b)]  ;; ❌

;; #27 — v11 defn 표준
(defn add [$a $b] (+ $a $b))       ;; ✅

;; #28 — $ 파라미터 누락
(defn add [a b] (+ a b))           ;; ❌ — a가 정의되지 않은 심볼
(defn add [$a $b] (+ $a $b))       ;; ✅

;; #29 — 익명 함수 fn
(fn [x] (* x 2))                   ;; ❌
(fn [$x] (* $x 2))                 ;; ✅

;; #30 — 재귀: 함수명으로 직접 호출
(defn fact [$n]
  (if (<= $n 1) 1 (* $n (fact (- $n 1)))))  ;; ✅

;; #31 — 고차 함수에 익명 함수 전달
(map [1 2 3] (fn [x] (* x 2)))     ;; ❌ — 인자 순서 + $ 누락
(map (fn [$x] (* $x 2)) [1 2 3])   ;; ✅
```

---

## 🔴 Category 6: 함수명 오류 (미구현 / 이름 변경)

```lisp
;; #32 — 환경변수
(env "KEY") / (get_env "KEY") / (env_get "KEY")  ;; ❌ 모두 미구현
(shell_env "KEY")                                 ;; ✅

;; #33 — 서버 시작
(server_listen 3000) / (server_run 3000)  ;; ❌
(server_start 3000)                       ;; ✅

;; #34 — 타입 변환
(str-to-int "42") / (parseInt "42")  ;; ❌
(str-to-num "42")                    ;; ✅

;; #35 — 로그
(console.log x) / (log x)           ;; ❌
(println x)                          ;; ✅

;; #36 — 맵 키 목록
(json_keys m) / (object_keys m)     ;; ❌
(keys m)                             ;; ✅

;; #37 — 시간
(now-ms) / (Date.now) / (current_time_ms)  ;; ❌
(now_ms)                                    ;; ✅
(now_iso)                                   ;; ISO 8601 문자열

;; #38 — MariaDB
(mariadb_all db sql p)              ;; ❌ 미구현
(mariadb_query db sql p)            ;; ✅ 배열 반환
(mariadb_one db sql p)              ;; ✅ 단일 row

;; #39 — 맵 병합
(obj_merge a b) / (merge a b)      ;; ❌ 미구현
(assoc a "k" v)                     ;; ✅ 개별 키 추가

;; #40 — 맵 키 제거
(obj_omit m ["k"]) / (omit m "k")  ;; ❌
(dissoc m "k")                      ;; ✅

;; #41 — 맵 서브셋
(obj_pick m ["k"])                  ;; ❌ 미구현
(get m "k")                         ;; ✅ 개별 접근

;; #42 — 배열 길이
(count arr) / (size arr)            ;; ❌
(length arr)                        ;; ✅

;; #43 — 문자열 분리
(split str ",") / (str_split str ",")  ;; ❌
(str-split str ",")                    ;; ✅ (kebab or snake)

;; #44 — JSON 파싱
(JSON.parse s) / (parse_json s)    ;; ❌
(json_parse s)                      ;; ✅

;; #45 — JSON 직렬화
(JSON.stringify x)                  ;; ❌
(json_stringify x)                  ;; ✅
```

---

## 🔴 Category 7: HTTP 서버

```lisp
;; #46 — 핸들러 이름은 문자열
(server_get "/path" handle-fn)     ;; ❌ — 심볼로 전달
(server_get "/path" "handle-fn")   ;; ✅ — 문자열

;; #47 — URL 파라미터 추출
(server_req_params $req)           ;; ❌ — 맵 전체 반환 (단일 접근 아님)
(server_req_param  $req "id")      ;; ✅ — 단일 파라미터

;; #48 — body 파싱 (이미 JSON이면 바로 get)
(json_parse (server_req_body $req))           ;; Content-Type: application/json 이면 이미 파싱됨
(get (json_parse (server_req_body $req)) "k") ;; ✅ 문자열 body일 때

;; #49 — 서버 응답: 맵 직접 반환 안됨
(fn [$req] {:ok true})             ;; ❌ — 응답 함수 필요
(fn [$req] (server_json {:ok true}))  ;; ✅

;; #50 — server_status: status, body 순서
(server_status {:error "msg"} 400) ;; ❌
(server_status 400 {:error "msg"}) ;; ✅

;; #51 — 경로 파라미터 선언
(server_get "/users/id" "handler")        ;; ❌ — :id 없음
(server_get "/users/:id" "handler")       ;; ✅

;; #52 — express.fl + server_* 혼용
(load "src/express.fl")
(server_get "/path" "handler")     ;; ❌ — 혼용 금지
(app-get    "/path" "handler")     ;; ✅

;; #53 — WebSocket 핸들러 파라미터
(defn on-message [$req] ...)                ;; ❌ — WS는 ($sid $msg)
(defn on-message [$sid $msg] ...)           ;; ✅

;; #54 — on-close 파라미터
(defn on-close [$sid $code] ...)    ;; ❌ — code 파라미터 없음
(defn on-close [$sid] ...)          ;; ✅
```

---

## 🔴 Category 8: 데이터 타입

```lisp
;; #55 — nil 비교
(= x null) / (= x nil) / (null? x)  ;; ❌
(nil? x)                              ;; ✅

;; #56 — 맵 키: 키워드 필수
{name "kim" age 30}                  ;; ❌
{:name "kim" :age 30}                ;; ✅

;; #57 — 숫자 문자열 변환
(str 42)                             ;; ✅ → "42"
(str-to-num "42")                    ;; ✅ → 42
(num-to-str 42)                      ;; ❌ — (str 42) 사용

;; #58 — 불린 값
(= x true) (= x false)              ;; ✅ 일반적으로 OK
(not x)                              ;; ✅ nil/false 이외 모두 truthy

;; #59 — 0과 빈 문자열은 truthy (Lisp 표준)
(if 0 "yes" "no")   ;; → "yes" (JS와 다름!)
(if "" "yes" "no")  ;; → "yes"
(if nil "yes" "no") ;; → "no"
(if false "yes" "no") ;; → "no"

;; #60 — 배열 인덱스: 0-based
(get arr 1)   ;; 두 번째 요소 (첫 번째 아님)
(get arr 0)   ;; ✅ 첫 번째 요소
```

---

## 🔴 Category 9: 조건문

```lisp
;; #61 — if는 단일 식만
(if cond
  (do-a)
  (do-b))      ;; ❌ — else 없이 두 식 나열
(if cond (do-a) (do-b))  ;; ✅

;; #62 — 다중 분기: cond 사용
(if (= x 1) "하나"
  (if (= x 2) "둘" "기타"))        ;; △ 중첩 if (가독성 낮음)
(cond
  [(= x 1) "하나"]
  [(= x 2) "둘"]
  [true "기타"])                    ;; ✅

;; #63 — cond 기본값 키워드
(cond [(= x 1) "하나"] [:else "기타"])  ;; ❌
(cond [(= x 1) "하나"] [true  "기타"])  ;; ✅

;; #64 — and/or 반환값
(and true "hello")  ;; → "hello" (마지막 truthy 값 반환)
(or  nil  "default") ;; → "default"
(or  nil  0)         ;; → 0 (0은 truthy!)

;; #65 — 중첩 조건에서 do 블록
(if cond
  (stmt-a)
  (stmt-b)
  (stmt-c))                         ;; ❌ — if는 then/else 2개만
(if cond
  (do (stmt-a) (stmt-b))
  (stmt-c))                         ;; ✅
```

---

## 🔴 Category 10: 데이터베이스

```lisp
;; #66 — SQLite: db_query 반환은 배열
(get (db_query db sql []) "name")  ;; ❌ — 배열에서 get
(get (get (db_query db sql []) 0) "name")  ;; ✅ — 첫 행의 컬럼

;; #67 — MariaDB 연결 맵 형식
(mariadb_connect "localhost" "root" "" "db")  ;; ❌ — 맵 필요
(mariadb_connect {:host "localhost" :user "root" :password "" :database "db"})  ;; ✅

;; #68 — SQL 파라미터: 배열로
(mariadb_exec db "INSERT INTO t VALUES (?)" "val")  ;; ❌
(mariadb_exec db "INSERT INTO t VALUES (?)" ["val"]) ;; ✅

;; #69 — mariadb_one: 결과 없으면 nil
(get (mariadb_one db sql []) "id")  ;; ❌ — nil 처리 없음
(let [[$row (mariadb_one db sql [])]]
  (if $row (get $row "id") nil))     ;; ✅

;; #70 — KimDB URL 형식
(http_get "http://localhost:40000/api/v1/collections/col/docs")  ;; ❌
(http_get "http://localhost:40000/api/c/col")                     ;; ✅
```

---

## 🔴 Category 11: 파일 / 환경

```lisp
;; #71 — 파일 읽기: 없는 파일이면 에러
(file_read "path")                ;; 없으면 에러 발생
(if (file_exists "path") (file_read "path") "")  ;; ✅

;; #72 — 환경변수: .env 자동 로드 안됨
(shell_env "PORT")                ;; .env 미로드 시 null
(env_load ".env") (shell_env "PORT")  ;; ✅ — env_load 먼저

;; #73 — file_mkdir: 중간 디렉토리 자동 생성
(file_mkdir "a/b/c")              ;; ✅ — recursive 생성

;; #74 — shell_exec 반환 구조
(shell_exec "ls")                 ;; → {:stdout "..." :stderr "..." :code 0 :ok true}
(println (shell_exec "ls"))       ;; ❌ — 구조체 출력
(println (get (shell_exec "ls") "stdout"))  ;; ✅

;; #75 — file_append: 개행 수동 추가
(file_append "log.txt" "한 줄")   ;; ❌ — 개행 없음
(file_append "log.txt" "한 줄\n") ;; ✅
```

---

## 🔴 Category 12: 문자열

```lisp
;; #76 — str은 임의 타입 이어붙임
(str "hello" 42 true)             ;; ✅ → "hello42true"

;; #77 — str-length vs length
(length "hello")                  ;; ❌ — 배열 전용
(str-length "hello")              ;; ✅ → 5

;; #78 — str-trim
(trim "  hello  ")                ;; ❌
(str-trim "  hello  ")            ;; ✅

;; #79 — str-starts-with / str-ends-with
(starts-with? "hello" "he")       ;; ❌
(str-starts-with "hello" "he")    ;; ✅

;; #80 — 문자열 포함 확인
(includes "hello" "lo")           ;; ❌
(str-contains "hello" "lo")       ;; ✅

;; #81 — 대소문자
(to-upper "hello")                ;; ❌
(str-upper "hello")               ;; ✅
(str-lower "HELLO")               ;; ✅

;; #82 — 숫자→문자열
(toString 42)                     ;; ❌
(str 42)                          ;; ✅
```

---

## 🔴 Category 13: 배열

```lisp
;; #83 — append는 불변 (새 배열 반환)
(append arr x)                    ;; ✅ — 원본 불변, 새 배열 반환
(do (append arr x) arr)           ;; ❌ — 결과를 버림
(define arr2 (append arr x))      ;; ✅

;; #84 — 빈 배열 확인
(= arr [])                        ;; ❌ — 참조 비교
(= (length arr) 0)                ;; ✅

;; #85 — slice: start, end (end 미포함)
(slice arr 0 3)                   ;; → 인덱스 0,1,2 (3 미포함)

;; #86 — flatten: 중첩 배열 평탄화
(flatten [[1 2] [3 4]])           ;; → [1 2 3 4] ✅

;; #87 — zip: 두 배열 짝 맞추기
(zip [1 2 3] ["a" "b" "c"])       ;; → [[1 "a"] [2 "b"] [3 "c"]]

;; #88 — range: 끝 미포함
(range 0 5)                       ;; → [0 1 2 3 4] (5 미포함) ✅
```

---

## 🔴 Category 14: 에러 처리

```lisp
;; #89 — try-catch 문법
(try
  (risky-fn)
  (catch $e (println (str "에러: " $e))))  ;; ✅

;; #90 — error 발생
(throw "메시지")                  ;; ❌
(error "메시지")                  ;; ✅

;; #91 — error 반환값 접근
(let [[$e (try (error "fail") (catch $e $e))]]
  (get $e "message"))             ;; ✅

;; #92 — workflow 에러: on_error 반환값이 context에 반영
(workflow_step "s" fn {:on_error (fn [$e] {:fallback true})})
;; fallback true가 context에 병합됨
```

---

## 🔴 Category 15: 기타 주의

```lisp
;; #93 — load 경로: 실행 위치 기준
(load "src/express.fl")           ;; bootstrap.js 위치 기준 ✅

;; #94 — define은 재정의 불가 (새 바인딩 생성)
(define x 1)
(define x 2)   ;; 새 바인딩, 기존 x 참조하는 클로저는 1 유지

;; #95 — do 블록의 반환값
(do (+ 1 2) (+ 3 4))             ;; → 7 (마지막 식)

;; #96 — 심볼 vs 문자열
(define name "kim")
(println name)                    ;; → "kim" ✅
(println "name")                  ;; → "name" (변수 접근 아님)

;; #97 — json_stringify: 맵/배열 → 문자열
(json_stringify {:a 1})           ;; → "{\"a\":1}" ✅
(str {:a 1})                      ;; ❌ — "[object Object]" 같은 결과

;; #98 — 재귀 깊이: 스택 오버플로우 주의
;; 큰 데이터는 reduce/loop 사용, 재귀 깊이 100 이하 권장

;; #99 — server_start는 블로킹
;; server_start 이후 코드 실행 안됨 — 항상 마지막에 호출
(server_get "/path" "handler")
(println "이 줄은 실행됨")
(server_start 3000)
(println "이 줄은 실행 안됨")    ;; ❌

;; #100 — (or nil 0)은 0 반환 (0이 falsy 아님)
(or nil 0)    ;; → 0  (nil만 falsy)
(or nil false) ;; → false
(or nil nil)  ;; → nil
;; JS와 다름: JS에서 (0 || "default") → "default"
;; FL에서 (or 0 "default") → 0
```

---

## 📋 빠른 치트시트

| 자주 쓰는 패턴 | 올바른 코드 |
|--------------|------------|
| 배열 변환 | `(map (fn [$x] (* $x 2)) arr)` |
| 배열 필터 | `(filter (fn [$x] (> $x 0)) arr)` |
| 배열 합계 | `(reduce + 0 arr)` |
| HTTP GET+파싱 | `(json_parse (get (http_get url) "body"))` |
| 전역 상태 | `(define s (atom {}))` + `(swap! s assoc "k" v)` |
| nil 체크 | `(nil? x)` |
| 환경변수 | `(shell_env "KEY")` |
| 서버 시작 | 마지막 줄에 `(server_start PORT)` |
| 에러 발생 | `(error "메시지")` |
| 조건 기본값 | `(cond [...] [true "기본값"])` |
