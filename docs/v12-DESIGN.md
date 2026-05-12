# FreeLang v12 설계 문서

> **버전**: Draft 0.2 | **작성**: 2026-05-12  
> **근거**: MISTAKES-100 분석 + v11.6.x 운영 경험

---

## 1. 배경

Phase H~I 작업으로 MISTAKES-100 86%를 달성했으나, 남은 13개 항목은 모두 `[design]` 타입입니다.  
v11에서 안전하게 고칠 수 없는 근본 설계 결함이며, v12에서 **Breaking Change**로 해결합니다.

---

## 2. Breaking Changes 카테고리

### A. 컬렉션 인자 순서 통일 (#5, #6, #9)

**현재 혼동 패턴:**

```lisp
;; assoc/dissoc/get은 map-first지만 일부 사용자가 역순으로 호출
(assoc "key" {} "val")    ;; ❌ — 타입 에러지만 메시지 불명확
(get "key" {})            ;; ❌ — 마찬가지
```

**v12 조치:** 잘못된 인자 타입 시 명확한 시그니처 힌트 에러

```lisp
;; v12 에러 예시
(assoc "key" {} "val")
;; → [v12] assoc: 첫 번째 인자는 map이어야 합니다.
;;          올바른 형식: (assoc map key val)
;;          예: (assoc {:a 1} "b" 2) → {:a 1 :b 2}
```

**자동 변환:** 가능 (코드모드로 첫 번째 인자 타입 추론 후 교환)

---

### B. HTTP API 통일 (#47, #48, #49, #50, #52)

**현재 문제점:**

```lisp
;; #47: req 파라미터 접근 두 가지 방법 혼재
(get (get req "params") "id")       ;; 방법 1 — 저수준
(server_req_param req "id")         ;; 방법 2 — 권장

;; #48: body 자동 파싱 비일관 (JSON만 자동, form은 수동)

;; #49: 응답 맵 직접 반환 불가
(fn [req] {:status 200 :body "ok"}) ;; ❌ 동작 안 함
(fn [req] (server-json {:ok true})) ;; ✅

;; #50: server_status 인자 순서 혼동 (code vs message 순서)
(server_status "Not found" 404)     ;; ❌ 역순
(server_status 404 "Not found")     ;; ✅

;; #52: express.fl + server_* 혼용 → 조용히 오작동
```

**v12 설계:**

```lisp
;; B-1: req 접근 req-* 패밀리로 통일
(req-param  req "id")
(req-query  req "page")
(req-body   req)              ;; JSON/form 자동 파싱 맵
(req-header req "Authorization")

;; B-2: 핸들러가 맵 반환 허용
(defn handler [req]
  {:status 200
   :headers {"Content-Type" "application/json"}
   :body {:ok true}})         ;; v12: body 자동 JSON 직렬화

;; B-3: server-status 인자 순서 강제 검증
(server-status 404 "Not found")    ;; code → body 순서만 허용
;; 역순 감지: (server-status "Not found" 404) → 에러 + 힌트

;; B-4: FL_V12=1에서 express.fl + server_* 혼용 즉시 에러
```

**마이그레이션:** `server_status` 역순은 자동 변환 가능.

---

### C. 전역 상태 → atom 강제 (#16, #17, #18, #19, #20, #94)

**v12-alpha에서 구현 완료** (2026-05-12):

| # | 변경 | 상태 |
|---|------|------|
| #19 | `@varname` → `(deref varname)` lexer 변환 | ✅ 완료 |
| #16 | `FL_V12=1`: define 재정의 → 에러 + atom 안내 | ✅ 완료 |
| #17/#18 | `FL_V12=1`: `set!` → 에러 + swap!/reset! 안내 | ✅ 완료 |
| #20 | `swap!` extra args 지원 확인 | ✅ 완료 |
| #94 | atom 클로저 참조 캡처 테스트 확인 | ✅ 완료 |

```lisp
;; v12 표준 가변 상태 패턴
(define count (atom 0))
(defn inc-count! [] (swap! count + 1))
(inc-count!)
@count  ;; → 1
```

