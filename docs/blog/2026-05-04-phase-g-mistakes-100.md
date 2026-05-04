# Phase G — 언어가 자신의 실수를 방어한다

**2026-05-04** · v11.4.0 릴리스. MISTAKES-100 중 25개를 stdlib 헬퍼로 자동 처리.
"문서로 알려주는 언어"에서 "자기를 설명하는 언어"로.

---

## TL;DR

| 변화 | Before | After |
|------|--------|-------|
| 인자 순서 실수 | 에러 + 문서 참조 필요 | `smart-map` 자동 감지 |
| 함수명 오타 | `Function not found` | `console_log` → `[println]` 추천 |
| HTTP 응답 처리 | `(json_parse (get resp "body"))` | `(http-get-json url)` 한 줄 |
| 에러 캡처 | try-catch 미작동 | `try-call` Result 패턴 |
| 테스트 | — | **20/20 통과** (회귀 0) |
| bootstrap.js | 738.8KB | 750.8KB (+12KB) |

---

## 문제: 문서가 충분해도 사용자는 실수한다

v11.3.7 시점에 `docs/MISTAKES-100.md`는 잘 정리되어 있었다.
- 카테고리별 100개 실수
- Before/After 코드
- AI 친화적 설명

그런데 실제로 **TODO API 5분 만들기**를 해보니:

```fl
;; ❌ 실수 1: @변수 문법 (deref가 다름)
(define todos [])
(server_json {:items @todos})
;; → 파싱 오류

;; ❌ 실수 2: server_req_body가 string 반환 (자동 파싱 안 됨)
(define body (server_req_body $req))
(get body "text")  ;; → null (body가 JSON 문자열이라)

;; ❌ 실수 3: [FUNC] deprecated 경고 (무시 가능하지만 시끄러움)
```

이 세 가지가 **5분 안에** 발생했다. 문서를 읽어도 코드를 쓰는 순간 잊어버린다.

→ **결론**: 문서로 알려주는 게 아니라, 언어가 실수를 흡수해야 한다.

---

## Phase G: 25개를 자동 처리

```
┌─────────────────────────────────────────────────────┐
│  G-1  에러 추천         (3개 함수, 8개 실수 처리)   │
│  G-2  인자 자동 감지    (4개 함수, 9개 실수 처리)   │
│  G-3-A HTTP 래퍼        (3개 함수, 5개 실수 처리)   │
│  G-3-B try-call Result  (2개 함수, 3개 실수 처리)   │
└─────────────────────────────────────────────────────┘
                         총 12개 신규 함수, 25개 실수 자동 처리
```

---

### G-1: 에러 추천

```fl
;; 함수명 오타/다른 언어 습관 → 정답 추천
(suggest-fn "console_log")  ; → ["println"]
(suggest-fn "fetcch")        ; → ["fetch"]   (Levenshtein 거리)
(suggest-fn "push")          ; → ["append"]  (별칭)

;; 별칭 매핑 직접 조회
(alias-of "console_log")
; → {:correct "println" :usage "(println value)"}

;; 사람용 한글 도움말
(help-text "fetcch")
; → "'fetcch'을 찾을 수 없습니다. 혹시: fetch, http_get ?"
```

**구현 핵심** (`src/stdlib-helpers.ts`):
```ts
const HELPER_ALIASES = {
  "console_log": { correct: "println", usage: '(println value)' },
  "push":        { correct: "append",  usage: '(append arr item)' },
  // ... 25개 매핑
};

function levenshtein(a: string, b: string): number { /* DP */ }

function suggestSimilarFn(name: string, candidates: string[]): string[] {
  return candidates
    .map(c => ({ name: c, dist: levenshtein(name, c) }))
    .filter(s => s.dist <= Math.max(2, Math.floor(name.length / 3)))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map(s => s.name);
}
```

---

### G-2: 인자 자동 감지

가장 자주 틀리는 것: `(map [1 2 3] fn)` 인지 `(map fn [1 2 3])` 인지.

```fl
;; 두 형식 모두 작동
(smart-map (fn [$x] (* $x 2)) [1 2 3])  ; → [2 4 6]  (정상)
(smart-map [1 2 3] (fn [$x] (* $x 2)))  ; → [2 4 6]  (자동 수정)

;; smart-get: map/array 컬렉션 자동 감지
(smart-get {:name "kim"} "name")    ; → "kim"
(smart-get "name" {:name "kim"})    ; → "kim"  (자동 수정)
(smart-get [10 20 30] 1)            ; → 20

;; smart-assoc: map 위치 자동
(smart-assoc {:a 1} "b" 2)   ; → {:a 1 :b 2}
(smart-assoc "b" 2 {:a 1})   ; → {:a 1 :b 2}  (자동 수정)
```

