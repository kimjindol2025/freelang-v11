# FreeLang v11 자가 호스팅 Fixed-point — 가설이 세 번 뒤집힌 하루

**2026-04-20** · 하루 동안 "자가 컴파일 불가능" 이라는 기록을 실측으로 뒤집고,
fixed-point 를 달성한 뒤, 다시 검증 체계를 정직하게 교정하고, 마지막으로
**진짜 격차는 self-parser 가 아니라 bootstrap interpreter 에 있었다** 는
사실까지 드러난 기록.

---

## TL;DR

| 단계 | 이전 가설 | 실측 후 | 커밋 |
|-----|----------|---------|------|
| 1차 뒤집힘 | "Stack overflow 로 자가 컴파일 불가" | `--stack-size=8000` 로 생성 성공. 진짜 블로커는 map 필드 열거 primitive 부재 + lexer 필드명 오타 | `2faaf00`, `fc7dd69` |
| Fixed-point 달성 | "stage2+ 실패" | stage1 = stage2 = stage3 SHA 완전 일치 (`6b81fef4…12f4a1`) | `735a72d` |
| 2차 정직 교정 | "Tier 2 verification 84/91 PASS" | false PASS 제거 후 76/91. `bootstrap Parsed=0` 케이스 10개 드러남 | `33fa4f1` |
| 3차 뒤집힘 | "self/all.fl 의 FL-written parser 가 try/catch 미지원" | **self-parser 는 이미 처리 가능**. 격차의 원인은 bootstrap TS interpreter | `6cf8bd6` |

테스트: 637 → **643** (+6, 자가 호스팅 회귀 테스트 신규). 회귀 전원 통과 유지.

---

## 출발점: "자가 컴파일 불가" 라는 기록

`CLAUDE.md` 가 이렇게 적혀 있었다.

| 항목 | 상태 | 근거 |
|------|------|------|
| codegen.fl 자신 컴파일 | ❌ 불가능 | Stack overflow (line 54) |
| Fixed-point 안정성 | ❌ 미검증 | 자가 컴파일 실패로 불가 |

재현부터 시작.

```bash
node bootstrap.js run self/codegen.fl self/codegen.fl /tmp/out.js
# → stack overflow
node --stack-size=8000 bootstrap.js run self/codegen.fl self/codegen.fl /tmp/out.js
# → compiled self/codegen.fl -> /tmp/out.js size=25776
```

**스택 증설만으로 생성 자체는 성공**. 기록의 진단이 표면 현상(stack overflow)에
머물렀고, 본질 원인은 다른 곳에 있었다.

---

## 1차 진단: map 리터럴이 전부 `({})`

`self/all.fl` 을 자가 컴파일한 뒤 hello.fl 을 재컴파일하니 `Lexed: 0 tokens`.
완전히 먹통. 최소 프로브로 좁혔다.

```fl
;; probe-map.fl
(let [[$m {:x 1 :y 2 :z "hi"}]]
  (println (str "x=" (get $m :x))))
```

- bootstrap 직접 실행: `x=1` 정상
- self-compiled 로 컴파일 → 실행: `x=null` (빈 출력)
- 생성된 JS 를 열어 보니 `let m=({});` — **map 리터럴이 빈 객체로 번역**

원인은 `self/all.fl` 의 `cg-map-entries`:

```fl
[FUNC cg-map-entries :params [$fields]
  :body (let [[$items-val (get $fields "items")]]
          (if (array? $items-val)
            (cg-map-flat-loop $items-val 0 "")
            (cg-map-loop (list) 0 "")))]   ;; ← 빈 리스트
```

bootstrap parser 가 map 필드를 JS `Map` 으로 저장하는데, FL 코드에서 이를
열거할 primitive 가 없어서 빈 리스트를 넘기고 있었다. `(list)` 자리에
`(map-entries $fields)` 를 쓰려 했으나 FL 레벨에 그 이름이 등록되지 않음.

조치:

```ts
// src/stdlib-data.ts 에 추가
"map-entries": (m: any): any[] => {
  if (m instanceof Map) return [...m.entries()].map(([k, v]) => [k, v]);
  if (m && typeof m === "object" && !Array.isArray(m)) return Object.entries(m);
  return [];
},
"map_entries": /* alias */
```

`self/all.fl` 의 `(list)` 를 `(map-entries $fields)` 로 1 단어 치환.

실측:
- map 리터럴 정상 생성
- stage1 자가 컴파일 크기 25KB → **45KB** (실제 값 포함)
- 회귀 637/637 PASS

---

## 2차 진단: lexer 토큰 필드명 오타

