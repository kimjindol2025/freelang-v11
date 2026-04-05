# 🚀 FreeLang v9 Phase 4 - Advanced Features

**Target**: 8주 (2026-04-05 ~ 2026-05-30)
**Objective**: 제네릭, 패턴 매칭, 모나드 완성

---

## 📋 Phase 4 Week 1-2: Generics (제네릭)

### Goal
제네릭 타입 시스템으로 재사용 가능한 함수 작성

### Tasks
1. **AST 확장** (src/ast.ts)
   - `GenericsDecl` 노드 추가: `generics: string[]`
   - `TypeVariable` 노드: `name: string`

2. **Parser 업데이트** (src/parser.ts)
   - `:generics [T K V]` 파싱
   - Type variable 인식

3. **Type Checker 확장** (src/type-checker.ts)
   - Generic type instantiation
   - Type substitution
   - Constraint checking

4. **Interpreter 적용**
   - Generic function call handling
   - Type variable resolution

5. **Standard Library**
   - `(identity [T] x:T) -> T`
   - `(map [T U] arr:[T] f:(T->U)) -> [U]`
   - `(filter [T] arr:[T] pred:(T->bool)) -> [T]`

6. **Test Suite**
   - examples/stdlib-generics.fl
   - src/test-stdlib-generics.ts
   - 15+ test cases

### Expected Output
- ✅ 3 generic wrapper functions
- ✅ 12+ test cases passing
- ✅ Commit to Gogs

---

## 📋 Phase 4 Week 3-4: Pattern Matching (패턴 매칭)

### Goal
구조 분해와 패턴 기반 프로그래밍

### Tasks
1. **Pattern AST** (src/ast.ts)
   - `PatternMatch` 노드
   - `Pattern` 타입들:
     - LiteralPattern (1, "hello")
     - VariablePattern (x)
     - ListPattern ([x & xs])
     - WildcardPattern (_)
     - StructPattern ({name age})

2. **Parser Updates** (src/parser.ts)
   - Pattern 문법: `[x & xs]`, `{:name :age}`
   - Match expression 파싱

3. **Interpreter Pattern Matching**
   ```v9
   (match expr
     [[] "empty"]
     [[x] "singleton"]
     [[x & xs] "list with head and tail"]
     [_ "default"]
   )
   ```

4. **Standard Library**
   - Pattern-based list operations
   - Destructuring helpers
   - Pattern guards

5. **Test Suite**
   - examples/stdlib-patterns.fl
   - src/test-stdlib-patterns.ts
   - 20+ test cases

### Expected Output
- ✅ Pattern matching fully working
- ✅ 20+ test cases
- ✅ Commit to Gogs

---

## 📋 Phase 4 Week 5-6: Monads (모나드)

### Goal
함수형 프로그래밍 컴포지션 (Maybe, List, IO monads)

### Tasks
1. **Monad TypeClass**
   ```v9
   [TYPECLASS Monad
     [FUNC return [:params [x any] :return (monad any)]]
     [FUNC >>= [:params [m (monad T)] [f (lambda [T] (monad U))] :return (monad U)]]
   ]
   ```

2. **Maybe Monad**
   - `(just 5)` → Maybe<int>
   - `(nothing)` → Maybe<T>
   - Monadic operations (bind, map)

3. **List Monad**
   - `(list 1 2 3)` → List<int>
   - Cartesian product via bind
   - Comprehension syntax

4. **IO Monad**
   - `(io-read file)` → IO<string>
   - `(io-write file content)` → IO<unit>
   - Monadic chaining

5. **Standard Library**
   - Monad implementations
   - Helper functions (liftA, ap, etc)
   - Do-notation equivalent

6. **Test Suite**
   - examples/stdlib-monads.fl
   - src/test-stdlib-monads.ts
   - 25+ test cases

### Expected Output
- ✅ Maybe, List, IO monads
- ✅ 25+ test cases
- ✅ Commit to Gogs

---

## 📋 Phase 4 Week 7-8: Higher-order + Lazy Evaluation

### Goal
함수형 프로그래밍 완성 (고차 함수, 지연 계산)

### Tasks
1. **Higher-order Functions**
   - `(compose f g)` → λx.(f (g x))
   - `(curry f)` → Partially applicable
   - `(uncurry f)` → Single function
   - Pipe operator `(|> x f g h)`

2. **Lazy Evaluation**
   ```v9
   (delay (expensive-computation))  ; Doesn't evaluate
   (force delayed-value)            ; Now evaluates
   ```
   - Infinite lists support
   - Lazy map/filter/reduce
   - Stream processing

3. **Function Combinators**
   - `(flip f)` → Arguments reversed
   - `(constantly x)` → Always returns x
   - `(identity x)` → Returns x
   - `(apply f args)` → Apply function

4. **Standard Library**
   - examples/stdlib-higher-order.fl
   - 20+ combinator functions
   - Lazy stream library

5. **Test Suite**
   - src/test-stdlib-higher-order.ts
   - 30+ test cases

### Expected Output
- ✅ Compose, curry, pipe working
- ✅ Lazy evaluation system
- ✅ 30+ test cases
- ✅ Commit to Gogs

---

## 🎯 Phase 4 Overall Metrics

| Week | Feature | Functions | Tests | Status |
|------|---------|-----------|-------|--------|
| 1-2 | Generics | 3 | 12 | ⬜ |
| 3-4 | Pattern Matching | 5 | 20 | ⬜ |
| 5-6 | Monads | 15 | 25 | ⬜ |
| 7-8 | Higher-order | 20 | 30 | ⬜ |
| **Total** | **Advanced Features** | **43** | **87** | **⬜** |

---

## 🔍 Weekly Progress Template

### Template for each week:
```
## Week X: [Feature Name]

### Status: [Starting/In Progress/Complete]
- Started: [Date]
- Current: [% Complete]
- Issues: [Any blockers]

### Completed:
- [ ] AST changes
- [ ] Parser updates
- [ ] Interpreter implementation
- [ ] Test suite
- [ ] Documentation
- [ ] Gogs commit

### Test Results:
- [x] tests passing
- [ ] All tests passing
```

---

## 📊 Success Criteria

Phase 4 is COMPLETE when:

- ✅ Generics fully integrated
- ✅ Pattern matching working
- ✅ 3 monad types (Maybe, List, IO)
- ✅ Function composition working
- ✅ Lazy evaluation system
- ✅ 43 new functions in stdlib
- ✅ 87 new test cases (all passing)
- ✅ All code committed to Gogs
- ✅ Comprehensive documentation

---

## 📝 Phase 4 Timeline

```
Week 1-2: Apr 05-18   Generics implementation
Week 3-4: Apr 19-May 02  Pattern matching
Week 5-6: May 03-16   Monads
Week 7-8: May 17-30   Higher-order + Lazy eval

Total: 8 weeks, ~250-300 hours expected
```

---

**Status**: Ready to begin Phase 4 Week 1
**Next Action**: Start Generics implementation
**Last Updated**: 2026-04-05
