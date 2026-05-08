# FreeLang v11 — 언어 디자인 결함 (44개)

> *사용자가 실수하는 게 아니라 언어가 일관성 없게 만들어졌다.*
> 원래 Phase X (v11.5.x) 대상이었으나, v11.6.x 기준 대부분 **현행 유지** 결정.
> 각 항목에 현재 구현 상태와 실제 올바른 사용법이 명시됨.

관련 문서:
- `MISTAKES.md` — 진짜 사용자 실수
- `LEARNING.md` — Lisp 학습 자료
- `ROADMAP.md` Phase X — v11.5.x 통일 계획

---

## 🔧 분류

| 분류 | 개수 | 핵심 문제 |
|-----|------|----------|
| 인자 순서 | 10 | fn-first vs col-first vs key-first 혼재 |
| HTTP API | 10 | 반환 구조체 vs 직접 / 시그니처 비일관 |
| 상태 관리 | 5  | atom 의무화 / set! 클로저 미반영 |
| 함수 선언 | 4  | $ 접두사 / [FUNC] deprecated |
| 작명 비일관 | 5 | kebab vs snake / suffix `?` 임의 |
| 데이터 타입 | 3 | 키워드 키 강제 / 깊은 동등성 미지원 |
| 기타 | 7 | (str map) → "[object]" 등 |
| **합계** | **44** | — |

---

## 모든 항목 (44개)

각 항목의 **fix**는 v11.5.x Phase X 작업 항목.

### #1 — map: fn 먼저 (현재 구현 = fn-first, 변경 없음)

```lisp
;; #1 — map: fn 먼저, 배열 나중
(map [1 2 3] fn)            ;; ❌ arr-first (잘못된 사용)
(map fn [1 2 3])            ;; ✅ fn-first (현재 표준)
```

**현재 구현**: `eval-builtins.ts` args[0]=fn, args[1]=arr — fn-first 고정.  
**v11.5.x 논의**: 컬렉션-first(arr-first)로 변경 검토됐으나 **미채택** (v11.6.11 기준).  
**결론**: `(map fn arr)` 가 올바른 현행 문법.

### #2 — filter: fn 먼저 (현재 구현 = fn-first, 변경 없음)

```lisp
;; #2 — filter: fn 먼저
(filter arr fn)             ;; ❌ arr-first (잘못된 사용)
(filter fn arr)             ;; ✅ fn-first (현재 표준)
```

**현재 구현**: `eval-builtins.ts` args[0]=fn, args[1]=arr — fn-first 고정 (주석 "fn-first 고정" 명시).  
**v11.5.x 논의**: arr-first 변경 검토됐으나 **미채택**.  
**결론**: `(filter fn arr)` 가 올바른 현행 문법.

### #3 — reduce: fn,init,arr (현재 구현 = fn-first, 변경 없음)

```lisp
;; #3 — reduce: fn 먼저, 초기값 두 번째
(reduce arr init fn)        ;; ❌ arr-first (잘못된 사용)
(reduce fn init arr)        ;; ✅ fn-first (현재 표준)
```

**현재 구현**: `eval-builtins.ts` args[0]=fn, args[1]=init, args[2]=arr — fn-first 고정 (주석 명시).  
**v11.5.x 논의**: arr-first 변경 검토됐으나 **미채택**.  
**결론**: `(reduce fn init arr)` 가 올바른 현행 문법.

### #4 — sort-by: fn 먼저 (현재 구현 = fn-first, 변경 없음)

```lisp
;; #4 — sort-by: fn 먼저
(sort-by arr key-fn)        ;; ❌ arr-first (잘못된 사용)
(sort-by key-fn arr)        ;; ✅ fn-first (현재 표준)
```

**현재 구현**: `eval-builtins.ts` args[0]=keyfn, args[1]=arr — fn-first 고정.  
**v11.5.x 논의**: arr-first 변경 검토됐으나 **미채택**.  
**결론**: `(sort-by keyfn arr)` 가 올바른 현행 문법.

### #5 — assoc: map 먼저 (그러나 다른 함수와 다름)

```lisp
;; #5 — assoc: map, key, value 순서
(assoc "key" "val" m)       ;; ❌
(assoc m "key" "val")       ;; ✅
```

**v11.5.x fix**: v11.5.x: 컬렉션 first 통일

### #6 — dissoc: map 먼저

```lisp
;; #6 — dissoc: map 먼저
(dissoc "key" m)            ;; ❌
(dissoc m "key")            ;; ✅
```

**v11.5.x fix**: v11.5.x: 통일됨 (이미 일관)

### #7 — str-contains 인자 순서

```lisp
;; #7 — str-contains: 문자열, 패턴 순서
(str-contains "lo" "hello") ;; ❌
(str-contains "hello" "lo") ;; ✅
```

