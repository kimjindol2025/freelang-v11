# FreeLang v11 — Experiments Spec

**계층**: Layer 5 (불안정, 자주 변경)  
**원칙**: 아직 안정화 전이거나 자주 바뀌는 기능  
**위치**: `src/experiments/`

> **경고**: 이 계층의 API는 버전 간 변경 가능. 프로덕션 사용 자제.

---

## Phase 121-130: Consensus & Multi-Agent

### Phase 121: CONSENSUS
```lisp
(consensus-create {:threshold 0.7})
(consensus-vote "agent-1" "approve")
(consensus-result)
```

### Phase 122: DELEGATION
```lisp
(delegate-assign "task-001" "agent-worker")
(delegate-status "task-001")
```

### Phase 123: VOTING
```lisp
(vote-create "option-a" "option-b" "option-c")
```

### Phase 125: SWARM
```lisp
(swarm-spawn "particle-1")
```

---

## Phase 131-140: Evolution & Self-Improvement

### Phase 131: EVOLVE
```lisp
(evolve-numbers population fitness-fn config)
(evolve-strings population fitness-fn config)
```

### Phase 134: FITNESS
```lisp
(fitness-score individual criteria)
(rank-items items fitness-fn)
```

### Phase 135: GENERATION
```lisp
(run-generation population config)
```

### Phase 138: BENCHMARK-SELF
```lisp
(bench fn-name fn iterations)
(bench-compare fn1 fn2 iterations)
```

### Phase 137: REFACTOR-SELF
```lisp
(refactor-analyze code)
(refactor-suggest analysis)
(refactor-apply suggestion)
```

---

## Phase 141-149: High-Order AI Reasoning

### Phase 141: WORLD-MODEL
```lisp
(world-observe {:entity "user" :action "login" :context ctx})
(world-predict {:entity "user" :steps 3})
(world-current-state)
```

### Phase 142: CAUSAL
```lisp
(causal-add-node {:id "A" :name "원인 A"})
(causal-add-edge {:from "A" :to "B" :strength 0.8})
(causal-explain "B")
(causal-chains "A" "B")
(causal-why "A" "B")
```

### Phase 143: COUNTERFACTUAL
```lisp
(cf-create {:base-scenario ctx})
(cf-what-if scenario {:change "..."})
(cf-compare original counterfactual)
```

### Phase 144: PREDICT
```lisp
(predict-trend data {:steps 5})
(predict-classify input model)
```

### Phase 145: EXPLAIN
```lisp
(explain-decision model input)
(explain-feature-importance model)
```

### Phase 146: ALIGN
```lisp
(align-check action goal values)
(align-score action)
```

### Phase 147: ETHICS-CHECK
```lisp
(ethics-check action {:framework "utilitarian"})
(ethics-passed? result)
```

### Phase 148: CURIOSITY
```lisp
(curiosity-identify-gap knowledge)
(curiosity-explore gap)
```

### Phase 149: WISDOM
```lisp
(wisdom-judge situation)
(wisdom-from-experience case)
```

---

## Phase 113-120: Foundation Reasoning

### Phase 113: DEBATE
```lisp
(debate-start "주제")
(debate-argue "side-a" "논거")
(debate-conclude)
```

### Phase 115: META-REASON
```lisp
(meta-reason-analyze "문제")
(meta-reason-strategy problem)
```

### Phase 116: BELIEF
```lisp
(belief-update "p(A)" 0.7)
(belief-query "p(A|B)")
```

### Phase 117: ANALOGY
```lisp
(analogy-find source target)
(analogy-apply mapping)
```

### Phase 118: CRITIQUE
```lisp
(critique-review code)
(critique-severity findings)
```

### Phase 119: COMPOSE-REASON
```lisp
(compose-reason step1 step2 step3)
```

### Phase 120: COGNITIVE
```lisp
;; Phase 111-119 통합 아키텍처
(cognitive-solve "문제" {:strategy "meta-reason"})
```

---

## lazy 위임 구조

실험 ops는 `eval-builtins-experiments.ts`를 통해 lazy 위임됨:

```typescript
// eval-builtins.ts
const expResult = evalExperimentBuiltin(op, args, callFn);
if (expResult !== null) return expResult;
```

**Phase 113-140** (debate, belief, analogy, ..., evolve, benchmark 등)은  
아직 eval-builtins.ts에서 직접 import됨 (완전 lazy 위임 대기 중).

---

## 안정성 등급

| Phase 그룹 | 안정성 | 메모 |
|-----------|--------|------|
| 141-149 | 🟡 실험 | lazy 위임 완료 |
| 121-130 | 🟡 실험 | 일부 lazy 위임 |
| 131-140 | 🔴 불안정 | eval-builtins 직접 import |
| 113-120 | 🔴 불안정 | eval-builtins 직접 import |
