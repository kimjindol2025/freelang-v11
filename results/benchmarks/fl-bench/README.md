# FL-Bench — FreeLang AI 평가 벤치마크

**목적**: AI 모델(Claude/GPT/...)이 FreeLang으로 얼마나 정확한 코드를 생성하는지 표준 측정.

## 구조

```
benchmarks/fl-bench/
├─ tasks/         # 표준 task 정의 (.json)
├─ results/       # 평가 결과 (.json, 모델별)
├─ run.js         # 평가 실행기
└─ README.md      # 이 문서
```

## 사용

### 1. Reference 검증 (인프라 sanity check)

각 task의 `reference_solution`이 실제로 통과하는지 확인:

```bash
node benchmarks/fl-bench/run.js --reference --label=reference
```

기대: 모든 task PASS (인프라가 정상).

### 2. AI 평가

AI가 만든 .fl 파일을 디렉토리에 저장 후:

```bash
# my-claude/
#   T01_arithmetic_basic.fl
#   T02_list_filter.fl
#   ...

node benchmarks/fl-bench/run.js --solution-dir=./my-claude --label=claude-opus-4.7
```

결과는 `results/claude-opus-4.7-{timestamp}.json`에 저장.

### 3. 단일 task

```bash
node benchmarks/fl-bench/run.js --reference --task=T01
```

### 4. 수동 입력 (대화식)

```bash
node benchmarks/fl-bench/run.js --manual
# task prompt가 stderr로 출력되면 stdin에 코드 붙여넣고 Ctrl+D
```

## Task 추가

`tasks/T{NN}_{name}.json` 형식:

```json
{
  "id": "T06_my_task",
  "category": "string",
  "difficulty": "easy|medium|hard",
  "prompt": "AI에게 줄 자연어 설명",
  "validation": {
    "type": "stdout_contains|stdout_match|stdout_regex",
    "expected": "..."
  },
  "reference_solution": "검증된 정답 FL 코드",
  "tags": ["..."]
}
```

## 평가 흐름

각 task에 대해:
1. 솔루션 코드 로드 (reference 또는 AI 출력)
2. `scripts/ai-self-verify.js --json --stdin`로 자동 검증 + 실행
   - defun→defn, ==→= 자동 normalize
   - bootstrap.js 컴파일+실행
   - ErrorCode 추출
3. validation 규칙으로 stdout 비교
4. PASS/FAIL/SKIP 분류

## AI 통합 시나리오

```bash
# 1. AI에게 시스템 프롬프트 + task prompt 전달
SYSTEM_PROMPT=$(cat docs/AI_SYSTEM_PROMPT_MINI.md)
TASK_PROMPT=$(jq -r .prompt benchmarks/fl-bench/tasks/T01_*.json)

# 2. AI 호출 (예: claude API)
RESPONSE=$(claude --system "$SYSTEM_PROMPT" "$TASK_PROMPT")

# 3. 코드 추출 + 평가
echo "$RESPONSE" | extract-code-block > my-output/T01_arithmetic_basic.fl
node benchmarks/fl-bench/run.js --solution-dir=./my-output --label=claude-3.5
```

## 사업화 포인트

- 모델별 성공률을 cross-comparison: "Claude Opus 4.7: 92%, GPT-4: 78%"
- 카테고리별 약점 식별: "GPT-4는 nil-safe 22%만 통과"
- FreeLang 자체 개선 우선순위: "T05 recursion fail rate 40% → 학습 자료 보강"

## 현재 task (100개 — Phase 2 완료, 100% PASS)

카테고리별 분포:

| 카테고리 | 갯수 | 대표 task |
|----------|------|----------|
| arithmetic | 5 | gcd, fib, pow, factorial, sum |
| list | 12 | map, reduce, sort, take, chunk, flatten, unique |
| string | 11 | upper/lower, split, concat, replace, repeat, trim, index-of, join |
| map/json | 10 | get, keys, merge, set, entries, get-or |
| file-io | 5 | read/write, exists, append, json round-trip |
| error-handling | 4 | fl-try, safe-divide, sign, default |
| pattern-match | 4 | describe, grade, classify, validate |
| state-machine | 5 | traffic light, counter, door, session, event reduce |
| higher-order | 4 | compose, threading ->/->> |
| recursion | 2 | factorial, sum-to |
| binding | 1 | let |
| data-transform | 11 | chain, users, average, pipeline, distinct, max-by, sum-by |
| module | 1 | use json |
| **regex** | 5 | match, extract, replace, split, email |
| **time** | 1 | now_unix |
| **math** | 4 | abs, min/max, sqrt, floor/ceil |
| **algorithm** | 5 | fizzbuzz, palindrome, prime, count-digits, sum-digits |
| **functional** | 5 | closure, n-times, partial, compose-chain, callback |

**난이도 분포**: easy 28 / medium 51 / hard 21

**전체 reference 검증**: 100/100 PASS (100%, `--label=reference`).
**카테고리**: 18종.

기존 50개 (Phase 1) + 신규 50개 (Phase 2: regex, time, math, algorithm, functional + 고급 list/string/map 추가).

**제외 카테고리** (외부 의존):
- DB (sqlite/postgres/mariadb) — 환경 필요
- HTTP (실제 네트워크) — flaky
- async/await — Promise 완전 검증 어려움
- defstruct/match — 미검증 기능

추후 확장 시: HTTP stub 활용, async parallel/race 단순 케이스, FSM 복잡 시나리오.
