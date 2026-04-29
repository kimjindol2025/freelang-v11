# FreeLang v11 결정론 보증 가이드

**문서**: 어떤 함수가 결정론적인지, 어떤 함수는 비결정론적인지 명확히 분류

---

## 📊 결정론 함수 분류

### ✅ 순수 함수 (결정론적)
동일 입력 → 동일 출력, 부작용 없음

#### 수학 연산
- `+`, `-`, `*`, `/`, `%` (arithmetic)
- `**` (power)
- `abs`, `floor`, `ceil`, `round`
- `min`, `max`
- `sqrt`, `pow`

#### 비교/논리
- `=`, `<>`, `<`, `>`, `<=`, `>=`
- `and`, `or`, `not`
- `true?`, `false?`, `null?`

#### 타입 체크
- `number?`, `string?`, `list?`, `map?`
- `fn?`, `nil?`, `empty?`
- `integer?`, `float?`

#### 배열 조작
- `length`, `first`, `last`, `rest`, `nth`
- `get`, `get-or`
- `append`, `concat`, `flatten`
- `slice`, `reverse`
- `sort`, `unique` (비교 규칙 고정)
- `map`, `filter`, `reduce` (fn 전달)
- `join` (구분자 고정)

#### 문자열 조작
- `str`, `upper-case`, `lower-case`, `trim`
- `starts-with?`, `ends-with?`, `contains?`
- `split`, `substring`, `char-at`
- `string-replace`

#### 객체 조작
- `keys`, `values`, `entries`
- `json_set`, `json_merge`
- `get`, `has-key?`

#### 논리 제어
- `if`, `cond`, `case`
- `do`, `let`, `define` (변수 바인딩)

#### 함수형
- `fn`, `defn` (함수 정의)
- `compose`, `partial`, `memoize` (캐싱된 참조)

---

### ⚠️ 비결정론 함수 (non-deterministic)

#### 시간
- **`now`** — 현재 UNIX 타임스탬프
- **`now-ms`** — 밀리초
- **`now-iso`** — ISO 8601 문자열
- **`server-uptime`** — 서버 시작 이후 경과 시간

#### 난수
- **`random`** — 0~1 난수
- **`random-int`** — 범위 난수
- **`uuid`** — 고유 ID 생성

#### HTTP/네트워크
- **`http-get`** — HTTP GET 요청 (원격 상태 의존)
- **`http-post`** — HTTP POST (원격 상태 + body 의존)
- **`http-put`**, **`http-delete`** (원격 상태 의존)
- **`server-req-*`** — 요청 객체 (클라이언트 입력 의존)

#### 파일 I/O
- **`file-read`** — 파일 시스템 상태 의존
- **`file-write`** — 부작용 (파일 생성/수정)
- **`file-append`** — 부작용
- **`dir-list`** — 디렉토리 상태 의존

#### 데이터베이스
- **`mariadb-query`** — DB 상태 의존
- **`mariadb-exec`** — 부작용 (INSERT/UPDATE)

#### 환경
- **`get-env`** — 환경변수 (실행 환경 의존)
- **`shell-exec`** — 외부 프로세스 실행

#### AI
- **`ai-call`** — LLM 호출 (외부 API)

---

## 🎯 사용 지침

### 배치/자동화 (결정론 필수)
```fl
;; ✅ 안전
(define nums (list 1 2 3 4 5))
(define result (reduce (fn [acc x] (+ acc x)) 0 nums))  ;; 항상 15

;; ❌ 위험 — now/random 포함
(define timestamp (now))  ;; 매번 다른 값
(define dice (random))    ;; 매번 다른 값
```

### HTTP/이벤트 핸들러 (비결정론 허용)
```fl
;; ✅ 가능 — 외부 입력 반영
(server-get "/api/now" (fn [req]
  (server-json {:timestamp (now) :data (server-req-body req)})))

;; ❌ 피하기 — 매번 다른 결과
(server-get "/api/same" (fn [req]
  (if (> (random) 0.5) {:ok true} {:ok false})))  ;; 비결정론
```

### 결정론 보증 검증
```fl
;; 동일 입력 3회 실행
(define f (fn [x] (+ (* x 2) 1)))
(f 10)  ;; 21
(f 10)  ;; 21
(f 10)  ;; 21 ✅ 결정론적

;; 비결정론 감지
(random)   ;; 0.234
(random)   ;; 0.891
(random)   ;; 0.421 ❌ 다른 값
```

---

## 📝 코딩 규칙

| 상황 | 추천 | 이유 |
|------|------|------|
| 배치 스크립트 | 순수 함수만 사용 | 재현성 중요 |
| 테스트 | 순수 함수 우선 | 안정적인 검증 |
| API 핸들러 | 비결정론 허용 | 외부 입력 반영 필요 |
| 캐싱 | 순수 함수 대상 | memoize 효과적 |
| 병렬 실행 | 순수 함수만 | race condition 방지 |

---

## 🔍 내부 표시

(개발자용)

```typescript
// src/eval-builtins.ts의 pureFns Set
const pureFns = new Set([
  // 순수 함수만 포함
  '+', '-', '*', '/', '%',
  'map', 'filter', 'reduce',
  'upper-case', 'lower-case',
  // ...
]);

// 비결정론 함수 태그
const nonDeterministicFns = new Set([
  'now', 'now-ms', 'random',      // 시간/난수
  'http-get', 'http-post',         // 네트워크
  'file-read', 'file-write',       // I/O
  'mariadb-query', 'mariadb-exec', // DB
]);
```

---

**마지막 업데이트**: 2026-04-29 (Phase A 완료)
