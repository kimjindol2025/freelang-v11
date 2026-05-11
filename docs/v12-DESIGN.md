# FreeLang v12 — Breaking Changes 설계 문서

**작성일**: 2026-05-11  
**상태**: 초안 (Phase I-4)  
**기반**: Phase H MISTAKES-100 분석 — 남은 19개 [design] 항목

---

## 배경

FreeLang v11에서 MISTAKES-100 커버리지 81%를 달성했으나, 나머지 19개는 v11에서 안전하게 수정 불가한 **semantics 재설계** 이슈입니다. v12에서 Breaking Change로 해결합니다.

---

## 카테고리 분류

### A. 인자 순서 통일 (컬렉션-first)

현재 v11: 함수-first (`(map fn coll)`, `(get map key)`)  
v12 방향: 컬렉션-first (`(map coll fn)`, `(get key coll)`)

| # | 함수 | v11 | v12 |
|---|------|-----|-----|
| #5  | assoc | `(assoc map key val)` | `(assoc key val map)` — 파이프 친화적 |
| #6  | dissoc | `(dissoc map key)` | `(dissoc key map)` |
| #9  | get | `(get map key)` | `(get key map)` |

**마이그레이션**: 코드 자동 변환 가능 (2-인자 패턴 감지 후 swap)  
**위험도**: 높음 — 기존 코드 전수 수정 필요

> **설계 결정**: v12 alpha에서 `(assoc-v12 key val map)` alias 제공 → 점진적 이관

---

### B. HTTP API 표준화

v11 혼용 상태: `req["params"]["id"]` vs `server_req_param` vs `app-param`

| # | 항목 | v11 문제 | v12 표준 |
|---|------|---------|---------|
| #47 | req_param | 직접 맵 접근 허용 | `req-param` 단일 진입점 강제 |
| #48 | body 파싱 | 수동 json-parse 필요 | 핸들러 첫 인자에 자동 파싱 보장 |
| #49 | 응답 맵 | server_json/server_html 분리 | `respond` 단일 함수 (content-type 추론) |
| #50 | status 순서 | `(server-status code body)` | `(respond body :status 404)` 키워드 옵션 |
| #52 | express 혼용 | server_* + app-* 혼재 | 단일 라우터 API |

**마이그레이션**: 코드 자동 변환 가능성 낮음 — 수동 검토 필요  
**위험도**: 높음 — 모든 웹 앱 영향

> **설계 결정**: v12 HTTP 핸들러 시그니처 변경
> ```lisp
> ;; v11
> (defn handler [req] (server-json {:ok true}))
>
> ;; v12
> (defn handler [req] (respond {:ok true}))
> ;; respond는 맵 → JSON, 문자열 → HTML 자동 추론
> ```

---

### C. 전역 상태 — atom 강제

v11: `define` + `set!` 가변 전역 허용 (클로저 미전파 버그 있음)

| # | 항목 | v11 문제 | v12 표준 |
|---|------|---------|---------|
| #16 | define 재정의 | 경고만 출력, 동작은 허용 | 재정의 에러 (atom 사용 강제) |
| #17 | set! 클로저 | 클로저에 미전파 | set! 완전 제거, atom/swap! 전용 |
| #18 | set! 다중 참조 | 참조 일관성 없음 | atom으로 통일 |
| #19 | deref 미지원 | `@atom` 문법 없음 | `@atom` = `(deref atom)` 문법 지원 |
| #20 | swap! 타입 | swap!이 함수 인자 무시 | `(swap! a + 1)` 완전 지원 |
| #94 | 클로저 캡처 | 가변 변수 캡처 시 참조가 아닌 값 | atom은 참조로 캡처 보장 |

**마이그레이션**: 반자동 — `define x val` + `set! x` 패턴을 `define x (atom val)` + `swap!`으로 변환 가능  
**위험도**: 중간 — 대부분 앱이 atom 패턴 이미 사용 중

> **설계 결정**: 컴파일러에 `--strict-mutable` 플래그 → v12에서 기본 on

---

### D. DB/WS/HTTP 시그니처 표준화

| # | 항목 | v11 문제 | v12 표준 |
|---|------|---------|---------|
| #15 | http_post | body에 map 직접 전달 가능 | map → 자동 json-stringify |
| #53 | WS 핸들러 | on-message 콜백 구조 비일관 | `(ws-handler {:on-message fn :on-close fn})` |
| #54 | on-close | 분리 등록 필요 | ws-handler 맵에 통합 |

**마이그레이션**: 코드 자동 변환 가능 (http_post에서 map → json-stringify 자동 삽입)  
**위험도**: 낮음

---

### E. 기타

| # | 항목 | v11 문제 | v12 해결 |
|---|------|---------|---------|
| #99 | server-start 블로킹 | 이후 코드 실행 안 됨 | `server-start` 이후 `on-ready` 콜백 또는 비블로킹 옵션 |

---

## v12 타임라인 초안

| 단계 | 기간 | 내용 |
|------|------|------|
| Alpha | Q3 2026 | C(atom) + B(HTTP) Breaking Change 구현 |
| Beta  | Q4 2026 | A(인자순서) Breaking Change + 자동 마이그레이션 툴 |
| RC    | Q1 2027 | 전체 MISTAKES-100 100% 목표 |
| GA    | Q2 2027 | v12 정식 릴리스 |

---

## v11 → v12 마이그레이션 전략

### 자동 변환 가능 패턴

```bash
# freelang migrate v12 <file.fl>
(define x 0)
(set! x 1)
# → 
(define x (atom 0))
(reset! x 1)

(http_post url some-map)
# →
(http_post url (json-stringify some-map))
```

### 수동 검토 필요 패턴

- `(get map key)` → `(get key map)` — 인자 순서 역전은 문맥 이해 필요
- HTTP 핸들러 리팩터 — respond 패턴으로 전환
- WS 핸들러 — 구조 변경

---

## 설계 원칙 (v12)

1. **컬렉션-first**: 모든 고차함수는 컬렉션을 마지막 인자로 받음 (Clojure 관례와 다름, 파이프 친화적)
2. **불변 기본**: 전역 가변 상태는 atom만 허용
3. **단일 HTTP API**: server_*/app-* 혼용 제거, 단일 라우터
4. **자동 타입 변환**: http_post body map → json-stringify 자동
5. **MISTAKES-100 100%**: v12 GA에서 모든 100개 항목 커버

---

**검토 필요**: 이 문서는 v11.6.x 개발 중 발견한 설계 이슈를 정리한 것입니다. v12 구현 전 커뮤니티 피드백 수집 예정.
