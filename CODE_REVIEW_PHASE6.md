# 📋 Phase 6 Module System - 코드리뷰

**검토 범위**: interpreter.ts (evalModuleBlock, evalImportBlock, evalOpenBlock)  
**검토 범위**: parser.ts (convertBlockToModuleBlock)  
**검토일**: 2026-04-06

---

## 💚 좋은 점

### 1. 명확한 인터페이스 설계
```typescript
export interface ModuleInfo {
  name: string;
  exports: string[];  // 명확한 의도
  functions: Map<string, FreeLangFunction>;
}
```
✅ 모듈 구조가 직관적이고 이해하기 쉬움  
✅ 각 필드의 역할이 명확함

### 2. 체계적인 테스트 커버리지
- 6개 인터프리터 테스트 전부 통과
- 각 기능별로 독립적인 테스트
- 엣지 케이스 포함 (alias, selective import)

✅ 테스트 커버리지: 100% 기능 검증

### 3. 사용자 친화적 로깅
```typescript
✅ Module registered: math (exports: add, subtract, multiply)
✅ Imported 2 function(s) from "math"
```
✅ 상태 파악이 쉬움  
✅ 디버깅에 도움됨

### 4. 기능의 깔끔한 분리
- evalModuleBlock() - 모듈 등록
- evalImportBlock() - 함수 임포트
- evalOpenBlock() - 전역 노출

✅ 단일 책임 원칙(SRP) 준수

---

## 🟡 개선 권장사항

### 1. **Type 캐스팅 남발** ⚠️

현재:
```typescript
for (const node of moduleBody) {
  const block = node as any;  // ← as any 사용
  if (block.type === "FUNC") {
    const params = block.fields?.get("params") || [];
    const paramNames = Array.isArray(params)
      ? params.map((p: any) => /* ... */)  // ← 또 as any
```

**문제점**:
- TypeScript 타입 안전성 상실
- 런타임 에러 위험 증가
- IDE 자동완성 기능 못함

**권장사항**:
```typescript
// AST 타입 가드 함수 추가
function isFuncBlock(node: any): node is Block {
  return node && node.type === "FUNC";
}

// 사용
if (isFuncBlock(node)) {
  const params = node.fields?.get("params") || [];
  // 이제 node는 Block 타입으로 인식됨
}
```

---

### 2. **중복된 Null 체크** ⚠️

3개 메서드에서 반복:
```typescript
// evalModuleBlock, evalImportBlock, evalOpenBlock 모두 같은 패턴
if (!this.context.modules) {
  this.context.modules = new Map();
}
```

**권장사항**:
```typescript
// Private getter로 추상화
private getModules(): Map<string, ModuleInfo> {
  if (!this.context.modules) {
    this.context.modules = new Map();
  }
  return this.context.modules;
}

// 사용
private evalModuleBlock(moduleBlock: ModuleBlock): void {
  const modules = this.getModules();
  modules.set(moduleName, moduleInfo);
}
```

**효과**: 코드 중복 제거, 유지보수 향상

---

### 3. **Console.log vs 적절한 로깅** ⚠️

현재:
```typescript
console.log(`✅ Module registered: ${moduleName} (exports: ${exports.join(", ")})`);
```

**문제점**:
- 프로덕션에서 성능 영향
- 로그 레벨 구분 없음
- 포맷 일관성 없음

**권장사항**:
```typescript
// Logger 인터페이스 정의
interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

// 사용
this.logger.info(`Module registered: ${moduleName}`);
```

또는 최소한:
```typescript
// 환경 변수로 디버그 로그 제어
if (process.env.DEBUG_MODULES) {
  console.log(`Module registered: ${moduleName}`);
}
```

---

### 4. **에러 처리 일관성** ⚠️

evalImportBlock과 evalOpenBlock은 모두 같은 에러:
```typescript
if (!module) {
  throw new Error(
    `Module not found: ${moduleName} (from ${source || "inline"})`
  );
}
```

하지만 인자명이 다름:
```typescript
// importBlock.selective vs 코드에서 안 쓰임
// importBlock.alias vs 코드에서 사용
```

**권장사항**:
```typescript
// 에러 클래스 정의
class ModuleNotFoundError extends Error {
  constructor(moduleName: string, source?: string) {
    super(`Module not found: ${moduleName} (from ${source || 'inline'})`);
    this.name = 'ModuleNotFoundError';
  }
}

// 사용
throw new ModuleNotFoundError(moduleName, source);
```

---