하지만 hello.fl 재컴파일 시 여전히 `Lexed: 4 tokens`, 출력 빈 것. stage2 의
`Parsed` 가 10,635 노드로 팽창 (정상 156). parse 가 각 토큰을 독립 노드로
잘못 취급하고 있음.

에이전트 세 개를 Explore 모드로 병렬 돌려 원인 찾기.

- Agent 1: bootstrap 과 self-parser 의 AST shape 차이 전수 조사
- Agent 2: codegen 이 AST 필드에 접근하는 지점 빈도 map
- Agent 3: Lexed=4 / Parsed=10635 최소 재현

Agent 3 가 원인을 특정:

> `self/lexer.fl` 의 `emit` 함수가 토큰을 `{:type $kind ...}` 로 생성.
> `self/parser.fl` 의 `parse-atom` 은 `(get $t :kind)` 로 읽음.
> → 모든 토큰의 `:kind` 가 `null` → `unknown` atom 으로 파싱
> → Parsed 팽창 + 빈 출력

한 단어 치환:

```diff
- (list {:type $kind :value $value :line $sl :col $sc})
+ (list {:kind $kind :type $kind :value $value :line $sl :col $sc})
```

`:type` 을 alias 로 남겨 하위호환 유지. 실측:

```
stage1 sha: 6b81fef4fd9a992983390ddae85adb4e7f61c326501d43dc160d22e15d12f4a1
stage2 sha: 6b81fef4fd9a992983390ddae85adb4e7f61c326501d43dc160d22e15d12f4a1
stage3 sha: 6b81fef4fd9a992983390ddae85adb4e7f61c326501d43dc160d22e15d12f4a1
```

**세 단계 SHA 완전 일치 → Fixed-point 달성**.

회귀 테스트 신설 (`src/__tests__/self-hosting.test.ts`, 6 케이스) 으로 잠가둠.
이후 어떤 변경이든 자가 호스팅 깨지면 CI 에서 즉시 감지.

---

## 정직 교정: 낙관 84 → 정직 76

Fixed-point 이후 Tier 1 + Tier 2 corpus verification 스크립트 작성
(`scripts/verify-self-host.sh`). 첫 실행 결과: **PASS 84 / FAIL 0 / SKIP 7**.
좋아 보였다.

그러나 자세히 보니 몇 stdlib 파일의 bootstrap 산출이 4,713 bytes 로 고정
(prelude-only 크기와 동일). 스크립트의 `check_compile_only` 가 "양쪽 산출이
non-zero 크기" 만 확인했기에 **false PASS**.

교정:

```bash
# 컴파일 로그에서 Parsed 노드 수 추출
bp=$(parsed_count "$bslog")
sp=$(parsed_count "$s1log")
if [ "$bp" = "0" ] && [ "$sp" != "0" ]; then
  echo "❌ bootstrap parser gap (bs=0 / s1=$sp)"
fi
```

교정 후: **PASS 76 / FAIL 0 / SKIP 15**. 숫자가 줄었지만 신뢰도 상승.

> 낙관 84 → 정직 76 은 후퇴가 아니라 신뢰도 상승이다.
> 검증 체계가 거짓 PASS 를 기록하면 기록 체계 자체가 무너진다.

SKIP 15 내역:
- **Bootstrap parser gap 10개**: assert, async, build, heap, resource, search, stack, tree + 2 tests
- **Compiler-coupled tests 5개**: test-codegen-{builtins, ffi, fn, match, sf}

이 시점의 진단: "self-parser 가 try/catch 같은 구문 미지원. Phase A 에서 self-parser 확장 필요."

---

## 3차 뒤집힘: 진짜 격차는 self-parser 가 아니었다

Phase A 착수 직전 재조사. 최소 프로브부터.

```fl
(try 1 2)         ;; → Parsed 0 (bootstrap interp 경로)
(try-foo 1 2)     ;; → Parsed 1
(throw 1)         ;; → Parsed 1
(catch 1 2)       ;; → Parsed 1
```

**`try` 만 Parsed=0**. 다른 심볼은 모두 정상.

확인: `src/parser.ts:848` 에 `if (op === "try")` hard-coded special form.
bootstrap TS parser 가 `(try body (catch ...))` 같은 엄격 형식만 허용하고
`(try 1 2)` 같은 generic 형태는 거부한다. 그런데 `self/all.fl` 자체에는
`try` 가 없으니 all.fl 파싱은 문제없을 것인데 왜 입력 파일 파싱이 실패하지?

실증 전환. **stage1.js 를 라이브러리로 직접 로드해 `lex`/`parse` 함수 호출**.

