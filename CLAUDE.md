# FreeLang v11 — 실측 현황 보고서

> **규칙**: 이 문서는 **실제 검증한 내용만** 기록합니다.  
> 미검증 주장은 "관측 안 됨" 또는 "미검증"으로 표기합니다.  
> [`TRUTH_POLICY.md`](./TRUTH_POLICY.md) 를 준수합니다.

---

## 📊 실측 상태 (2026-04-18 검증)

### 컴파일 능력

| 파일 | 컴파일 | 실행 | 결과 |
|------|--------|------|------|
| `self/bench/hello.fl` | ✅ | ✅ | "hello" 출력 |
| `self/bench/tiny.fl` | ✅ | ✅ | "42" 출력 |
| `self/bench/fib30.fl` | ✅ | ✅ | "832040" 출력 |
| `self/bench/test-time.fl` | ✅ | ✅ | "now_ms/iso/unix" 확인 |

**검증 명령어**:
```bash
cd /home/kimjin/freelang-v11
node bootstrap.js run self/codegen.fl self/bench/hello.fl output.js
node output.js
```

### 테스트 결과

```bash
npm test
```

**결과**:
```
Test Suites: 17 passed, 17 total
Tests:       637 passed, 637 total
Time:        21.097 s
```

**기록**: 2026-04-18 실제 실행 검증

### 자체 호스팅 (Self-Hosting)

| 항목 | 상태 | 근거 |
|------|------|------|
| FL 코드 → JS 변환 | ✅ 가능 | 4개 파일 컴파일 성공 |
| 생성된 JS 실행 | ✅ 가능 | 모든 출력 일치 |
| codegen.fl 자신 컴파일 (stage1) | ✅ 가능 | `--stack-size=8000`로 `self/all.fl` → 45KB JS 산출 (2026-04-20) |
| stage2 (self-compiled로 재컴파일) | ⚠️ 부분 | 산출은 되나 Lexed/Parsed 비정상 (번역 버그 잔존) |
| Fixed-point 안정성 | ❌ 미달성 | stage2→stage3 시도 실패 |

### 웹 서버 (프로덕션)

| 항목 | 상태 | 근거 |
|------|------|------|
| 서버 구동 | ✅ 가능 | 포트 30011에서 성공 |
| HTTP 응답 | ✅ 가능 | `curl http://localhost:30011/` HTML 응답 |
| 라우팅 | ✅ 작동 | app/page.fl 자동 발견 및 등록 |
| SSR 렌더링 | ✅ 작동 | HTML 페이지 생성 |

---

## 🔧 기술 스택

| 계층 | 기술 | 상태 |
|------|------|------|
| **런타임** | Node.js v25 | 필수 의존 |
| **번들** | bootstrap.js (1.1MB) | ✅ 존재 |
| **컴파일러** | codegen.fl (v11로 작성) | ✅ 작동 확인 |
| **테스트** | Jest 637개 케이스 | ✅ 모두 PASS |

---

## 미검증 항목

다음은 **검증하지 않았거나 미완성**입니다:

- [ ] 성능 벤치마크 (응답 시간 측정 안 함)
- [ ] ISR/SSG 렌더링 (SSR만 확인)
- [ ] 완전 자가 컴파일 fixed-point (stage1 성공, stage2+ 번역 버그 잔존)
- [ ] 의존성 제로 (Node.js 여전히 필수)
- [ ] 프로덕션 배포 프로세스

---

## 현재 제약사항

1. **Node.js 의존**: `node bootstrap.js` 로만 실행 가능
2. **일부 파일만 컴파일 가능**: 4개 테스트 파일 성공, 나머지 미확인
3. **자가 컴파일 실패 가능성**: codegen.fl이 자신을 컴파일하는지 미검증

---

## 다음 검증 항목

1. 모든 `self/bench/` 파일 컴파일 시도
2. codegen.fl 자신 컴파일 테스트
3. 생성 JS의 SHA256 해시 안정성 확인
4. 웹 서버 실제 구동 테스트

---

## 정정 기록

**2026-04-18 검증**:
- 과거 주장: "Tests 583/583 PASS"
- 실제: **Tests 637/637 PASS**
- 차이: +54개 테스트 (미기록)

