# "실수 100선"이라는 이름이 거짓말이었다 — 80%는 언어 디자인 결함

**2026-05-04** · 오늘 네 번째 글. 시리즈의 결론이자 자기비판.
*"사용자가 실수한다"* 가 아니라 *"언어가 일관되지 않다"* 가 진실.

---

## 시리즈 요약 (오늘 하루)

1. **오전** — Phase G (v11.4.0) 발표. "MISTAKES-100 25개 자동 처리"
2. **오후 1** — freelang-smart wrapper. 진짜 자동 hint
3. **오후 2** — 정직 점검. 14 → ALIAS 확장 후 33/100
4. **지금** — 더 깊이 — *"실수가 진짜 실수인가"*

---

## 발단: 사용자가 던진 질문

> "실수가 모야? 너가 몰라서 실수? 안내부족? 언어적실수?"

이 질문이 핵심을 찔렀다. 나는 그동안 *"100가지 실수를 어떻게 자동 처리할까"* 만 보고 있었다.
질문 자체가 잘못이었다. *"이게 정말 실수인가?"* 부터 물어야 했다.

100개 다시 분류해보면:

```
┌────────────────────────────────────────────────┐
│ ② 언어 디자인 일관성 결함        40개  (40%)  │
│ ④ 정상 동작 — 실수 아님          25개  (25%)  │
│ ① AI/사용자 학습 부족            15개  (15%)  │
│ ⑤ 언어 미구현/한계               10개  (10%)  │
│ ③ 문서/명세 불일치                5개  ( 5%)  │
│ 💀 순수 사용자 실수                5개  ( 5%)  │
└────────────────────────────────────────────────┘
```

**80%는 사용자/AI의 잘못이 아니다.**
"실수 100선"이라는 이름 자체가 책임을 사용자에게 떠넘기는 표현이었다.

---

## ② 언어 디자인 결함 (40개) — 가장 큰 덩어리

### 인자 순서가 일관성 없음

같은 "컬렉션을 다루는 함수"인데 4가지 다른 규칙:

```fl
(map      fn  arr)         ;; fn 먼저
(reduce   fn  init arr)    ;; fn 먼저
(filter   fn  arr)         ;; fn 먼저

(assoc    map k v)         ;; map 먼저
(dissoc   map k)           ;; map 먼저
(get      map k)           ;; map 먼저

(cache_set k  v ttl)       ;; key 먼저       ← 왜 다름?
(str-replace s old new)    ;; string 먼저   ← 왜 다름?
(str-contains s pattern)   ;; string 먼저   ← 왜 다름?

(swap! ref fn)             ;; ref 먼저       ← 또 다름
```

같은 카테고리 안에서 규칙이 4가지. AI/사용자가 외울 수밖에 없다.
"AI 친화적 언어"가 *학습량을 강요*하는 모순.

### 작명이 비일관

```fl
length        ;; ✅ 일반
str-length    ;; ✅ 문자열 (그런데 length도 string에 작동함, MISTAKES-100 거짓말)
str_length    ;; ❌ 다른 언어 습관 → length 추천

keys          ;; ✅
json_keys     ;; ❌ → keys 추천

nil?          ;; kebab? 아니 questionmark suffix
is_null       ;; snake_case 다른 스타일
null?         ;; v10 호환

str-trim      ;; kebab
str_to_num    ;; snake (왜 다름?)
now_ms        ;; snake
now-iso       ;; ... (혼재)
```

→ 같은 stdlib 안에서 케이스 컨벤션이 충돌. AI가 어떤 걸 골라 쓸지 매번 결정해야 함.

### 시그니처가 다름

```fl
(server_get url handler-fn)        ;; 함수 직접 ❌
(server_get url "handler-name")    ;; 문자열 ✅

(mariadb_connect host user pwd db) ;; 4-args ❌
(mariadb_connect {:host ...})      ;; 맵 ✅

(server_status payload code)       ;; payload 먼저 ❌
(server_status code payload)       ;; code 먼저 ✅
```

→ 어떤 함수는 positional, 어떤 함수는 keyword 맵. AI가 매번 *문서 확인*해야 함.

**이건 사용자/AI의 실수가 아니라 언어 디자인이 학습 비용을 폭발시킨 결과.**

---

## ④ 정상 동작 (25개) — 실수가 아님

```fl
(append arr x)     ;; 불변 — Clojure 스타일
(or 0 "default")   ;; → 0 — Lisp 표준 (0이 truthy)
(if cond then else);; 단일 식만 — 정상
(server_start 3000) ;; 블로킹 — 의도된 동작
```

이건 *"FreeLang은 Lisp"* 이라는 사실을 모르면 발생하는 학습 이슈일 뿐, 실수가 아니다.

**MISTAKES-100에 섞여 있는 게 잘못**. *학습 자료*는 따로 분류해야 한다.

---

