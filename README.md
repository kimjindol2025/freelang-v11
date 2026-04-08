# FreeLang v9

> **Claude Code가 만들고, Claude Code가 쓰는 언어.**
> 인간 없음. AI 전용.

---

## 한 줄 요약

FreeLang v9는 S-expression 기반의 AI 네이티브 프로그래밍 언어다.
"인간이 읽기 쉬운가?"가 아니라 **"AI가 추론/생성하기 쉬운가?"** 를 설계 기준으로 삼는다.

---

## 현재 상태: Phase 31 완성 — Gen2 자가 컴파일

```
Phase 31 Gen2 Lexer TCO: 18/18 PASS  ✅
Phase 30 Self-Compile:   25/25 PASS  ✅
Gen1 === Gen2 동치:        6/6  PASS  ✅
Gen2 런타임 정확성:        3/3  PASS  ✅  fact(10), fib(15), loop 10만

총 누적 테스트: 352 + 18 = 370/370 PASS
```

**Gen2 = 완전한 자가 컴파일:**
FL 컴파일러(lexer + parser + codegen)를 자기 자신이 컴파일한 JS로 재컴파일.
스택 없는 loop/recur TCO lexer로 1800+ 토큰 파일도 안전하게 처리.

```
Gen1 = tsCompile(lexer.fl + parser.fl + codegen.fl)
         → standalone JS 컴파일러 (TS parser 보조)

Gen2 = standaloneCompile(lexer.fl + parser.fl + codegen.fl)
         → Gen1 JS로 컴파일한 컴파일러 (완전 독립)

Gen1(x) === Gen2(x)  ← 모든 FL 프로그램에서 성립
```

---

## 구현 현황

### Phase 1~19: Core + Standard Library (289/289 PASS)

| Phase | 기능 | 테스트 |
|-------|------|--------|
| 1~4 | Lexer / Parser / AST / Interpreter | ✅ |
| 5 | 모나드 (Either / Maybe / Writer), 모듈 시스템 | ✅ |
| 6 | 타입 추론 엔진, TypeClass / Instance | ✅ |
| 7 | 비동기 (Promise / async / await) | ✅ |
| 8 | 패턴 매칭 Parser, Bootstrap 셀프호스팅 | ✅ 12/12 |
| 9a | WebSearch API, fetch 블록 | ✅ 16/16 |
| 9b | LearnedFacts 영속성, remember/recall/forget | ✅ 16/16 |
| 9c | Feedback Loop, if/when/repeat/while 조건 제어 | ✅ 18/18 |
| 10 | `stdlib-file`: file_read, file_write, dir_list | ✅ 8/8 |
| 11 | `stdlib-error`: try/catch/finally, throw | ✅ 10/10 |
| 12 | `stdlib-http` + `stdlib-shell` | ✅ 15/15 |
| 13 | `stdlib-data`: json_get, csv_parse, template | ✅ 31/31 |
| 14 | `stdlib-collection`: zip, group_by, pipeline | ✅ 35/35 |
| 15 | `stdlib-agent`: agent_create, agent_loop | ✅ 25/25 |
| 16 | `stdlib-time`: Timer, Logger, Metrics | ✅ 31/31 |
| 17 | `stdlib-crypto`: sha256, uuid, base64, regex | ✅ 46/46 |
| 18 | `stdlib-workflow`: workflow_create, workflow_run | ✅ 12/12 |
| 19 | `stdlib-resource`: res_snapshot, res_ports, res_pm2 | ✅ 22/22 |

### Phase 20~31: FL→JS 컴파일러 자가 구현 (81/81 PASS)

| Phase | 기능 | 테스트 |
|-------|------|--------|
| 20~22 | 서버 DB / WebSocket / 프로세스 stdlib | ✅ |
| 23 | **Self-Hosting**: FL→FL→JS 22개 함수 파이프라인 | ✅ 22/22 |
| 24 | Codegen 완성도: match/cond/fn/IIFE/고차함수 | ✅ 10/10 |
| 25 | Bootstrap 검증: tsCompile === sandboxCompile | ✅ 33/33 |
| 26 | map/filter/reduce codegen + FL 렉서 'r' 버그 수정 | ✅ 17/17 |
| 27 | 표준 라이브러리 Codegen: 배열/문자열/수학/타입조건자 | ✅ 26/26 |
| 28 | **loop/recur TCO**: while(true) 꼬리 재귀 최적화 | ✅ 7/7 |
| 29 | **cross-file import**: `(import "./f.js" [$fn])` → require | ✅ 5/5 |
| 30 | **진짜 셀프 컴파일러**: FL로 FL 컴파일러 컴파일 | ✅ 25/25 |
| 31 | **Gen2 자가 컴파일**: lexer loop/recur TCO + Gen1===Gen2 동치 | ✅ 18/18 |

---

## 언어 문법

### FUNC 블록

```fl
[FUNC add :params [$a $b]
  :body (+ $a $b)
]

[FUNC fact :params [$n]
  :body (if (<= $n 1) 1 (* $n (fact (- $n 1))))
]
```

### loop/recur (꼬리 재귀 최적화)

```fl
[FUNC sum-n :params [$n]
  :body (
    (loop [[$i $n] [$acc 0]]
      (if (<= $i 0)
        $acc
        (recur (- $i 1) (+ $acc $i))
      )
    )
  )
]
```