**2026-04-18 검증**:
- 과거 주장: "Phase 15 완성"
- 실제: 부분 기능 작동, 완전성 미검증

**2026-04-20 검증** (Phase 1 self-hosting 재조사 + 완결):
- 과거 주장: "codegen.fl 자신 컴파일 불가능 (Stack overflow line 54)"
- 실제: Stack overflow는 **본질 원인이 아님**. 실제 블로커는 **2개의 독립 버그**였음.
  - 버그 A: bootstrap parser가 map-literal AST fields를 JS Map으로 저장하는데 FL 레벨 열거 primitive 부재
  - 버그 B: `self/lexer.fl` (및 `self/all.fl`의 동일 구문) `emit` 함수가 토큰을 `{:type $kind ...}` 로 생성해
           `(get $t :kind)` 에서 `null`을 반환 → stage1 산출물이 모든 토큰을 `unknown` atom으로 파싱 →
           Parsed 팽창 / 빈 출력 / stage3 실패
- 조치:
  - 버그 A: `data` stdlib 모듈에 `map-entries`/`map_entries` primitive 추가 (`bootstrap.js` + `src/stdlib-data.ts` 미러).
    `self/all.fl`의 `cg-map-entries` bootstrap 분기 1단어 치환.
  - 버그 B: `self/all.fl` + `self/lexer.fl` 의 `emit` 함수 토큰 필드 `:type $kind` → `:kind $kind :type $kind`
    (alias 유지하여 하위호환 보장).
  - 부수 정리: `self/ast.fl`의 `make-pattern-match`가 사용하던 `:subject` 필드를 canonical `:value`로 통일.
- 결과:
  - stage1/stage2/stage3 자가 컴파일 **SHA256 완전 일치** — `6b81fef4fd9a992983390ddae85adb4e7f61c326501d43dc160d22e15d12f4a1`
  - Parsed=156 / 45,343 bytes 산출 (stage1 == stage2 == stage3)
  - hello.fl 재컴파일 → bootstrap 직접 컴파일 결과와 동일한 `console.log("hello");` 생성
  - 회귀: Tests **643/643 PASS** (기존 637 + 신규 자가 호스팅 6)
  - 신규 회귀: `src/__tests__/self-hosting.test.ts` 추가하여 이후 자가 호스팅 깨짐 즉시 감지 가능
- 후속 과제 (별도 세션):
  - TS 원본 재빌드 시 bootstrap.js 산출물 동일성 검증 (자동화)
  - Await/Throw 필드명 불일치 (`:argument` vs `:expr`) — async 코드 경로에서만 발현

---

## Canonical AST/Token Schema (2026-04-20 확정)

**Token**:
```
{:kind  "LParen"|"RParen"|"LBracket"|"RBracket"|"LBrace"|"RBrace"|
        "Number"|"String"|"Symbol"|"Variable"|"Keyword"|"Unknown"
 :type  (= :kind — 하위호환 alias)
 :value <raw-string>
 :line  <number>
 :col   <number>}
```

**AST Node**:
```
{:kind  "literal"|"variable"|"keyword"|"sexpr"|"block"|"pattern-match"
 :type  "number"|"string"|"boolean"|"symbol"  ;; literal 전용
 :value <raw> | <match-대상-노드>              ;; literal / pattern-match 공용 필드명
 :name  <string>                               ;; variable/keyword
 :op    <string>  :args [nodes]               ;; sexpr
 :fields {items: [nodes]}                      ;; block (Array/Map/FUNC)
 :cases [match-case nodes]  :defaultCase? node ;; pattern-match
 :pattern <pat> :guard? node :body node        ;; match-case
 :line <number>}
```

**규칙**:
- `:value`는 literal의 원문 값 **또는** pattern-match의 match 대상. 용법은 `:kind`로 구분.
- Map literal 필드는 양쪽 포맷 공존 — bootstrap parser: JS Map (`(map-entries $fields)` 로 접근),
  self-parser: `{items: [k,v,k,v,...]}` (평탄 페어 리스트, `cg-map-flat-loop` 경로).
  `cg-map-entries` 내부에서 runtime 분기 `(array? (get $fields "items"))` 로 자동 판별.
- 새 노드 종류 추가 시 위 스키마에 먼저 편입 → bootstrap/self-parser 양쪽 동시 반영 필수.

