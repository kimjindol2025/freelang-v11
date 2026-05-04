# Phase X — v11.5.x 언어 통일 로드맵

> **목표**: v11의 디자인 결함 44개를 통일된 언어 규칙으로 fix
> **버전**: v11.5.1 (breaking change)
> **타임라인**: 3개월 (X-1 → X-5)
> **호환성**: `freelang-migrate` 도구 + alias 호환 모드

---

## 통일 규칙 (5가지)

### 규칙 1: 인자 순서 — **컬렉션 + 함수 + 부가 데이터**

```fl
;; v11 (혼란)
(map      fn  arr)         ;; fn 먼저
(filter   fn  arr)         ;; fn 먼저
(reduce   fn  init arr)    ;; fn 먼저
(assoc    map k v)         ;; map 먼저
(cache_set k  v ttl)       ;; key 먼저
(swap! ref fn)             ;; ref 먼저
(str-replace s old new)    ;; string 먼저

;; v11.5.x (통일) — "데이터 → 변환 → 부가"
(map      arr fn)
(filter   arr fn)
(reduce   arr fn init)
(assoc    map k v)         ;; 그대로 (이미 컬렉션 first)
(cache-set cache k v ttl)
(swap! ref fn)             ;; 그대로
(str-replace s old new)    ;; 그대로
```

→ **단순 규칙**: *데이터(컬렉션/문자열/atom) 먼저, 함수/연산 두 번째, 부가 인자 뒤*

### 규칙 2: 작명 — **kebab-case 통일**

```
v11                      v11.5.x
─────────────────────────────────────
length, str-length    → 둘 다 유지 (alias)
str_to_num            → str-to-num
json_parse            → json-parse
now_ms                → now-ms
mariadb_connect       → mariadb-connect
http_get              → http-get
file_read             → file-read
auth_jwt_sign         → auth-jwt-sign
server_start          → server-start
```

snake 형식은 deprecated alias로 유지. 컴파일러 경고.

### 규칙 3: 술어(predicate) — **`?` suffix 통일**

```
v11 (혼재)              v11.5.x
─────────────────────────────────────
nil?                  → nil?         (이미 OK)
is_array              → array?
is_string             → string?
is_number             → number?
file_exists           → file-exists?
fl_require?           → fl-require?  (이미 OK)
```

### 규칙 4: HTTP/I/O — **응답 구조 통일**

```fl
;; v11
(http_get url)
;; → {:status 200 :body "..." :headers {...}}
(json_parse (get (http_get url) "body"))   ;; 매번 추출

;; v11.5.x — 분리된 함수로 명확
(http-get url)            ;; → {:status :body :headers}
(http-get-json url)       ;; → body 자동 JSON 파싱 (helpers에서 승격)
(http-status url)         ;; → 200
(http-body url)           ;; → body string
```

→ **명시적 함수가 기본**. `(get resp "body")` 패턴 불필요.

### 규칙 5: 함수 선언 — **`$` 접두사 폐지 검토**

```fl
;; v11 — $ 필수
(defn add [$a $b] (+ $a $b))

;; v11.5.x — $ 선택 (호환성 위해 유지하되 권장 안 함)
(defn add [a b] (+ a b))

;; 이유: AI 입장에서 노이즈, 다른 Lisp(Clojure 등)과 다름
;; 호환성: $a 표기 그대로 작동 (deprecated 경고 없음)
```

---

## 단계별 계획

### X-1 (1주차): 표준 정의 + 마이그레이션 도구

```
✓ 통일 규칙 5개 명문화
✓ docs/V11.5-RULES.md 작성
✓ bin/freelang-migrate prototype
  - snake_case → kebab-case 자동 변환
  - 인자 순서 자동 감지/변환 (10개 함수)
  - $ 제거 옵션
  - dry-run 모드
✓ 테스트: 기존 .fl 파일 N개에 적용 검증
```

### X-2 (2-3주차): stdlib alias 추가

```
✓ 모든 v11 함수의 v11.5.x alias 등록
  예: str_to_num → str-to-num (둘 다 작동)
✓ 컴파일러 경고: deprecated 함수 사용 시 hint
✓ docs/_aliases.json 확장
```