**v11.5.x fix**: v11.5.x: (str-contains s pattern) 통일

### #8 — str-replace 인자 순서

```lisp
;; #8 — str-replace: str, from, to 순서
(str-replace "new" "old" s) ;; ❌
(str-replace s "old" "new") ;; ✅
```

**v11.5.x fix**: v11.5.x: (str-replace s old new) 통일

### #9 — get: map 먼저

```lisp
;; #9 — get: map 먼저, key 나중
(get "name" m)              ;; ❌
(get m "name")              ;; ✅
```

**v11.5.x fix**: v11.5.x: 통일됨

### #10 — cache_set 인자 순서

```lisp
;; #10 — cache_set: key, value, ttl 순서
(cache_set val key ttl)     ;; ❌
(cache_set key val ttl)     ;; ✅
```

**v11.5.x fix**: v11.5.x: (cache-set k v ttl) 통일

### #11 — http_get 반환 구조체

```lisp
;; #11 — http_get 반환: 구조체, body 직접 아님
(json_parse (http_get url))                     ;; ❌ — 구조체 파싱 시도
(json_parse (get (http_get url) "body"))        ;; ✅
```

**v11.5.x fix**: v11.5.x: http-get-json 표준화

### #12 — http_post 반환 구조체

```lisp
;; #12 — http_post 반환: 동일
(json_parse (http_post url body))               ;; ❌
(json_parse (get (http_post url body) "body"))  ;; ✅
```

**v11.5.x fix**: v11.5.x: 동일

### #13 — http_get status 추출

```lisp
;; #13 — http_get 상태코드 확인
(= (http_get url) 200)                          ;; ❌ — 구조체와 비교 불가
(= (get (http_get url) "status") 200)           ;; ✅
```

**v11.5.x fix**: v11.5.x: http-status 표준화

### #15 — http_post body 문자열 강제

```lisp
;; #15 — http_post body는 문자열
(http_post url {:data item})                    ;; ❌ — 맵 직접 전달
(http_post url (json_stringify {:data item}))   ;; ✅
```

**v11.5.x fix**: v11.5.x: 자동 JSON 인코딩

### #16 — define 재정의 안 됨

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
```

**v11.5.x fix**: v11.5.x: atom 명시 또는 mut 키워드

### #17 — set! 클로저 미반영

```lisp
;; #17 — 맵 전역 상태 변경
(define state {})
(set! state (assoc state "k" "v"))  ;; ❌ — 전역 미반영

(define state (atom {}))
(swap! state assoc "k" "v")         ;; ✅
```

**v11.5.x fix**: v11.5.x: atom 강제 또는 명확한 에러

### #18 — 전역 배열 set! 미반영

```lisp
;; #18 — 배열 전역 상태 append
(define items [])
(set! items (append items [x]))     ;; ❌

