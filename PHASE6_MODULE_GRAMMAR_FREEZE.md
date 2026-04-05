# 📐 Phase 6 Step 1: Module Grammar Freeze

**Status**: DESIGN LOCKED
**Version**: 1.0
**Date**: 2026-04-05

---

## 1️⃣ Module Block Grammar (확정)

### BNF Definition

```bnf
<module_block> ::= "[" "MODULE" <identifier>
                      <module_clause>+
                   "]"

<module_clause> ::= ":exports" "[" <identifier>* "]"
                  | ":body"    "[" <block>* "]"
```

### Constraints (의무)

1. **:body 필수** — 1개 이상 존재해야 함
2. **:exports 선택** — 0개 또는 1개
3. **순서 자유** — `:exports` 전에 `:body` 가능
4. **중첩 금지** — Module 내부에 MODULE 블록 불허
5. **Identifier**: 알파벳+숫자+하이픈+언더스코어만 (`:` 제외)

### Example

```freeLang
[MODULE math
  :exports [add subtract multiply]
  :body [
    [FUNC add :params [$a $b] :body (+ $a $b)]
    [FUNC subtract :params [$a $b] :body (- $a $b)]
    [FUNC multiply :params [$a $b] :body (* $a $b)]
  ]
]

[MODULE math
  :body [
    [FUNC private-helper [] ...]
  ]
  :exports [public-func]
]

[MODULE empty-exports
  :exports []
  :body [[FUNC f [] ...]]
]
```

### AST Node (ast.ts)

```typescript
interface ModuleBlock {
  kind: "module";
  name: string;
  exports: string[];        // [] if not specified
  body: ASTNode[];          // guaranteed non-empty
  path?: string;            // optional file path
}
```

---

## 2️⃣ Import Block Grammar (확정)

### BNF Definition

```bnf
<import_block> ::= "(" "import" <qualified_identifier>
                      <import_clause>*
                   ")"

<import_clause> ::= ":from" <string>
                  | ":only" "[" <identifier>* "]"
                  | ":as"   <identifier>
```

### Constraints

1. **Module name required** — import 대상 필수
2. **:from optional** — 0 또는 1개 (file path)
3. **:only optional** — 0 또는 1개 (selective imports)
4. **:as optional** — 0 또는 1개 (alias)
5. **Semantics**:
   - No :from → look up in module registry
   - With :from → load from file system
   - With :only → expose only specified functions
   - With :as → bind module to alias

### Examples

```freeLang
(import math)                              ; load math from registry
(import math :from "./math.fl")            ; load from file
(import math :only [add multiply])         ; selective import
(import math :as m)                        ; alias m:add, m:multiply
(import math :from "./math.fl" :as m)      ; combined
(import math :only [add] :as m)            ; combined selective + alias
```

### AST Node (ast.ts)

```typescript
interface ImportBlock {
  kind: "import";
  moduleName: string;
  source?: string;           // :from value
  selective?: string[];      // :only values
  alias?: string;            // :as value
}
```

---

## 3️⃣ Open Block Grammar (확정)

### BNF Definition

```bnf
<open_block> ::= "(" "open" <qualified_identifier>
                    (":from" <string>)?
                 ")"
```

### Semantics

- Imports all exports from module into current scope
- `:from` optional (same as import)
- Functions become directly accessible (no namespace)

### Examples

```freeLang
(open math)                        ; math:add becomes add
(open math :from "./math.fl")      ; load from file, then open

; After: (open math)
; math:add is available as: (add 5 3)
```

### AST Node (ast.ts)

```typescript
interface OpenBlock {
  kind: "open";
  moduleName: string;
  source?: string;           // :from value
}
```

---

## 4️⃣ Qualified Identifier Grammar (확정)

### Key Decision: Token Separation

**콜론(`:`)은 identifier 내부 문자가 아닌 별도 토큰**

```bnf
<qualified_identifier> ::= <identifier> (":" <identifier>)*
```

### Lexer Tokens

```
IDENTIFIER  : [a-zA-Z_][a-zA-Z0-9_-]*  (no ':' allowed)
COLON       : ":"                       (separate token)
```

### Parser Composition

```typescript
parseQualifiedIdentifier(): string[] {
  const parts = [parseIdentifier()];
  while (peek().type === COLON) {
    advance(); // consume COLON
    parts.push(parseIdentifier());
  }
  return parts; // ["math", "add"] represents math:add
}
```

### Examples

```
math:add           → ["math", "add"]
utils:double:helper → ["utils", "double", "helper"]
simple             → ["simple"]
```

---

## 5️⃣ Design Decisions (Why/Why Not)

### ✅ Clause-Based Module Structure

**Pro:**
- Extensible (future: `:version`, `:meta`, `:imports`)
- Parser simplification (clause dispatch)
- Order independence

**Con:**
- Slightly more verbose than positional

### ✅ Token-Based Qualified Names

**Pro:**
- Clear boundary between namespace and function
- Future type constraint syntax safe (e.g., `T: Monad`)
- Lexer/parser separation of concerns

**Con:**
- Requires lexer modification

### ✅ No Nested Modules

**Pro:**
- Simpler circular dependency prevention
- Registry design stable
- Implementation risk low

**Con:**
- Less expressiveness (acceptable for Phase 6)

---

## 6️⃣ Semantic Guarantees

### Module Registration

```
MODULE [name, exports[], body[]]
  ↓
Register all functions in body as: name:funcname
Add exports[] to public list
Store in module registry
```

### Import Semantics

```
(import m :as a :only [f])
  ↓
Load module m (from :from or registry)
Filter exports to [f]
Bind as a:f (or a:f → f if namespace flattened)
```

### Open Semantics

```
(open m)
  ↓
Load module m
Bring all exports into current scope (no prefix)
Functions directly callable
```

---

## 7️⃣ Implementation Checklist

- [ ] Lexer: Add MODULE, TYPECLASS, INSTANCE keywords
- [ ] Lexer: Add COLON token
- [ ] Lexer: Identifier regex no longer includes `:`
- [ ] Parser: `parseModuleBlock()`
- [ ] Parser: `parseImportBlock()`
- [ ] Parser: `parseOpenBlock()`
- [ ] Parser: `parseQualifiedIdentifier()`
- [ ] Interpreter: `evalModuleBlock()`
- [ ] Interpreter: `evalImportBlock()`
- [ ] Interpreter: Module registry activation
- [ ] Test: test-modules.ts re-run (expect 6/6 pass)

---

## 8️⃣ Backward Compatibility

**None expected** — Phase 6 is new feature, no breaking changes to Phase 5.

---

## 🎯 Status

✅ **FREEZE** — Ready for lexer design
Next: PHASE6_LEXER_MODIFICATIONS.md

---

**Created**: 2026-04-05
**Approved**: Design Review Complete
**Lock Status**: FROZEN (changes require design meeting)
