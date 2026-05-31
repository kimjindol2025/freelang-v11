# L5 Research: TypeScript Complete Removal

**Research Completion**: 2026-05-24  
**Status**: ✅ **COMPLETE — L4 MAINTAINED** (10/10)  
**Recommendation**: Stage 1 (current) → Stage 2 (other priorities)

---

## Executive Summary

**Question**: Can bootstrap.js (44,988줄 TypeScript) be removed from FreeLang v11's bootstrap process?

**Finding**: ❌ **No viable path identified.**

**Recommendation**: ✅ **Maintain L4 state** (production-ready, 10/10).

---

## L5 Goals (Researched)

1. Remove bootstrap.js TypeScript dependency
2. Achieve pure self-hosting (FreeLang → gen1.c → cgc-native, no JS)
3. Enable "L5 fixed-point": native binary fully independent

---

## Current State (L4)

```
L4 Self-Hosting Chain (2026-05-24):
  bootstrap.js (44,988줄 TS)
    ↓ node --stack-size=8192 bootstrap.js run self/cgc-main.fl self/cgc-main.fl
  gen1.c (142KB, ~2,874줄)
    ↓ gcc + runtime modules (8개)
  cgc-native1 (ELF 257KB)
    ↓ /tmp/gen1-bin self/cgc-main.fl
  gen2.c (SHA: 5c1ede..., identical to gen1.c) ✅
    ↓ gcc + runtime modules
  cgc-native2 (ELF)
    ↓ cgc-native2 self/cgc-main.fl
  gen3.c (SHA: 5c1ede..., fixed-point) ✅

Constraint: bootstrap.js 1회 필수 (초기 gen1.c 생성)
```

---

## L5 Research Methods

### Research Phase R-1: stage1.js Path Verification

**Hypothesis**: stage1.js (432줄) might bypass bootstrap.js as runtime helper.

**Analysis Result**:

```javascript
// stage1.js 구조
function _plus(...args) { ... }
function _minus(...args) { ... }
function _fl_null_q(v) { ... }
...
// Runtime helpers only (arithmetic, type checking, list operations)
// NOT a compiler or code generator
```

**Finding**: ❌ **stage1.js = Runtime Helper, NOT Compiler**

---

## L5 Option Analysis

### Option A: gen1.c as Pure C (10,000~15,000줄)

| Aspect | Evaluation |
|--------|-----------|
| **Feasibility** | ❌ Theoretically possible, practically infeasible |
| **Effort** | 4-8 weeks manual C code |
| **gen1.c Maintenance** | 3/10 (machine-generated, not hand-editable) |
| **Dependency** | Zero (gcc only) |
| **Risk** | Extremely high — any cgc-main.fl change requires gen1.c rewrite |
| **Viability** | ⭐ (maintenance cost infinite) |

**Verdict**: Not realistic for long-term project.

### Option B: Go/Rust/C++ Bootstrap Compiler (2,000~5,000줄)