(define items (atom []))
(swap! items (fn [$a] (append $a [x])))  ;; ✅
```

**v11.5.x fix**: v11.5.x: 동일

### #19 — deref 누락

```lisp
;; #19 — deref 누락
(get state "key")                   ;; ❌ — atom을 바로 get
(get (deref state) "key")           ;; ✅
```

**v11.5.x fix**: v11.5.x: atom 자동 deref 옵션

### #20 — swap! fn 인자 누락

```lisp
;; #20 — swap! fn 인자
(swap! ref (fn [] new-val))         ;; ❌ — 현재값 인자 누락
(swap! ref (fn [$cur] new-val))     ;; ✅
```

**v11.5.x fix**: v11.5.x: arity 검사

### #21 — v10 let 형식 (단일 괄호)

```lisp
;; #21 — v10 let (동작 안 함)
(let [x 1 y 2] (+ x y))            ;; ❌
```

**v11.5.x fix**: v11.5.x: 단일 괄호 허용

### #23 — 단일 바인딩도 이중 괄호

```lisp
;; #23 — 단일 바인딩도 이중 괄호
(let [$x 1] $x)                    ;; ❌
(let [[$x 1]] $x)                  ;; ✅
```

**v11.5.x fix**: v11.5.x: 단일은 [$x val] 허용

### #26 — [FUNC] deprecated

```lisp
;; #26 — v10 [FUNC] 문법 v11에서 동작 안 함
[FUNC add :params [a b] :body (+ a b)]  ;; ❌
```

**v11.5.x fix**: v11.5.x: 완전 제거 + migrate 자동 변환

### #28 — $ 파라미터 누락

```lisp
;; #28 — $ 파라미터 누락
(defn add [a b] (+ a b))           ;; ❌ — a가 정의되지 않은 심볼
(defn add [$a $b] (+ $a $b))       ;; ✅
```

**v11.5.x fix**: v11.5.x: $ 접두사 폐지 검토 (또는 자동 추가)

### #29 — fn $ 누락

```lisp
;; #29 — 익명 함수 fn
(fn [x] (* x 2))                   ;; ❌
(fn [$x] (* $x 2))                 ;; ✅
```

**v11.5.x fix**: v11.5.x: 동일

### #31 — 고차함수 + $ 누락 복합

```lisp
;; #31 — 고차 함수에 익명 함수 전달
(map [1 2 3] (fn [x] (* x 2)))     ;; ❌ — 인자 순서 + $ 누락
(map (fn [$x] (* $x 2)) [1 2 3])   ;; ✅
```

**v11.5.x fix**: v11.5.x: 인자 순서 + $ 통일

### #39 — obj_merge / merge — assoc은 단일 키만

```lisp
;; #39 — 맵 병합
(obj_merge a b) / (merge a b)      ;; ❌ 미구현
(assoc a "k" v)                     ;; ✅ 개별 키 추가
```

**v11.5.x fix**: v11.5.x: merge 함수 추가

### #46 — 핸들러 문자열 vs 함수

```lisp
;; #46 — 핸들러 이름은 문자열
(server_get "/path" handle-fn)     ;; ❌ — 심볼로 전달
(server_get "/path" "handle-fn")   ;; ✅ — 문자열
```

**v11.5.x fix**: v11.5.x: 함수 직접 허용

### #47 — server_req_param vs params

```lisp
;; #47 — URL 파라미터 추출
(server_req_params $req)           ;; ❌ — 맵 전체 반환 (단일 접근 아님)
(server_req_param  $req "id")      ;; ✅ — 단일 파라미터
```

**v11.5.x fix**: v11.5.x: API 통일

### #48 — body 자동 파싱 비일관

```lisp
;; #48 — body 파싱 (이미 JSON이면 바로 get)
(json_parse (server_req_body $req))           ;; Content-Type: application/json 이면 이미 파싱됨
(get (json_parse (server_req_body $req)) "k") ;; ✅ 문자열 body일 때
```

**v11.5.x fix**: v11.5.x: Content-Type 기반 자동

### #49 — 응답 맵 직접 반환 안됨

```lisp
;; #49 — 서버 응답: 맵 직접 반환 안됨
(fn [$req] {:ok true})             ;; ❌ — 응답 함수 필요
(fn [$req] (server_json {:ok true}))  ;; ✅
```

**v11.5.x fix**: v11.5.x: 자동 server_json wrap

### #50 — server_status 인자 순서

```lisp
;; #50 — server_status: status, body 순서
(server_status {:error "msg"} 400) ;; ❌
(server_status 400 {:error "msg"}) ;; ✅
```

**v11.5.x fix**: v11.5.x: (server-status code body) 통일

### #52 — express + server_* 혼용

```lisp
;; #52 — express.fl + server_* 혼용
(load "src/express.fl")
(server_get "/path" "handler")     ;; ❌ — 혼용 금지
(app-get    "/path" "handler")     ;; ✅
```

**v11.5.x fix**: v11.5.x: 단일 API

### #53 — WS 핸들러 시그니처

```lisp
;; #53 — WebSocket 핸들러 파라미터
(defn on-message [$req] ...)                ;; ❌ — WS는 ($sid $msg)
(defn on-message [$sid $msg] ...)           ;; ✅
```

**v11.5.x fix**: v11.5.x: 표준화

### #54 — on-close 파라미터 시그니처

```lisp
;; #54 — on-close 파라미터
(defn on-close [$sid $code] ...)    ;; ❌ — code 파라미터 없음
(defn on-close [$sid] ...)          ;; ✅
```

**v11.5.x fix**: v11.5.x: 표준화

### #56 — 맵 키 키워드 필수

```lisp
;; #56 — 맵 키: 키워드 필수
{name "kim" age 30}                  ;; ❌
{:name "kim" :age 30}                ;; ✅
```

**v11.5.x fix**: v11.5.x: 문자열 키 자동 변환

### #63 — cond [:else ...] 미지원

```lisp
;; #63 — cond 기본값 키워드
(cond [(= x 1) "하나"] [:else "기타"])  ;; ❌
(cond [(= x 1) "하나"] [true  "기타"])  ;; ✅
```

**v11.5.x fix**: v11.5.x: :else 키워드 허용

### #66 — db_query 배열 반환 구조

```lisp
;; #66 — SQLite: db_query 반환은 배열
(get (db_query db sql []) "name")  ;; ❌ — 배열에서 get
(get (get (db_query db sql []) 0) "name")  ;; ✅ — 첫 행의 컬럼
```

**v11.5.x fix**: v11.5.x: db-query-one 표준화

### #67 — mariadb_connect 시그니처 다름

```lisp
;; #67 — MariaDB 연결 맵 형식
(mariadb_connect "localhost" "root" "" "db")  ;; ❌ — 맵 필요
(mariadb_connect {:host "localhost" :user "root" :password "" :database "db"})  ;; ✅
```

**v11.5.x fix**: v11.5.x: positional + map 둘다 지원

### #68 — SQL 파라미터 배열 강제

```lisp
;; #68 — SQL 파라미터: 배열로
(mariadb_exec db "INSERT INTO t VALUES (?)" "val")  ;; ❌
(mariadb_exec db "INSERT INTO t VALUES (?)" ["val"]) ;; ✅
```

**v11.5.x fix**: v11.5.x: 단일 값도 자동 배열화

### #72 — env_load 자동 호출 안됨

```lisp
;; #72 — 환경변수: .env 자동 로드 안됨
(shell_env "PORT")                ;; .env 미로드 시 null
(env_load ".env") (shell_env "PORT")  ;; ✅ — env_load 먼저
```

**v11.5.x fix**: v11.5.x: 시작 시 자동 .env 로드

### #74 — shell_exec 반환 구조체

```lisp
;; #74 — shell_exec 반환 구조
(shell_exec "ls")                 ;; → {:stdout "..." :stderr "..." :code 0 :ok true}
(println (shell_exec "ls"))       ;; ❌ — 구조체 출력
(println (get (shell_exec "ls") "stdout"))  ;; ✅
```

**v11.5.x fix**: v11.5.x: shell-exec-stdout 추가

### #84 — (= arr []) 참조 비교

```lisp
;; #84 — 빈 배열 확인
(= arr [])                        ;; ❌ — 참조 비교
(= (length arr) 0)                ;; ✅
```

**v11.5.x fix**: v11.5.x: 깊은 동등성 = 기본

### #94 — define 재정의 클로저 미반영

```lisp
;; #94 — define은 재정의 불가 (새 바인딩 생성)
(define x 1)
(define x 2)   ;; 새 바인딩, 기존 x 참조하는 클로저는 1 유지
```

**v11.5.x fix**: v11.5.x: 명확한 에러

### #97 — (str map) 결과 "[object Object]"

```lisp
;; #97 — json_stringify: 맵/배열 → 문자열
(json_stringify {:a 1})           ;; → "{\"a\":1}" ✅
(str {:a 1})                      ;; ❌ — "[object Object]" 같은 결과
```

**v11.5.x fix**: v11.5.x: str가 자동 JSON

---

### LIR-002 — assoc/dissoc 키워드 키 불일치 (v11.6.0 수정)

```lisp
;; ❌ 수정 전: assoc에 :key 사용 시 콜론 포함 저장 → get으로 접근 불가
(define m (assoc {} :name "Kim"))
(get m "name")   ;; → nil  ← 버그

