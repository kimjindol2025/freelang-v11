# FreeLang v11 Phase 4 — LIR 구현 계획서

**작성일:** 2026-05-07  
**근거:** LIR-001~005 (LANGUAGE_IMPROVEMENT_REQUESTS.md) 소스 분석 결과  
**대상 버전:** v11.5.1 → v11.6  
**목표:** 언어 완성도 88% → 95%

---

## 소스 분석 결과 요약

Phase 4 착수 전 FreeLang v11 소스(`src/`)를 직접 탐색한 결과,
초기 예상(7~10일)보다 구현 범위가 훨씬 작음을 확인했다.

| LIR | 초기 예상 | 실제 난이도 | 이유 |
|-----|----------|------------|------|
| LIR-002 | 2.5~3.5일 | **3~4시간** | `get` 함수에 정규화 절반 구현됨 |
| LIR-001 | 1~1.5일 | **1~2시간** | `str_slice` end-index 확인됨, 추가만 필요 |
| LIR-005 | 0.5일 | **30분** | `_aliases.json` 1줄 수정 |
| LIR-004 | 1~1.5일 | **2~3시간** | JSON 버전(`http_get_json_bearer`) 이미 존재 |
| LIR-003 | 0.5~1일 | **1시간** | 주로 문서화 |

**전체 실제 예상: 7~10시간 (1~2일)**

---

## Step 1 — LIR-002: map 키 자동 정규화

**우선순위:** P1 (최우선)  
**수정 파일:** `src/eval-builtins.ts`

### 현황 분석

`get` 함수(줄 204~230)는 이미 keyword AST 노드와 `":key"` 문자열을 처리한다:

```typescript
// 줄 219: keyword AST 노드 → name 추출
if (k !== null && typeof k === "object" && (k as any).kind === "keyword") k = (k as any).name;

// 줄 223: ":key" 문자열 → "key" 정규화
const normalized = typeof k === "string" && k.startsWith(":") ? k.slice(1) : String(k);
if (v0[normalized] !== undefined) return v0[normalized];

// 줄 226: 원본 k로도 시도
if (typeof k === "string" && v0[k] !== undefined) return v0[k];
```

**미해결 케이스:** map literal `{:access-key "val"}` 평가 시 키가 `":access-key"` (콜론 포함 문자열)로 저장되면, `(get m "access-key")` → normalized = `"access-key"` → `obj["access-key"]` 실패 → `nil`.

### 수정 내용

#### 1-a. `get` 함수 역방향 lookup 추가 (줄 226 다음)

```typescript
// eval-builtins.ts 줄 226 다음에 추가
if (typeof normalized === "string" && v0[":" + normalized] !== undefined)
  return v0[":" + normalized];
```

#### 1-b. `assoc` 함수 키 정규화 (줄 1694 근처)

```typescript
// key 저장 전 정규화 (assoc 처리 내부)
if (k !== null && typeof k === "object" && (k as any).kind === "keyword") k = (k as any).name;
if (typeof k === "string" && k.startsWith(":")) k = k.slice(1);
```

#### 1-c. map literal 평가 시 정규화 확인

인터프리터에서 `{:key val}` 평가 위치 찾아 keyword → string 변환 적용.

### 검증 케이스

```lisp
;; 4가지 조합 모두 "val" 반환 필수
(get {:access-key "val"} "access-key")   ;; → "val" (현재 nil)
(get {:access-key "val"} :access-key)    ;; → "val"
(get {"access-key" "val"} "access-key")  ;; → "val"
(get {"access-key" "val"} :access-key)   ;; → "val" (현재 nil)
```

---

## Step 2 — LIR-001: str-slice 시맨틱 명문화 + str-substr 추가

**우선순위:** P1  
**수정 파일:** `src/stdlib-data.ts`, `docs/STDLIB_REFERENCE.md`

### 현황 분석

`str_slice`는 `stdlib-data.ts` 줄 467에 구현됨:

```typescript
"str_slice": (s: string, start: number, end?: number) =>
  String(s).slice(Number(start), end !== undefined ? Number(end) : undefined),
```

JS `.slice()` = **end-exclusive index** 방식 확인.  
`(str-slice "hello" 1 3)` → `"el"` (index 1,2만 포함).

### 수정 내용

#### 2-a. `str-substr` 함수 추가 (`stdlib-data.ts` 줄 468)

```typescript
"str_substr": (s: string, start: number, len: number) => {
  const st = Number(start);
  return String(s).slice(st, st + Number(len));
},
```

#### 2-b. STDLIB_REFERENCE.md 업데이트

```
## 문자열 슬라이싱

str-slice str start end → str[start..end) (end 미포함)
  (str-slice "hello" 1 3) → "el"   ;; index 1, 2
  (str-slice "hello" 0 5) → "hello"

str-substr str start length → str[start..start+length)
  (str-substr "hello" 1 3) → "ell" ;; 1번부터 3글자
  (str-substr "hello" 0 5) → "hello"
```

---

## Step 3 — LIR-005: now_ms deprecated 방향 통일

**우선순위:** P3  
**수정 파일:** `src/_aliases.json`

### 현황 분석

| 기준 | canonical | deprecated |
|------|-----------|-----------|
| 런타임 (`eval-builtins.ts` 줄 615) | `now-ms` (kebab) | `now_ms` (snake) |
| `_aliases.json` | `now_ms` (snake) | — ← **불일치** |

