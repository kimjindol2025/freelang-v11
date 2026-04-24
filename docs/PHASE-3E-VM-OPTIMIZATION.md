# Phase 3-E: VM opt-in 최적화 — 성능 1.5배 향상

**목표**: 단순 산술식을 VM에서 직접 실행해 성능 1.5배 향상  
**범위**: 벤치마크 측정 → VM 경로 구현 → 성능 검증  
**예상**: 2주 (설계 + 구현 + 최적화)

---

## 📊 현재 성능 기준선

### 벤치마크 대상 (self/bench/*.fl)

| 파일 | 내용 | 현재 시간 | 목표 |
|------|------|---------|------|
| hello.fl | 기본 | - | - |
| tiny.fl | 상수 42 | - | - |
| fib30.fl | 재귀 | ~5-10ms | <7ms |
| sum-5k.fl | 루프 합계 | - | - |
| math.fl | 산술 | - | <50μs |

---

## 🔧 VM opt-in 전략

### Phase 1: 식별 (Identification)

**최적화 대상** (VM에서 수행 가능):
- 상수 + 변수: `(+ 1 2)`, `(* x y)`
- 간단한 연산: `(+ (+ 1 2) 3)`, `(* 2 (- x 1))`
- 루프의 누적: `loop` 내 산술 연산

**제외 대상** (해석기 필요):
- 함수 호출: `(fn-call x)`, `(map f lst)`
- 조건부: `(if cond ...)`
- I/O: `(console/log ...)`, `(file-write ...)`

### Phase 2: 코드 생성 (Codegen)

현재 (해석기 경로만):
```javascript
// bootstrap: (+ 1 2) 
const result = (() => {
  const env = {...};
  return interp({op: '+', args: [1, 2]}, env);
})();
```

최적화 후 (VM 경로 추가):
```javascript
// VM: (+ 1 2) → 직접 계산
const result = (() => {
  // Fast path: 산술식 인식
  if (isArithmetic(node)) {
    return vmEval(node); // 1 + 2 = 3 (바로 계산)
  }
  // Slow path: 복잡한 로직
  return interp(node, env);
})();
```

### Phase 3: VM 엔진 (Engine)

```typescript
// src/vm.ts (신규)
class VMEvaluator {
  eval(node: ASTNode): any {
    if (node.kind === 'literal') return node.value;
    if (node.kind === 'variable') return env[node.name];
    
    // 산술 연산 (빠른 경로)
    if (node.op === '+' && isSimple(node.args)) {
      return node.args[0] + node.args[1];
    }
    if (node.op === '*' && isSimple(node.args)) {
      return node.args[0] * node.args[1];
    }
    // ...
    
    // Fallback: 해석기
    return interpreter.eval(node);
  }
}
```

---

## 📈 성능 목표

### 현재 (해석기만)
```
fib(30): 832040
time: 8.2ms
```

### 목표 (VM opt-in)
```
fib(30): 832040
time: 5.5ms  (← 1.5배 빠름, 33% 개선)
```

---

## 📋 구현 일정

| 단계 | 일정 | 산출물 |
|------|------|--------|
| 1. 벤치마크 기준선 | 1d | benchmark-baseline.json |
| 2. VM 엔진 설계 | 1d | src/vm.ts 구조 |
| 3. VM 구현 (산술) | 3d | +, -, *, /, % |
| 4. Codegen 연동 | 2d | isArithmetic() + vmEval() |
| 5. 성능 측정 | 2d | benchmark-optimized.json |
| 6. 프로파일링 및 튜닝 | 3d | hotspot 최적화 |
| **총 소요** | **2주** | **15% ~ 50% 향상** |

---

## 🎯 성공 기준

- [ ] 벤치마크 기준선 측정 (5개 파일)
- [ ] VM 엔진 구현 (기본 산술)
- [ ] fib(30): 8ms → 5.5ms (30% 향상)
- [ ] 기존 테스트 회귀 없음 (639/646 PASS 유지)
- [ ] 복잡한 코드: 성능 저하 없음 (해석기 경로)

---

## 🔍 식별 알고리즘

```typescript
function isArithmetic(node: ASTNode): boolean {
  if (node.kind !== 'sexpr') return false;
  
  const op = node.op;
  if (!['+', '-', '*', '/', '%'].includes(op)) return false;
  
  // 모든 argument가 literal 또는 variable인지 확인
  return node.args.every(arg =>
    arg.kind === 'literal' || 
    arg.kind === 'variable'
  );
}
```

---

## 🧪 테스트 계획

### 1. 정확성 테스트
```fl
(+ 1 2)          ; VM: 3, Interp: 3 → PASS
(* 3 (- 5 2))    ; VM: 9, Interp: 9 → PASS
(loop [i 0 acc 0] (if (>= i 3) acc (loop (+ i 1) (+ acc i))))
                 ; VM loop: 3, Interp: 3 → PASS
```

### 2. 성능 테스트
```bash
npm run bench -- --vm-on
npm run bench -- --vm-off  # 비교용
```

### 3. 회귀 테스트
```bash
npm test  # 기존 테스트 모두 통과
```

---

## 💡 최적화 포인트

### 1단계 (기본, 30% 향상)
- 단순 산술: `(+ 1 2)` → 직접 계산
- 변수 참조: `(+ x y)` → 환경 lookup 후 계산

### 2단계 (중급, 40% 향상)
- 중첩 산술: `(+ (+ 1 2) 3)` → 트리 직접 평가
- loop 누적: 루프 body가 순수 산술 → VM 경로

### 3단계 (고급, 50% 향상)
- JIT: 같은 식 반복 실행 → 컴파일 캐싱
- 인라인: 단순 함수 → 인라인 확장

---

## 🚀 다음 Phase

- **Phase 4**: stage1 자가호스팅 복구 (파라미터 버그 수정)
- **Phase 5**: 배포 및 문서화

---

**준비 상태**: 설계 완료, 벤치마크 대기 중 ✅