;; ✅ v11.6.0: assoc/dissoc 키 정규화 적용
(define m (assoc {} :name "Kim"))
(get m "name")   ;; → "Kim" ✅
(get m :name)    ;; → "Kim" ✅

;; map 리터럴은 이미 정규화됨 (영향 없음)
(get {:name "Kim"} "name")  ;; → "Kim" ✅ (기존)
```

**원인**: `assoc`/`dissoc`에 키 정규화 누락. `get`은 이미 정규화됨.  
**수정**: `eval-builtins.ts` assoc/dissoc 케이스에 `:key → "key"` 정규화 추가.  
**v11.6.0 fix**: assoc, dissoc 모두 정규화 적용.

---

### LIR-005 — cond :else 브래킷/플랫 모드 미지원 (v11.6.2 수정)

```lisp
;; ❌ 수정 전: [else ...] / [:else ...] 브래킷에서 else 변수 조회 → null
(cond [(= x 1) "one"] [:else "other"])  ;; → nil (버그)

;; ✅ v11.6.2: :else / else 명시적 감지
(cond [(= x 1) "one"] [:else "other"])  ;; → "other" ✅
(cond [(= x 1) "one"] [else "other"])   ;; → "other" ✅
(cond (= x 1) "one" :else "other")     ;; → "other" ✅ (flat-pair)
(cond (= x 1) "one" else "other")      ;; → "other" ✅ (flat-pair)

;; paren 형식은 이미 지원 (변경 없음)
(cond (false "one") (else "other"))     ;; → "other" ✅ (기존)
```

**원인**: bracketed 모드에서 `items[0]`을 무조건 변수 조회 → `$else` 미정의.  
**수정**: `eval-special-forms.ts:evalCond` — `isElse` 감지 후 `{kind:"literal", value:true}` 대체.  
**v11.6.2 fix**: bracketed + flat-pair 모드 모두 `:else` / `else` catch-all 지원.