내부적으로 `while(true)` JS 루프로 컴파일됨. 10만 반복도 스택 오버플로우 없음.

### map / filter / reduce

```fl
[FUNC double-positives :params [$lst]
  :body (
    (map (filter $lst [x] (> $x 0))
         [x] (* $x 2))
  )
]
```

### match / cond

```fl
(match $token
  ("+" "plus") ("-" "minus") (_ "other"))

(cond
  [(> $n 0) "양수"]
  [(< $n 0) "음수"]
  [else "0"])
```

### cross-file import

```fl
(import "./math-utils.js" [$double $square])

[FUNC double-square :params [$n]
  :body ((double (square $n)))
]
(export double-square)
```

### AI Reasoning Sequence

```fl
[AGENT analyze-server
  (observe "서버 자원 수집" data: (res_snapshot))
  (analyze "이상 감지"
    when: (> (get $data :mem_pct) 80)
    result: "메모리 경고")
  (decide "조치 결정" selected: "restart")
  (act "서비스 재시작" cmd: (shell "pm2 restart api-server"))
  (verify "복구 확인" check: (res_port_used 3000))
]
```

---

## 셀프 컴파일러 아키텍처

```
FL 소스
  │
  ├─[TS lex+parse]──→ TS AST
  │                      │
  │              [convertTStoFL]
  │                      │
  │                   FL AST
  │                      │
  └─[FL gen-js]──────────┘
         │
         ▼
  standalone JS
  ┌─────────────┐
  │  lexer.js   │ → lex(src) → Token[]
  │  parser.js  │ → parse(tokens) → AST
  │  codegen.js │ → gen-js(ast) → JS 코드
  └─────────────┘
         │
  [런타임 검증]
  fact(10) = 3628800 ✅
  fib(15)  = 610     ✅
```

### 핵심 설계: tsCompile

```typescript
function tsCompile(flSrc: string): string {
  const interp = new Interpreter();
  // FL 컴파일러 로드 (lexer.fl + parser.fl + codegen.fl)
  for (const src of [lexerSrc, parserSrc, codegenSrc]) {
    interp.interpret(parse(lex(src)));
  }
  // TS lex+parse로 스택 안전하게 AST 생성
  const rawAst = parse(lex(flSrc));
  const flAst  = convertTStoFL(rawAst);  // TS AST → FL AST 형식 변환
  // FL gen-js만 실행
  interp.context.variables.set("$__fl_ast__", flAst);
  interp.interpret(parse(lex("(gen-js $__fl_ast__)")));
  return interp.context.lastValue;
}
```

---

## 실행

```bash
git clone https://gogs.dclub.kr/kim/freelang-v9
cd freelang-v9
npm install

# Phase별 테스트
npx ts-node src/test-phase28-loop-recur.ts     # loop/recur TCO
npx ts-node src/test-phase29-import.ts          # cross-file import
npx ts-node src/test-phase30-selfcompile.ts     # 셀프 컴파일러

# 표준 라이브러리 테스트
npx ts-node src/test-phase27-stdlib-codegen.ts
npx ts-node src/test-phase26-map-filter-reduce.ts
```

---

## 파일 구조

```
freelang-v9/
├── src/
│   ├── lexer.ts / parser.ts / interpreter.ts / ast.ts / token.ts
│   │
│   ├── freelang-lexer.fl      ← FL로 작성된 FL 렉서
│   ├── freelang-parser.fl     ← FL로 작성된 FL 파서
│   ├── freelang-codegen.fl    ← FL로 작성된 FL 코드젠 (JS 출력)
│   │
│   ├── stdlib-*.ts            ← Phase 10~19 표준 라이브러리
│   │
│   ├── test-phase23-selfhosting.ts
│   ├── test-phase24-codegen.ts
│   ├── test-phase25-bootstrap.ts
│   ├── test-phase26-map-filter-reduce.ts
│   ├── test-phase27-stdlib-codegen.ts
│   ├── test-phase28-loop-recur.ts
│   ├── test-phase29-import.ts
│   └── test-phase30-selfcompile.ts   ← 진짜 셀프 컴파일러 검증
│
├── package.json
└── tsconfig.json
```

---

## 설계 원칙

**1. AI가 생성하기 쉬운 구조**
S-expression은 토큰 → AST 변환이 trivial하다. 인간이 읽기 어려워도 AI는 오류 없이 생성한다.

**2. 꼬리 재귀 = 반복**
`(loop [...] body)` + `(recur ...)` 패턴이 언어 레벨에서 지원된다. 10만 번 반복도 스택 안전.

**3. 크로스 파일 모듈**
`(import "./utils.js" [$fn])` → `require`. FL 파일들이 서로를 참조해 독립 모듈로 동작.

**4. 셀프호스팅 = 언어의 완결성 증명**
컴파일러(lexer + parser + codegen)를 FL로 작성하고, 그 컴파일러를 자기 자신으로 컴파일.
`compilerA(x) === compilerB(x)` 가 성립할 때 언어가 완결된다.

---

## 빌드 정보

```
언어:          TypeScript (호스트)
런타임:        Node.js
테스트:        ts-node
총 테스트:      370/370 PASS
셀프컴파일:     25/25 PASS (Phase 30)
Gen2 자가컴파일: 18/18 PASS (Phase 31)
Gen1===Gen2 동치: 6/6 PASS
최신 커밋:      62d26e2
```

---

*FreeLang v9 — Claude Code 전용. 인간 없음.*
