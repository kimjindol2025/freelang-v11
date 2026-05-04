# FreeLang v11 — 진짜 실수 모음

> 사용자/AI가 *진짜로 잘못 쓰는* 항목. 28개.
> v11.4.2 기준 28개 중 20개 ALIAS hint로 자동 처리됨.

관련 문서:
- `LEARNING.md` — Lisp/FreeLang 학습 (실수 아님, 25개)
- `LANGUAGE-FAULTS.md` — 언어 디자인 결함 (44개, v11.5.x fix 대상)
- `MISTAKES-COVERAGE.json` — 자동 처리 카운트

---

## 💀 진짜 부주의 (3개)

코드 작성자가 명백히 실수한 경우.

### #51 — 경로 :id 파라미터 누락

```lisp
;; #51 — 경로 파라미터 선언
(server_get "/users/id" "handler")        ;; ❌ — :id 없음
(server_get "/users/:id" "handler")       ;; ✅
```

### #75 — file_append 개행 누락

```lisp
;; #75 — file_append: 개행 수동 추가
(file_append "log.txt" "한 줄")   ;; ❌ — 개행 없음
(file_append "log.txt" "한 줄\n") ;; ✅
```

### #99 — server_start 블로킹

```lisp
;; #99 — server_start는 블로킹
;; server_start 이후 코드 실행 안됨 — 항상 마지막에 호출
(server_get "/path" "handler")
(println "이 줄은 실행됨")
(server_start 3000)
(println "이 줄은 실행 안됨")    ;; ❌
```

---

## 💡 다른 언어 습관 (20개)

AI/사용자가 다른 언어 습관으로 잘못된 함수명을 쓰는 경우. **모두 ALIAS hint 자동 처리됨**.

| # | 잘못된 호출 | 올바른 호출 | 출처 |
|---|------------|------------|------|
| #32 | env / get_env (다른 언어 습관) | ALIAS 처리 | ALIAS 처리됨 |
| #33 | server_listen / server_run | ALIAS 처리 | ALIAS 처리됨 |
| #34 | str-to-int / parseInt | ALIAS 처리 | ALIAS 처리됨 |
| #35 | console.log / log | ALIAS 처리 | ALIAS 처리됨 |
| #37 | now-ms / Date.now | ALIAS 처리 | ALIAS 처리됨 |
| #38 | mariadb_all / db_query | ALIAS 처리 | ALIAS 처리됨 |
| #40 | obj_omit / omit | ALIAS 처리 | ALIAS 처리됨 |
| #41 | obj_pick | ALIAS 처리 | ALIAS 처리됨 |
| #42 | count / size | ALIAS 처리 | ALIAS 처리됨 |
| #43 | split / str_split | ALIAS 처리 | ALIAS 처리됨 |
| #44 | JSON.parse / parse_json | ALIAS 처리 | ALIAS 처리됨 |
| #45 | JSON.stringify | ALIAS 처리 | ALIAS 처리됨 |
| #55 | (= x null) / null? — nil?로 통일 | ALIAS 처리 | ALIAS 처리됨 |
| #57 | num-to-str — (str) | ALIAS 처리 | ALIAS 처리됨 |
| #78 | trim — str-trim | ALIAS 처리 | ALIAS 처리됨 |
| #79 | starts-with? — str-starts-with | ALIAS 처리 | ALIAS 처리됨 |
| #80 | includes — str-contains | ALIAS 처리 | ALIAS 처리됨 |
| #81 | to-upper — str-upper | ALIAS 처리 | ALIAS 처리됨 |
| #82 | toString — str | ALIAS 처리 | ALIAS 처리됨 |
| #90 | throw — error | ALIAS 처리 | ALIAS 처리됨 |

→ `freelang-smart`로 실행하면 자동 hint.

---

## 🚧 언어 미구현 (5개)

기능 자체가 미구현이라 *대안*을 알아야 하는 경우. Phase Y 대상.

### #14 — http_get_key 미구현

```lisp
;; #14 — http_get_key / http_post_key (API Key 인증)
(http_get url)                                  ;; ❌ — API Key 서버에 401
(http_get_key url api-key)                      ;; ✅
```

**Fix**: Phase Y: API Key 인증 구현

### #69 — mariadb_one nil 자동 처리 미지원

```lisp
;; #69 — mariadb_one: 결과 없으면 nil
(get (mariadb_one db sql []) "id")  ;; ❌ — nil 처리 없음
(let [[$row (mariadb_one db sql [])]]
  (if $row (get $row "id") nil))     ;; ✅
```

**Fix**: Phase Y: 안전 접근자

### #71 — file_read 없는 파일 → 에러

```lisp
;; #71 — 파일 읽기: 없는 파일이면 에러
(file_read "path")                ;; 없으면 에러 발생
(if (file_exists "path") (file_read "path") "")  ;; ✅
```

**Fix**: Phase Y: file-read-or 추가

### #89 — try-catch 구문 미작동

```lisp
;; #89 — try-catch 문법
(try
  (risky-fn)
  (catch $e (println (str "에러: " $e))))  ;; ✅
```

**Fix**: Phase Y: try-catch 완전 구현

### #91 — 에러 객체 구조 접근

```lisp
;; #91 — error 반환값 접근
(let [[$e (try (error "fail") (catch $e $e))]]
  (get $e "message"))             ;; ✅
```

**Fix**: Phase Y: error 메타