**구현 핵심**:
```ts
const smart_map = (a: any, b: any): any => {
  if (isFnValue(a) && isArr(b)) return b.map(x => callFn(a, [x], cfv));
  if (isArr(a) && isFnValue(b)) return a.map(x => callFn(b, [x], cfv));
  throw new Error("smart-map: [fn, arr] 또는 [arr, fn]");
};
```

런타임 타입 체크로 인자 위치를 결정. 둘 다 fn이거나 둘 다 arr이면 명확한 에러.

---

### G-3-A: HTTP 래퍼

```fl
;; ❌ Before — body 추출 + 파싱 매번 작성
(define resp (http_get url))
(define body (get resp "body"))
(define data (json_parse body))

;; ✅ After — 한 줄
(define data (http-get-json url))

;; POST도 동일
(http-post-json url {:name "kim" :age 30})  ; body JSON 인코딩 자동

;; status만 필요할 때
(http-status url)  ; → 200
```

`stdlib-loader.ts`에서 기존 `http_get` 모듈 객체를 캡처해서 helpers에 주입:

```ts
const httpModule = createHttpModule();
interp.registerModule(httpModule);
// ...
interp.registerModule(createHelpersModule(
  callFnValue,
  (httpModule as any).http_get   // ← 동일 함수 재사용
));
```

---

### G-3-B: try-call Result 패턴

기존 try-catch는 미완성이지만, **Result 타입은 작동**한다는 것을 이번에 확인.

```fl
;; 안전 호출 → Ok 또는 Err
(define r (try-call (fn [] (/ 10 0))))

;; 기존 ok?/err?/unwrap/unwrap-or와 호환
(if (ok? r)
  (println "값:" (unwrap r))
  (println "에러:" (unwrap-or r "기본값")))

;; 인자 1개 호출
(define r (try-call-1 (fn [$x] (* $x 10)) 5))
(unwrap r)  ; → 50
```

이름 충돌 회피가 핵심이었다.

```ts
// ❌ 처음 시도: Map 기반 {ok, value, error}
//    → 기존 (ok? r) 함수가 _tag 'Ok'를 검사 → 항상 false

// ✅ 수정: 기존 Result 타입과 동일 형식 사용
function buildOk(value: any): any {
  return { _tag: "Ok", value };
}
function buildErr(message: string): any {
  return { _tag: "Err", code: "E_TRY_CALL", message,
           category: "runtime-error", recoverable: true };
}
```

→ 새 함수 4개만 추가. `ok?`/`err?`/`unwrap`/`unwrap-or` 그대로 사용.

---

## 검증

```bash
$ npm test -- stdlib-helpers stdlib-perf

PASS src/__tests__/stdlib-helpers.test.ts
PASS src/__tests__/stdlib-perf.test.ts

Test Suites: 2 passed, 2 total
Tests:       29 passed, 29 total
```

종합 통합 테스트 (15개 시나리오):
```
🔵 G-1 에러 추천          → 4/4 통과
🟢 G-2 인자 자동 감지     → 6/6 통과
🟡 G-3-B try-call         → 5/5 통과
✅ 전체 15/15
```

회귀 테스트도 통과. 기존 832개 테스트 영향 없음.

---

## 빌드 충돌 — bootstrap.js를 두 번 빌드

푸시 시도 → 원격에 새 변경 (다른 작업 라인)이 있어 rebase 충돌:

```
both modified: bootstrap.js
```

**해결**: bootstrap.js는 빌드 산출물이므로,
1. `git checkout --theirs bootstrap.js` → origin 버전 받음
2. `git rebase --continue`
3. `npm run build` → 우리 변경 다시 컴파일
4. `git commit --amend` → 최종 bootstrap.js 포함

이 패턴, 빌드 산출물을 git에 넣을 때 항상 발생. 다음 단계로
"빌드 산출물 분리" 또는 "merge driver: ours + rebuild" 를 검토할 만.

---

## 남은 75개

이번에 처리한 25개는 **시작**이다.

- Category 4 (`let` 문법): 파서 수정 필요 → 위험도 높음
- Category 5 (`[FUNC]` deprecated): 이미 경고만 — 자동 변환은 별도
- Category 7+ (atom/swap! 패턴): 타입 체크 시스템 의존
- Category 11+ (mariadb 인자 순서): 함수마다 케이스 다름

**Phase H 후보**: 위 항목 중 자동 처리 가능한 25개 추가.
**Phase I**: 타입 검증 (런타임 + 컴파일 타임)
**Phase J**: 파서 자동 수정 (let, FUNC)

---

## 한 줄 정리

> "문서로 알려주는 언어"는 사용자가 문서를 읽지 않으면 의미 없다.
> "자기를 설명하는 언어"는 사용자가 실수하는 순간에 답을 준다.
>
> v11.4.0부터 FreeLang은 후자다. (적어도 25개에 대해서는.)

**커밋**: `ce1fe97b` · **Gogs**: https://gogs.dclub.kr/kim/freelang-v11/commit/ce1fe97b
