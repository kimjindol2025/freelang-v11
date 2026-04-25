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

## 현재 task (5개 MVP)

| ID | 카테고리 | 난이도 | 핵심 |
|----|---------|--------|------|
| T01_arithmetic_basic | arithmetic | easy | defn + (+) |
| T02_list_filter | list | easy | filter + even? |
| T03_string_reverse | string | medium | string + recursion |
| T04_nil_safe_get | error-handling | medium | get-or 활용 |
| T05_recursion_factorial | recursion | medium | if + 재귀 |

추후 50개로 확장 (state machine / async / pattern match / DB 등).