---

### D. DB / WebSocket / HTTP 시그니처 (#15, #53, #54, #67)

**현재 문제:**

```lisp
;; #15: http_post — body를 JSON 문자열로 직접 전달 필요
(http_post url {:name "kim"})                     ;; ❌ 에러 없이 오작동
(http_post url (json-stringify {:name "kim"}))    ;; ✅ 올바른 방식

;; #67: mariadb_connect — map 방식만 허용
(mariadb_connect "host" "user" "pw" "db")         ;; ❌ positional 불가

;; #53/#54: WS 핸들러 시그니처 불명확
(ws-handler "/ws" (fn [msg] ...))                  ;; msg 구조 불명확
(ws-on-close (fn [] ...))                          ;; code/reason 없음
```

**v12 설계:**

```lisp
;; D-1: http-post map → JSON 자동 직렬화
(http-post url {:name "kim"})     ;; v12: map 직접 허용

;; D-2: mariadb-connect positional 지원
(mariadb-connect "localhost" "root" "pass" "mydb")   ;; positional
(mariadb-connect {:host "..." :user "..."})           ;; map 방식 유지

;; D-3: WS 핸들러 구조화
(ws-handler "/ws"
  {:on-message (fn [conn msg] ...)
   :on-close   (fn [conn code reason] ...)
   :on-error   (fn [conn err] ...)})
```

---

### E. 기타 (#99, #51)

```lisp
;; #99: server-start 블로킹 — 이후 코드 실행 안 됨
;; v12: 비블로킹 옵션 추가
(server-start 3000)                    ;; 블로킹 (기존 동작 유지)
(server-start 3000 {:async true})      ;; v12: 비블로킹

;; #51: 경로 :id 파라미터 → 핸들러 자동 주입
;; v12: 핸들러 두 번째 인자로 params 자동 전달
(defn get-user [req params]
  (let [id (get params "id")]
    (server-json {:id id})))
```

---

## 3. 마이그레이션 전략

### 자동 변환 가능 (코드모드 예정)

| 패턴 | 변환 |
|------|------|
| `(set! x v)` | `(reset! x v)` |
| `(define x v)\n(define x v2)` | atom 패턴 변환 |
| `(http_post url (json-stringify body))` | `(http-post url body)` |
| `(server_status msg code)` | `(server-status code msg)` (역순 감지 시) |

### 수동 변환 필요

- WS 핸들러 시그니처 재작성
- express.fl ↔ server_* 혼용 코드 분리
- 응답 맵 패턴 도입 여부 결정

---

## 4. 활성화 전략

```
v11 (현재)       경고만 출력 (console.warn)
FL_V12=1         Breaking Changes 에러 활성화
v12.0.0 릴리스   FL_V12=1 기본값 / FL_V11_COMPAT=1으로 구버전 허용
v12.1.0 이후     FL_V11_COMPAT 제거
```

---

## 5. 타임라인

| 마일스톤 | 내용 | 일정 |
|----------|------|------|
| v12-alpha | C 카테고리 완료 (@atom, define, set!) | ✅ 2026-05-12 |
| v12-beta | A+B+D 에러힌트, 코드모드 초안 | 2026-05 |
| v12.0.0 RC | 전체 Breaking Changes + 마이그레이션 가이드 | 2026-06 |
| v12.0.0 | 공식 릴리스, FL_V12=1 기본값 | 2026-07 |

---

## 6. 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lexer.ts` | @atom deref 변환 (#19) |
| `src/eval-special-forms.ts` | define/set! FL_V12 체크 (#16/#17/#18) |
| `src/eval-builtins.ts` | 내장 함수 타입 힌트 에러 (#5/#6/#9) |
| `src/__tests__/v12-alpha.test.ts` | v12 Alpha 테스트 21개 |
| `docs/_classifications.json` | MISTAKES-100 분류 (86% 달성) |
| `feature/v12-alpha` | 구현 브랜치 (Gogs 배포 완료) |