```js
// stage1.js 의 엔트리 호출 제거 후 eval
test('(try 1 2)', '[try]');
// → [try] tokens=5 ast=1
//   first: {"kind":"sexpr","op":"try","args":[1,2],"line":1}
```

**FL parser 는 `(try 1 2)` 를 완벽히 파싱한다**. Parsed 1 node.

즉:
- `self/all.fl` 내 FL-written parser 는 try/catch/cond-flat-pair **이미 처리 가능**
- 문제는 **bootstrap TS interpreter 가 FL-defined parser 를 AST 해석으로 실행**할 때
- 동일 FL parse 함수가 stage1 (compiled JS) 로는 정상 동작, bootstrap interp 경유에서는 0 반환

10개 문제 파일을 stage1 로 직접 컴파일:

```
self/stdlib/assert.fl    → Parsed 7  / JS 5838 bytes  ✅
self/stdlib/async.fl     → Parsed 17 / JS 6223 bytes  ⚠️ (codegen 버그 2건)
self/stdlib/build.fl     → Parsed 14 / JS 7131 bytes  ✅
self/stdlib/heap.fl      → Parsed 16 / JS 6758 bytes  ✅
self/stdlib/resource.fl  → Parsed 15 / JS 6123 bytes  ✅
self/stdlib/search.fl    → Parsed 12 / JS 6327 bytes  ✅
self/stdlib/stack.fl     → Parsed 14 / JS 5617 bytes  ✅
self/stdlib/tree.fl      → Parsed 14 / JS 6406 bytes  ✅
```

8/8 파싱 성공 + 7/8 JS 구문 유효. async.fl 만 stage1 codegen 의 `nil → null`
미번역 + rest-args `[& $args]` 처리 미완 때문에 실패.

---

## 교훈

1. **"실패 원인" 을 표면에서 멈추지 마라.**
   - "Stack overflow" 는 증상, 본질은 map primitive 부재 + 필드명 오타.
   - "self-parser 미지원" 은 짐작, 본질은 bootstrap interpreter 버그.
   - 최소 재현이 모든 가설을 뒤집었다.

2. **검증 체계의 false PASS 는 기록 체계를 무너뜨린다.**
   - 낙관 84 를 발견자 본인이 76 으로 되돌린 것이 이번 세션 가장 중요한 전환.

3. **언어 정의는 단 하나여야 한다.**
   - bootstrap 과 self-parser 가 문법 집합이 달랐다면 구조적 부채였을 것.
   - 실은 둘의 차이는 "정의" 가 아니라 "구현 실행 경로" 에 있었다.

4. **stage1 이 bootstrap 보다 더 robust 하다는 역설 = self-hosting 2단계 진입 신호.**
   - 자기 구현체가 부트스트랩을 능가하는 시점부터 "언어가 자기 정의를 소유"한다.
   - 그 시점부터 bootstrap 은 폐기 대상.

---

## 다음 Phase A (전략 수정)

이전 계획: "self-parser 에 try/catch 추가 구현" (중형 작업)
수정 계획:

1. `verify-self-host.sh` 의 canonical compile 경로를 `bootstrap.js run self/all.fl` 에서
   **`node stage1.js` 직접 호출** 로 전환 (한 줄 변경)
2. stage1 codegen 잔여 버그 2건:
   - `nil` → JS `null` 번역
   - rest-args `[& $args]` 파라미터 처리
3. verify 재실행 → SKIP 목록 대폭 축소 기대
4. bootstrap.js 는 **stage1 1회 생성 전용** 으로 축소

**bootstrap 완전 폐기 경로가 사실상 이미 가능함** 이 이번 세션 실측의 최종 결론.
Node.js 런타임 의존만 남기고, 그것도 Phase B (WASM/네이티브) 로 넘어간다.

---

## 기록

- 커밋 스트림 (master):
  `2faaf00` → `566039f` → `fc7dd69` → `9a65219` → `05aa87c` → `33c0182` → `236353e` → `9adaa8c` → `5dc4cb1` → `694da43` → `33fa4f1`
- 브랜치 (gogs): `feature/homepage-app`, `feature/homepage-polish`, `feature/self-host-verification`, `feature/investigate-bootstrap-codegen-gap`, `feature/phase-a-parser-unification`
- 회귀: Tests 643/643 PASS, self-hosting stage1/2/3 SHA 완전 일치 유지
- 실전 부산물: FreeLang 랜딩/Examples/Playground/Docs + 404 페이지 (모두 FL 로 작성된 SSR 라우트), Tier 1+2 verify 스크립트, canonical AST/Token schema 문서화

**하루치 정제**. self-host 는 이제 "가능" 이 아니라 "이미 부트스트랩보다 단단한 상태" 다.