런타임이 kebab을 canonical로 처리하는 것이 v11 방향과 일치. `_aliases.json`이 틀렸다.

### 수정 내용

```json
// 변경 전
{ "Date.now": { "correct": "now_ms", "usage": "(now_ms)", "mistake": "#37" } }

// 변경 후
{ "Date.now": { "correct": "now-ms", "usage": "(now-ms)", "mistake": "#37" } }
```

---

## Step 4 — LIR-004: http-get-bearer / http-post-bearer stdlib 추가

**우선순위:** P2  
**수정 파일:** `src/stdlib-http.ts`

### 현황 분석

`stdlib-http.ts` 줄 286에 `http_get_json_bearer` 이미 존재 (JSON 자동 파싱 버전):

```typescript
"http_get_json_bearer": (url: string, token: string) => {
  const res = curlGetStatusAndBody(url, "GET", { Authorization: `Bearer ${token}` }, "");
  return { ...res, body: safeJsonParse(res.body) };
}
```

**누락**: raw body 반환 버전 (`{:status N :body "string"}` 형태).

### 수정 내용

`createHttpModule()` 내부, `http_get_json_bearer` 다음에 추가:

```typescript
"http_get_bearer": (url: string, token: string) =>
  curlGetStatusAndBody(url, "GET", { Authorization: `Bearer ${token}` }, ""),

"http_post_bearer": (url: string, body: string, token: string) =>
  curlGetStatusAndBody(url, "POST",
    { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body),
```

### 서비스 리팩터 (stdlib 추가 후)

중복 구현 제거 대상 (3개 서비스):

```lisp
;; Before (akl-account, akl-iam, akl-bigwash 공통 패턴)
(http_request "GET" USERINFO_URL
  {"Authorization" (str "Bearer " $token)} "")

;; After
(http-get-bearer USERINFO_URL $token)
```

---

## Step 5 — LIR-003: auth-hmac 반환 타입 명시

**우선순위:** P2  
**수정 파일:** `src/stdlib-auth.ts`, `docs/STDLIB_REFERENCE.md`

### 작업 내용

1. `stdlib-auth.ts`에서 `auth_hmac` 구현 확인 후 반환 타입 주석 추가:

```typescript
// auth_hmac: data key → hex-string (소문자 hex, 64자)
// SigV4 key chain에서 HMAC 출력을 다음 HMAC의 key로 재사용 가능
```

2. STDLIB_REFERENCE.md 인증 섹션 업데이트:

```
auth-sha256 str → hex-string (소문자 hex 64자)
auth-hmac   data key → hex-string (소문자 hex 64자)
  ※ SigV4 key chain 사용 가능: (auth-hmac $region $k1) where k1 = 이전 auth-hmac 결과
```

---

## 빌드 및 검증 절차

### 각 Step 완료 후 빌드

```bash
cd /root/kim/freelang-v11
npm run build   # TypeScript → bootstrap.js
```

### 통합 검증 스크립트

```lisp
;; /tmp/test-phase4.fl

;; LIR-002: map 키 양방향 접근
(define m {:access-key "val"})
(println (= (get m "access-key") "val"))   ;; → true
(println (= (get m :access-key) "val"))    ;; → true

;; LIR-001: str-slice vs str-substr
(println (= (str-slice "hello" 1 3) "el"))    ;; → true
(println (= (str-substr "hello" 1 3) "ell"))  ;; → true

;; LIR-004: http-get-bearer 동작 확인
(println "Tests passed")
```

```bash
node /root/kim/freelang-v11/bootstrap.js run /tmp/test-phase4.fl
# 기대 출력: true true true true Tests passed
```

### 서비스 E2E 검증

```bash
# deprecated 경고 0건
node /root/kim/freelang-v11/bootstrap.js run /root/kim/akl-api/src/main.fl &
sleep 3 && grep deprecated /root/kim/akl-api/server.log | wc -l  # → 0

# IAM exchange 정상
node -e "require('http').get('http://localhost:40330/health', r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(d))})"
```

---

## 완료 기준

| Step | 완료 조건 | 예상 소요 |
|------|----------|----------|
| Step 1 (LIR-002) | `{:key val}` ↔ `"key"` 양방향 접근 성공 | 3~4시간 |
| Step 2 (LIR-001) | `str-substr` 동작 + STDLIB_REFERENCE 업데이트 | 1~2시간 |
| Step 3 (LIR-005) | `_aliases.json` now-ms = correct | 30분 |
| Step 4 (LIR-004) | `http-get-bearer` 동작 + 3개 서비스 리팩터 | 2~3시간 |
| Step 5 (LIR-003) | auth-hmac 반환 타입 문서화 | 1시간 |

**목표 완성도:** 88% → **95%**  
**총 예상 시간:** 7~10시간

---

## 위험 요소 및 대응

| 위험 | 대응 |
|------|------|
| `get` 역방향 lookup → 기존 코드 사이드이펙트 | map literal 전체 패턴 테스트 케이스 포함 |
| bootstrap.js 빌드 누락 | Step마다 `npm run build` 필수 확인 |
| akl-account `(get req :body)` 패턴 영향 | LIR-002 적용 후 `server-req-body` 동작 확인 |