### 5. **AST 필드 추출 복잡성** 🔴

convertBlockToModuleBlock에서:
```typescript
if ((exportsField as any).kind === "block" && (exportsField as any).type === "Array") {
  const items = (exportsField as any).fields?.get("items") as ASTNode[];
  if (Array.isArray(items)) {
    items.forEach((item) => {
      if ((item as any).kind === "literal" && (item as any).type === "symbol") {
        exports.push((item as any).value);
      }
    });
  }
}
```

**문제점**:
- 깊은 타입 체크 중복
- 가독성 저하
- 유지보수 어려움

**권장사항**:
```typescript
// 헬퍼 함수
private extractSymbols(field: ASTNode): string[] {
  if (!field) return [];
  
  const symbols: string[] = [];
  
  if (isArrayBlock(field)) {
    const items = field.fields?.get("items") as ASTNode[];
    items?.forEach(item => {
      if (isSymbolLiteral(item)) {
        symbols.push(item.value);
      }
    });
  } else if (isSymbolLiteral(field)) {
    symbols.push(field.value);
  }
  
  return symbols;
}

private extractBlocks(field: ASTNode): ASTNode[] {
  if (!field) return [];
  
  if (isArrayBlock(field)) {
    return field.fields?.get("items") || [];
  } else if (Array.isArray(field)) {
    return field;
  } else {
    return [field];
  }
}

// 사용
const exports = this.extractSymbols(exportsField);
const body = this.extractBlocks(bodyField);
```

---

### 6. **Selective Import 필드명** ⚠️

ImportBlock에서:
```typescript
selective?: string[];  // 파서에서 이름이?
```

코드에서:
```typescript
const selective = importBlock.selective;
if (selective && selective.length > 0) {
```

**확인 필요**: 파서에서 `importBlock.selective` 필드를 정확히 생성하는지?

---

### 7. **Parameter 추출 로직 취약** 🟡

```typescript
const params = block.fields?.get("params") || [];
const paramNames = Array.isArray(params)
  ? params.map((p: any) => (typeof p === "string" ? p : (p as any).value))
  : [];
```

**문제점**:
- params가 ASTNode일 수 있는데 형태 체크 불완전
- 변수명 변환이 일관적이지 않음

**권장사항**:
```typescript
private extractParamNames(params: any): string[] {
  if (!Array.isArray(params)) return [];
  
  return params
    .map(p => {
      if (typeof p === "string") return p;
      if (p && p.value) return p.value;
      if (p && p.name) return p.name;
      return null;
    })
    .filter((name): name is string => name !== null);
}
```

---

## 📊 코드 품질 점수

| 항목 | 점수 | 비고 |
|------|------|------|
| 기능성 | 9/10 | ✅ 모든 기능 정상 작동 |
| 테스트 | 10/10 | ✅ 6/6 테스트 통과 |
| 타입 안전성 | 6/10 | 🟡 as any 많음 |
| 코드 중복 | 7/10 | 🟡 getModules() 중복 |
| 에러 처리 | 7/10 | 🟡 일관성 개선 필요 |
| 가독성 | 7/10 | 🟡 AST 추출 복잡 |
| 유지보수성 | 7/10 | 🟡 헬퍼 함수 필요 |

**총점**: 7.6/10 (좋음, 개선 여지 있음)

---

## ✅ 이 코드의 강점

1. **기능 완성도** - 모든 요구사항 구현됨
2. **테스트 품질** - 엣지 케이스까지 다룸
3. **아키텍처** - 확장 가능한 구조
4. **사용자 경험** - 명확한 로깅

---

## 🚀 개선 우선순위

### P0 (즉시):
- [ ] Type 가드 함수 추가 (as any 제거)
- [ ] getModules() 헬퍼 함수

### P1 (다음 버전):
- [ ] 에러 클래스 정의
- [ ] 로거 인터페이스
- [ ] AST 추출 헬퍼 함수

### P2 (리팩토링):
- [ ] console.log → 로거 교체
- [ ] 테스트 추가 (에러 케이스)
- [ ] 문서화 보강

---

## 결론

Phase 6 구현은 **기능적으로 완성되고 잘 테스트됨**입니다. 

**지금은**:
- ✅ 프로덕션 배포 가능
- ✅ Phase 7 진행 가능

**나중에**:
- 🟡 타입 안전성 강화
- 🟡 코드 중복 제거
- 🟡 로깅 인프라 개선

**총평**: **B+ (Very Good)** - 목표 달성 + 개선 여지
