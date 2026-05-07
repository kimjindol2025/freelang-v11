# FreeLang v11 언어 개선 요청 (LIR)

**작성일:** 2026-05-07  
**근거:** akl-* 서비스 실사용 중 발견한 언어 표준 공백  
**대상 버전:** v11.5.1 → v11.6  
**우선순위:** P1(긴급) > P2(중간) > P3(장기)

---

## LIR-001 — str-slice 시맨틱 명문화 [P1]

### 문제

`str-slice`의 2, 3번째 인자가 `(start, end)` 인지 `(start, length)` 인지 STDLIB_REFERENCE에 명시 없음.

**발견 코드 (akl-iam/app/server.fl)**:
```lisp
(str-slice (auth-sha256 ...) 0 16)      ;; end=16? length=16?
(str-slice $auth 7 (length $auth))      ;; end 방식으로 추정
```

**혼동 위험:**
- `(str-slice "hello" 1 3)` → `"el"` (end 방식) 또는 `"ell"` (length 방식)?

### 요청

1. STDLIB_REFERENCE에 `str-slice` 시맨틱 명확화:
   ```
   (str-slice str start end)  ;; str[start..end] (end 미포함)
   ```
2. length 방식이 필요한 경우를 위해 `str-substr` 별칭 추가:
   ```
   (str-substr str start length)  ;; str[start..start+length]
   ```

---

## LIR-002 — map 키 자동 정규화 [P1]

### 문제

FreeLang에서 키워드(`:key`)와 문자열(`"key"`)이 **다른 키**로 처리됨. 이로 인해 생성 시 키워드 키를 쓰고 접근 시 문자열 키를 쓰면 항상 `nil` 반환.

**발견 코드 (akl-aws/app/server.fl — 수정 전)**:
```lisp
;; 생성: 키워드 키
{:access-key (get $r "access_key") :secret ...}

;; 접근: 문자열 키 → nil 반환!
(get $raw "access-key")
```

**실제 영향:** IAM exchange 로직이 nil cfg 반환 → Lambda 호출 전체 실패.

### 요청

**옵션 A (권장):** `get` 함수가 키워드/문자열 양방향 접근 허용:
```lisp
(get {:access-key "val"} "access-key")   ;; → "val" (현재 nil)
(get {"access-key" "val"} :access-key)   ;; → "val" (현재 nil)
```

**옵션 B:** map 리터럴 생성 시 키워드를 문자열로 자동 정규화:
```lisp
{:key "val"}  ≡  {"key" "val"}  ;; 내부적으로 동일 처리
```

**옵션 C (최소):** 정책 문서화만 — "키워드와 문자열은 다름, 일관성 필수" + MISTAKES-100.md 추가.

---

## LIR-003 — auth-sha256 / auth-hmac alias 보장 [P2]

### 문제

`auth_sha256`, `auth_hmac`가 실제 동작은 하지만:
1. `_aliases.json`에 snake/kebab 양방향 alias 미등록
2. STDLIB_REFERENCE의 인증 섹션에 반환 타입 미명시
3. `auth-hmac`의 key 인자가 raw string인지 hex string인지 불명확

**발견 코드 (akl-aws/lib/sigv4.fl — SigV4 구현)**:
```lisp
;; make-signing-key: HMAC 출력을 다음 HMAC의 key로 재사용
(let [[$k1 (auth-hmac $date (str "AWS4" $secret))]
      [$k2 (auth-hmac $region $k1)]  ;; k1이 key로 재사용됨
      ...])
```
→ `auth-hmac`가 hex string 반환 시 key로 재사용하면 SigV4 서명 오류.

### 요청

1. `_aliases.json`에 `auth_sha256` ↔ `auth-sha256`, `auth_hmac` ↔ `auth-hmac` 양방향 등록
2. STDLIB_REFERENCE에 반환 타입 명시:
   ```
   auth-sha256 str → hex-string (소문자 hex 64자)
   auth-hmac   data key → raw-bytes | hex-string  ← 명확화 필요
   ```
3. SigV4 구현에서 HMAC key 재사용 패턴 허용 여부 문서화

---

## LIR-004 — http-get-bearer stdlib 표준화 [P2]

### 문제

Bearer 토큰 인증 HTTP 요청이 모든 서비스에서 반복 구현됨:

```lisp
;; akl-account, akl-bigwash, akl-iam — 모두 동일한 패턴 직접 구현
(http_request "GET" USERINFO_URL
  {"Authorization" (str "Bearer " $token)} "")
```

`akl-lib/auth.fl`에서 래핑하고 있으나 이를 stdlib 표준 함수로 제공하면 중복 제거 가능.

### 요청

다음 함수를 `stdlib-http.ts`에 추가:

```typescript
// http-get-bearer url token → {:status 200 :body "..."}
"http-get-bearer": (url: string, token: string): any => {
  return http_request("GET", url, { Authorization: `Bearer ${token}` }, "");
}

// http-post-bearer url body token → {:status 200 :body "..."}
"http-post-bearer": (url: string, body: string, token: string): any => {
  return http_request("POST", url,
    { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body);
}
```

**사용 예시:**
```lisp
;; Before (각 서비스에서 직접 구현)
(http_request "GET" USERINFO_URL {"Authorization" (str "Bearer " $token)} "")

;; After
(http-get-bearer USERINFO_URL $token)
```

---

## LIR-005 — now_ms deprecated 경고 오류 [P3]

### 문제

`_aliases.json`에서 `now-ms` → `now_ms` (kebab이 deprecated, snake가 canonical)로 등록됨.
그러나 런타임 v11.5.1에서는 반대로 `now_ms`가 deprecated 경고를 내보냄.

```
⚠️  [FreeLang v11.5.1] now_ms은 deprecated입니다. now-ms을 사용하세요.
```

→ `_aliases.json`과 실제 런타임 경고가 **반대 방향**으로 불일치.

### 요청

1. `_aliases.json`과 런타임 deprecation 경고를 일치시킴
2. 공식 canonical 형태를 하나로 결정하고 CHANGELOG에 명시:
   - **안 A:** `now_ms` canonical, `now-ms` alias (현재 _aliases.json 기준)
   - **안 B:** `now-ms` canonical, `now_ms` deprecated (현재 런타임 기준)

---

## 요약 테이블

| ID | 제목 | 우선순위 | 영향 서비스 | 예상 작업 |
|----|------|----------|-------------|-----------|
| LIR-001 | str-slice 시맨틱 명문화 | P1 | akl-iam, akl-aws, akl-account | 문서 1시간 |
| LIR-002 | map 키 자동 정규화 | P1 | 전체 | 인터프리터 2-4시간 |
| LIR-003 | auth-hmac alias 보장 | P2 | akl-iam, akl-aws | 문서+코드 2시간 |
| LIR-004 | http-get-bearer 표준화 | P2 | 전체 | stdlib 1시간 |
| LIR-005 | now_ms deprecated 불일치 | P3 | 전체 | 정책 결정 30분 |

---

## 참고: 이미 해결된 문제

| 항목 | 해결 방법 | 날짜 |
|------|-----------|------|
| `[FUNC]` deprecated | akl-api 전체 `defn` 전환 | 2026-05-07 |
| `now-ms` 혼용 | 5개 서비스 `now_ms` 통일 | 2026-05-07 |
| `http_post` 헤더 미지원 | `http_request` 4-arg 전환 | 2026-05-07 |
| map 키 불일치 버그 | akl-aws 문자열 키 통일 | 2026-05-07 |
| snake_case → kebab-case | akl-api 전면 전환 | 2026-05-07 |
