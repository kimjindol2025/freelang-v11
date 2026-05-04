# Phase G 후속 — 진짜 자동이 되려면 wrapper가 필요했다

**2026-05-04** · 같은 날 후속편. Phase G의 한계를 직시하고 `freelang-smart` wrapper로 진짜 자동 hint를 구현한 기록.

---

## 출발점: "반쯤 좋아진" 자평

오전에 v11.4.0 (Phase G) 푸시 후, 결과를 솔직히 평가했다.

```
좋아진 것:
  ✅ try-call (Result)        — 진짜 유용
  ✅ http-get-json            — 한 줄 헬퍼

안 좋아진 것:
  ❌ smart-map은 사용자가 골라써야 함 (헬퍼지 자동 아님)
  ❌ console_log 호출 시 자동으로 println 추천 안 됨
  ❌ (let [$x 1] ...) 여전히 깨짐
```

블로그에는 *"언어가 자신의 실수를 방어한다"* 고 썼는데, 정직하게는 *"옵션이 추가된 언어"* 였다.

진짜 자동이 되려면 **에러 발생 시점에 hint가 자동 출력**되어야 한다.

---

## 의사결정: bootstrap 패치 vs wrapper

진짜 자동을 만드는 방법 두 가지:

| 방식 | 장점 | 단점 |
|-----|------|------|
| `bootstrap.js` 직접 패치 | 모든 사용 경로에 적용 | 757KB minified — 위험도 ↑↑ |
| `bin/freelang-smart` wrapper | 안전, 옵션 | 사용자가 wrapper 호출해야 |

선택: **wrapper**. bootstrap 패치는 회귀 위험이 너무 크다. wrapper는 코드 격리 + alias 한 번이면 끝.

```bash
alias fl=freelang-smart
fl app.fl   # 끝
```

---

## 구현: 3-stage 파이프라인

```
input.fl
   │
   ▼
[Stage 1] preprocessing — 안전한 자동 수정
   ├─ (let [$x 1] body) → (let [[$x 1]] body)
   └─ 향후: [FUNC] → defn 등
   │
   ▼
[Stage 2] node bootstrap.js run <tmpfile>
   ├─ stdout: 그대로 inherit
   └─ stderr: pipe로 캡처 + 즉시 mirror
   │
   ▼
[Stage 3] postprocessing — 에러 패턴 → hint
   ├─ "Function not found: X" → suggest-fn(X)
   ├─ "Unexpected character '@'" → atom 안내
   ├─ "let 파싱 오류" → 이중괄호 가이드
   └─ "[FUNC] deprecated" → defn 변환 가이드
```

핵심 의사결정 3개:

### 1. preprocessing은 "안전한 변환만"

`(map arr fn)` → `(map fn arr)` 같은 자동 변환은 **하지 않음**.
이유: arr 변수에 숫자 배열인지 fn 배열인지 정적으로 알 수 없음 → 잘못 변환하면 silent bug.

대신 **명백히 안전한 것만**:
- 단일 let 바인딩의 이중괄호화 (정규식으로 100% 안전)

### 2. stderr 처리는 "mirror + capture"

```js
const child = spawn("node", [bootstrapPath, "run", file], {
  stdio: ["inherit", "inherit", "pipe"],
});

let stderrBuf = "";
child.stderr.on("data", (chunk) => {
  const s = chunk.toString();
  stderrBuf += s;          // 패턴 분석용 캡처
  process.stderr.write(s); // 즉시 mirror (사용자에게 실시간 피드백)
});
```

원본 에러는 그대로 보여주고, 추가로 hint를 덧붙인다. 에러 정보를 *대체*하지 않고 *보강*.

### 3. 패턴 매칭은 단순한 정규식

bootstrap.js의 에러 메시지를 파싱해서 hint를 만든다.

```js
const fnMatch = stderr.match(/Function not found:\s*([a-zA-Z_][\w.\-?!]*)/);
if (fnMatch) {
  const name = fnMatch[1];
  const sims = suggestFn(name);   // alias 우선, 없으면 levenshtein
  // ...
}
```

이게 깨지는 한 가지 케이스를 시연 중에 발견:

> `console.log`의 dot(.)이 `\w`에 안 매치돼서 hint가 안 떴다.
> → `[\w.\-?!]*` 로 dot 추가 (commit `69337d46`)

---

## 검증: 6 시나리오

```bash
$ freelang-smart /tmp/t.fl

[a] (console.log "x")
    💡 'console.log'은(는) 없습니다. 대신 println 사용:
       (println value)

[b] (printlm "x")    ← 오타 (n이 m으로)
    💡 혹시 이 함수를 의미하셨나요?
       → (println ...)

[c] (push [1 2 3] 4)
    [1, 2, 3, 4]      ← 정상 작동 (실제 함수, wrapper 간섭 없음)

[d] (let [$x 99] (* $x 2))
    [자동 수정] ✓ let 단일 바인딩 자동 이중괄호화: $x
    198

[e] (println @x)
    💡 @변수 문법은 지원되지 않습니다.
       → atom 사용: (define x (atom 0)) (deref x) (reset! x 1)

[f] (raise "oops")
    💡 'raise'은(는) 없습니다. 대신 error 사용:
       (error "msg")
```

**6/6 처리.**

`push`처럼 실제로 작동하는 함수는 wrapper가 간섭하지 않는다 — 패턴 매치 안 되면 그냥 통과.

---

## 비교: stdlib-helpers vs freelang-smart

| 동작 | `stdlib-helpers` (Phase G) | `freelang-smart` (후속) |
|------|---------------------------|-------------------------|
| 호출 방식 | 사용자가 명시적 호출 | 자동 (코드 그대로) |
| `(suggest-fn "console_log")` | `["println"]` 반환 | — |
| `(console_log "x")` 작성 시 | 그냥 에러 | 자동 hint 출력 |
| `(let [$x 1] body)` | 그냥 에러 | 자동 수정 후 실행 |
| 적용 범위 | 사용자 코드 내부 | 모든 실행 경로 |
| 위험도 | 0 (헬퍼 추가만) | 낮음 (외부 wrapper) |

둘 다 가치 있다. helpers는 사용자가 *명시적으로* 안전 호출을 원할 때, smart wrapper는 *습관적인 실수*를 잡을 때.

---

## 한계 (정직)

freelang-smart도 만능은 아니다.

1. **에러 메시지 한국어/영어 의존** — 메시지 포맷 바뀌면 정규식 깨짐. 이상적으로는 ErrorCode가 노출되어야.
2. **preprocessing은 정규식 한계** — 중첩된 let 같은 케이스는 못 잡음.
3. **장시간 실행 프로세스 (서버)** — wrapper가 stderr를 파이프로 받으니 백그라운드 운영에 부적합. 서버는 직접 `node bootstrap.js run`이 더 깔끔.

→ 진짜 끝까지 가려면 결국 bootstrap.js의 에러 발생 지점에 hint를 통합해야 함. 그건 Phase H 후보.

---

## 한 줄 정리 (오전 글 보정)

> 오전에 *"언어가 자신의 실수를 방어한다"* 고 썼는데, 정확히는:
>
> - **stdlib-helpers**: 사용자가 안전한 함수를 *고를 수 있다*
> - **freelang-smart**: 사용자가 평소 코드를 써도 *언어가 알려준다*
>
> 둘이 합쳐졌을 때 비로소 "자기를 설명하는 언어"라고 부를 수 있다.

**커밋**: `31f3f563` (wrapper) + `69337d46` (regex fix)
**Gogs**: https://gogs.dclub.kr/kim/freelang-v11