### X-3 (4-6주차): 인자 순서 변환

```
✓ 10개 핵심 함수의 새 시그니처 추가
  (map arr fn) (filter arr fn) (reduce arr fn init) ...
✓ 기존 시그니처 (map fn arr)도 유지 (감지 로직)
✓ migrate 도구 검증
```

### X-4 (7-10주차): atom + HTTP API 정리

```
✓ atom/swap!/reset! 명확화
  - set! 호출 시 atom이 아니면 명확한 에러
  - clojure-like 언어와 align
✓ HTTP 응답 분리 함수 (http-get-json, http-status, http-body)
✓ server-status 인자 순서 통일
```

### X-5 (11-12주차): 출시

```
✓ v11.5.1 릴리스
✓ migrate 도구 안정화
✓ docs/MIGRATION.md
✓ 블로그: v11.5.x 안내
```

---

## 마이그레이션 도구 (`freelang-migrate`)

```bash
# 설치
npm install -g freelang-cli@12

# 사용
freelang-migrate v11 → v11.5.x src/

# 출력 예시
Scanning src/...
Found 23 .fl files

[src/main.fl]
  Line 12: (str_to_num "42") → (str-to-num "42")
  Line 18: (json_parse body) → (json-parse body)
  Line 25: (map (fn [$x] (* $x 2)) arr) → (map arr (fn [x] (* x 2)))

[src/api.fl]
  Line 8: (mariadb_query db sql) → (mariadb-query db sql)
  ...

총 변환: 47개
✓ 모두 적용? [Y/n]: Y
✓ 백업: src/.v11-backup/
✓ 변환 완료
```

**옵션**:
- `--dry-run`: 변경 미리보기만
- `--no-arg-order`: 인자 순서 변환 제외 (작명만)
- `--keep-dollar`: $ 접두사 유지

---

## 호환성 보장 — Migration Path

v11 → v11.5.x 전환은 **단계적으로**:

```
v11.4.2  (지금)              ─┐
                              │ migrate 도구 동작
v11.5.0  v11.5.x alias 미리 추가  │
                              │ 모든 사용자 코드 작동
v11.9.0  v11.5.x RC               │
                              │ deprecated 경고 출력
v11.5.1  공식 릴리스          ─┘
                              │ v11 alias 1년 유지
v11.6.0  alias 제거 시작
v11.9.0  v11 alias 완전 제거
```

→ **2027년까지 v11 코드 그대로 작동 보장**.

---

## 진행 추적

```bash
node scripts/verify-mistakes-coverage.js
# Phase X 완료 후 예상:
#   언어 결함:    44/44  (100%)
#   학습 자료:    분리됨
#   사용자 실수:   ALIAS hint 처리됨
#   ────────────────────────────
#   총 처리:      72/72 (실수 영역만)
```

---

## 위험과 trade-off

### 위험 1: 기존 코드 깨짐
**완화**: alias 유지 + migrate 도구 + 1년 유예

### 위험 2: 디자인 결정 재논의
**완화**: 5개 규칙은 *민주적 결정 X — 일관성 우선*. 이미 다수 언어가 이 패턴 채택 (Clojure 등).

### 위험 3: 마이그레이션 도구 버그
**완화**: dry-run 기본, 백업 자동, 단위 테스트 50+

### 위험 4: 이미 운영 중인 v11 서비스
**완화**: v11 1년 유지보수. 보안/버그 수정만 백포트.

---

## 시작 시점

**즉시 시작 가능**:
1. ✅ 분류 완료 (`_classifications.json`, 3개 문서)
2. ✅ 통일 규칙 명문화 (이 문서)
3. ⏳ migrate 도구 prototype
4. ⏳ alias 추가 (v11.5.0)
5. ⏳ X-1 완료 후 사용자 피드백 → X-2 진행

**v11.5.x RC 목표**: 2026-08 (3개월 후)
**v11.5.1 출시**: 2026-09

---

## 한 줄 정리

> v11.4.2의 33% 처리는 응급처치. v11.5.x Phase X는 *언어를 다시 디자인*하는 것.
> "사용자가 실수한다"가 아니라 "언어가 일관되도록" 만드는 게 진짜 fix.
