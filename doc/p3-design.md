# P3 설계 개요 (구현 전 계획만)

**상태**: 설계 단계 (구현 금지)  
**대상**: Closure/Recur 완성 후  
**예상 시작**: 2주 후

---

## P3 목표

P2-Core의 "의미론적 동치성"을 유지하면서 **성능 최적화 + 완전성**

```
P1: Semantic correctness ✅
P2: Native backend        ✅
P3: Completeness + Perf  ⏳
```

---

## P3-A: Closure Environment Model

**문제**: closure 환경이 malloc/free 관리 필요

**옵션**:

### Option 1: Stack Allocation (고정 크기)
```c
typedef struct {
  FLValue env[8];  /* 최대 8개 캡처 변수 */
  uint32_t env_len;
} Lambda_1_Env;
```

**Pro**: 빠름, 메모리 안전  
**Con**: 크기 제한

### Option 2: Arena Allocator (작은 환경용)
```c
typedef struct {
  FLValue* env;      /* arena 할당 */
  uint32_t env_len;
} Lambda_Env;
```

**Pro**: 탄력적, 메모리 풀 재활용  
**Con**: 추가 복잡도

### Option 3: Reference Counting
```c
typedef struct {
  int refcount;
  FLValue* env;
  uint32_t env_len;
} Lambda_Env;
```

**Pro**: 자동 메모리 관리  
**Con**: RC 오버헤드, 순환 참조 위험

---

## P3-B: Higher-Order Function ABI

**문제**: map/filter/reduce가 고급 루프 최적화 필요

**관찰**: 현재 fl_map_fn, fl_filter_fn, fl_reduce_fn 함수 존재

```bash
$ grep -n "fl_map_fn\|fl_filter_fn\|fl_reduce_fn" runtime/runtime.h
```

**설계**:
- Closure ABI 통합
- Inlining 기회 식별
- Vectorization potential

---

## P3-C: AOT/JIT Boundary

**문제**: 모든 것을 미리 C로 컴파일할 수 없음 (dynamic code generation)

**아이디어**: Tier 1/Tier 2 런타임

```
Tier 1 (JS): 빠른 시작, 느린 실행
Tier 2 (C):  느린 시작, 빠른 실행

선택 기준:
- REPL / 교육용 → JS
- 프로덕션 / 성능 중심 → C
```

**설계**:
```c
enum CompilationTier {
  TIER_JS,        /* bootstrap.js */
  TIER_C_AOT,     /* 미리 컴파일된 C */
  TIER_C_JIT      /* 실행 중 컴파일 (미래) */
};

FLValue fl_execute(const char* code, enum CompilationTier tier);
```

---

## 구현 순서 (제안)

### Phase 1: Closure Support
1. closure-gap 해결
2. closure+recur 테스트
3. parity 재검증

### Phase 2: Completeness
1. mutual recursion (CPS 또는 trampolining)
2. higher-order function (현재 partial)
3. advanced features (future)

### Phase 3: Performance
1. Arena allocator 도입
2. Inlining 기회 식별
3. 벤치마크 수립

### Phase 4: Tier 2 Runtime
1. Tier 1/2 분리
2. 동적 컴파일 지원 (미래)

---

## 성능 목표 (P3 완료 후)

| 벤치마크 | P2-Core | P3 목표 | 비율 |
|---------|---------|--------|------|
| Loop(100k) | JS 50ms | C 5ms | 10x |
| Fib(30) | JS 200ms | C 20ms | 10x |
| Vec sum(1M) | JS 100ms | C 10ms | 10x |

---

## 주의사항

### 코드 품질
- P2-Core의 semantic-test 회귀 방지
- 모든 최적화는 parity-test 통과 후

### 메모리 안전성
- malloc/free 최소화 또는 arena 사용
- Valgrind로 메모리 누수 확인

### 디버깅 가능성
- 최적화 전 원본 코드 보관 (debug mode)
- Source map 지원 (향후)

---

## Decision Points (아직 안 함)

- [ ] Stack vs Arena vs RC 선택
- [ ] Closure capture 크기 제한 (고정 vs 동적)
- [ ] Tier 1/2 기본값 (JS vs C)
- [ ] 성능 벤치마크 도구 (현재: fl-bench/run.js)

---

## 참고 자료

- closure-gap.md
- recur-gap.md
- STDLIB_REFERENCE.md (current ABI)

---

**상태**: 설계 단계  
**다음**: closure-gap 해결 후 재검토