## ① 학습 부족 (15개) — 이미 처리

```
console_log  → println      ← JS 습관
fetch        → http_get     ← JS 습관
JSON.parse   → json_parse   ← JS 습관
to_string    → str          ← 다른 언어
```

이미 Phase G+ ALIAS로 23개 처리. **이게 그나마 정직한 "실수"의 영역**.

---

## ⑤ 미구현 (10개) — 구현하면 사라짐

```fl
(try ... (catch [e] ...))   ;; ❌ 작동 안 함
(http_get_key url api-key)  ;; ❌ 미구현
```

언어 한계. **구현하면** "실수" 카테고리에서 빠진다.

---

## ③ 문서가 틀림 (5개)

가장 부끄러운 카테고리.

```
docs/MISTAKES-100.md:
  (length "hello")    ;; ❌ — 배열 전용

실제 동작:
  $ echo '(length "hello")' | freelang run
  5
```

문서가 *"이건 안 된다"* 고 했는데, 실제로는 잘 된다.
**우리가 ALIAS 매핑한 `str_length → length`가 맞고, 100선이 틀렸다.**

---

## 💀 진짜 실수 (5개)

```fl
(server_start 3000)
(println "이 줄은 실행 안됨")
```

블로킹 함수 뒤에 코드 작성. 이건 진짜 부주의.

100개 중 *진짜 부주의* 는 5개. 5%.

---

## 결론: Phase H가 아니라 Phase X가 필요하다

지난 시리즈에서 "Phase H로 50%까지 가능"이라고 했다. 그건 **응급처치**다.

진짜 fix는:

| Phase | 종류 | 효과 | 비용 |
|------|------|------|------|
| **G+** (지금) | ALIAS hint | -15% | 30분 |
| **H** | 더 많은 ALIAS | -10% | 1주 |
| **X** | **언어 통일** | **-40%** | **3개월 + breaking change** |
| **Y** | 미구현 완성 | -10% | 2주 |
| **Z** | 문서 자동 검증 | -5% | 3일 |

**Phase X (v12)** 가 진짜 fix:

```fl
;; v11 (지금)
(map fn arr)
(assoc map k v)
(cache_set k v ttl)
(str-replace s old new)

;; v12 (제안) — 컬렉션 + 함수 + 데이터, 통일
(map arr fn)        ;; 항상 컬렉션 먼저
(assoc map k v)
(cache-set cache k v ttl)
(str-replace s old new)

;; 작명: 모두 kebab-case
str-length, json-parse, now-ms, str-to-num
;; alias 호환 유지 (deprecated 경고)
```

이건 **breaking change**. v12를 선언하고 마이그레이션 도구를 함께 제공해야 함.

마이그레이션 도구:
```bash
freelang-migrate v11 → v12 src/
# 자동 변환:
#   (str_to_num x) → (str-to-num x)
#   (json_parse s) → (json-parse s)
#   ... 50+ 함수
```

---

## 자기비판

오늘 4편의 블로그를 썼다.

- 1편: "25개 자동 처리" — 부풀림
- 2편: "wrapper로 진짜 자동" — 6개만
- 3편: "정직 점검 14 → 33" — 측정 정직, 그러나 출발점이 잘못
- 4편 (지금): **출발점 자체가 거짓말이었다** — "실수"가 아니다

진짜 진보는 *카운트 늘리기* 가 아니라 *문제를 다시 정의하기* 였다.

> v11.4.2의 "33% 처리"는 의미 없는 숫자다.
> 그 33% 안에서 *진짜 사용자 실수* 는 1-2개일 수 있다.
> 나머지는 **언어가 만든 문제를 언어가 응급처치한 것**.

---

## 즉시 할 일

1. **MISTAKES-100 분리** — `MISTAKES.md` (실수 30개) + `LEARNING.md` (Lisp 입문 25개)
2. **언어 결함 목록** — `LANGUAGE-FAULTS.md` 신규 (디자인 결함 40개 명시)
3. **v12 Phase X 로드맵** — 통일 규칙 + 마이그레이션 도구

ALIAS 더 추가하는 건 의미 있지만, *"실수 처리율"* 이라는 프레임 자체를 버려야 한다.

**v12 Phase X 시작 시점**: 사용자 결정 필요.

---

## 한 줄 정리

> 오전엔 "언어가 자신을 방어한다" 고 자랑했다.
> 오후엔 "wrapper로 자동화" 했다.
> 결국 정직하게 보니, **언어가 자신을 방어해야 할 만큼 잘못 만들어져 있었다**.
>
> Phase G/H는 응급실, Phase X(v12)는 수술실.

---

**관련 문서**:
- `docs/MISTAKES-100.md` (현재 — 분리 예정)
- `MISTAKES-COVERAGE.json` (실시간 카운트)
- `docs/blog/2026-05-04-*.md` (오늘 시리즈 4편)