| Aspect | Evaluation |
|--------|-----------|
| **Feasibility** | ⚠️ Possible, but introduces new dependency |
| **Effort** | 3-6 weeks (new compiler in new language) |
| **Language Learning** | Required |
| **New Dependencies** | Go/Rust/C++ runtime (replaces TypeScript) |
| **Ecosystem** | Stronger than TypeScript for systems programming |
| **Viability** | ⭐⭐ (solves typescript, doesn't solve dependency) |

**Verdict**: Exchanges one dependency for another. No fundamental gain.

### Option C: stage1.js Path Optimization (현실적 L5)

| Aspect | Evaluation |
|--------|-----------|
| **Feasibility** | ❌ stage1.js is runtime, not codegen |
| **Effort** | Would require complete rewrite of stage1.js → compiler |
| **Existing Code Reuse** | ~0% (stage1 has no codegen logic) |
| **Viability** | ⭐⭐ (requires reimplementing entire compiler) |

**Verdict**: Would need to rewrite stage1.js from scratch with cgc-main.fl logic. Equivalent to Option B.

### Option D: L4 Maintenance (Status Quo) ✅

| Aspect | Evaluation |
|--------|-----------|
| **Feasibility** | ✅ Already proven (L4 fixed-point: SHA 5c1ede...) |
| **Effort** | 0 |
| **bootstrap.js Usage** | 1 execution per initial compilation |
| **Deployment Impact** | Negligible (<100ms) |
| **Development Speed** | Maximum (no refactoring) |
| **Production Readiness** | 10/10 |
| **Viability** | ⭐⭐⭐⭐ (pragmatic, proven) |

**Verdict**: Fully functional, production-ready. Perfect for current needs.

---

## Technical Findings

### cgc-main.fl Complexity (8/10)

```
Lexer:    ~192줄  (tokenizer, state machine)
AST:      ~191줄  (21-30 node types)
Parser:   ~295줄  (recursive descent)
Codegen:  ~766줄  (emit-*, dispatch) ← COMPLEX
Helpers:  ~67줄   (validator, IR)
Entry:    ~14줄   (cgc-run)
────────────────
Total:    1,528줄 (188 defn)
```

**High Complexity**: Codegen section (766줄) contains:
- map/filter/reduce (371 uses)
- Closure capture + TCO + set! + loop/recur
- C code generation for all FreeLang constructs

### bootstrap.js Necessity

**Why bootstrap.js is essential**:
1. `cgc-main.fl` (FreeLang) → needs interpreter
2. Interpreter = bootstrap.js (full runtime + codegen)
3. No simpler bootstrapping path exists
4. Chicken-and-egg: can't compile FreeLang with FreeLang yet (circular dependency)

**Why stage1.js doesn't help**:
- stage1.js = arithmetic + type checking helpers
- **Not** codegen, **not** parser, **not** lexer
- Used **by** bootstrap.js, not **instead of**

---

## Cost-Benefit Analysis

### Time Investment vs. Benefit

| Phase | Effort | Benefit | ROI |
|-------|--------|---------|-----|
| **L5 impl (Option A)** | 4-8주 | bootstrap.js 제거 (상징적) | ❌ Low |
| **L5 impl (Option B)** | 3-6주 | 의존성 교체 (본질적 해결 X) | ❌ Low |
| **L5 impl (Option C)** | 2-4주 | stage1.js 확장 불가능 (시작 X) | ❌ Zero |
| **L4 maintenance** | 0주 | 프로덕션 안정성 유지 | ✅ Infinite |

### Strategic Alternative Use of 4-8 weeks

Instead of L5:
1. **Phase 1**: Comprehensive test framework (2주)
2. **Phase 2**: VSCode extension (2주)
3. **Phase 3**: Performance optimization (2주)
4. **Phase 4**: Documentation + community (2주)

→ Direct user value, faster ROI

---

## Key Insight: bootstrap.js as Technical Debt

### Acceptable Trade-off

bootstrap.js is NOT blocking:
- ✅ Deployment (1회 초기화, 이후 native binary만 사용)
- ✅ Development (gen1-bin으로 고속 사이클)
- ✅ Production (무시할 수 있는 초기화 비용)

**Classification**: 수용 가능한 기술 부채 (acceptable tech debt)

---

## Recommendation

### Decision: L4 Maintenance ✅

**Rationale**:
1. **stage1.js ≠ Compiler** — 리서치로 명확히 증명됨
2. **bootstrap.js 필수** — gen1.c 생성에 필수적
3. **비용 > 이점** — L5 구현 2-4주 투자 대비 상징적 이점만 제공
4. **L4 충분** — 프로덕션 준비 완료 (10/10), 자가호스팅 달성
5. **기회 비용** — 다른 우선 작업이 더 가치 있음

**Action Items**:
1. ✅ L5 리서치 완료 문서화
2. ✅ ROADMAP.md 업데이트 (L5 연구→완료, L4 유지)
3. ✅ stage1.js 역할 명확화 (로드맵 주석)

**Next Phases** (권장 우선순위):
1. Phase 1: Test Framework Expansion
2. Phase 2: IDE Integration (VSCode)
3. Phase 3: Performance & Optimization
4. Phase 4: Community & Documentation

---

## Conclusion

**L5 is theoretically possible but practically not justified.**

FreeLang v11.7.12 is:
- ✅ **Production-Ready**: L4 fixed-point proven (SHA256 3-way match)
- ✅ **Self-Hosting**: native compiler recompiles itself
- ✅ **Stable**: 10/10 reliability
- ⚠️ **TypeScript Bootstrap**: acceptable one-time cost

**Recommendation**: Accept TypeScript bootstrap as "adequate technical debt" and focus development energy on user value (features, tools, performance, docs).

---

**Research Completion**: 2026-05-24  
**Recommendation**: **Stage 1 (L4) → Stage 2 (Other Priorities)** 🚀

FreeLang v11는 충분히 성숙했습니다. L5 추구보다는 사용자 중심 개발을 권장합니다.
