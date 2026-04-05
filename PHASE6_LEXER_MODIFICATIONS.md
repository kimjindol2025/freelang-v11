# 🔧 Phase 6 Step 2: Lexer Modifications Design

**Status**: DESIGN LOCKED
**Version**: 1.0
**Date**: 2026-04-05

---

## 📋 Current Lexer State

### Existing Tokens (lexer.ts)

```typescript
enum TokenType {
  // Literals
  NUMBER,
  STRING,
  SYMBOL,      // keywords & identifiers mixed here

  // Delimiters
  LPAREN,      // (
  RPAREN,      // )
  LBRACKET,    // [
  RBRACKET,    // ]
  LBRACE,      // {
  RBRACE,      // }

  // Keywords (all in SYMBOL, distinguished by value)
  // FUNC, INTENT, BLOCK, etc.

  EOF
}
```

### Issue

- Keywords detected by **string matching** in Symbol value
- No dedicated keyword token type
- `:` character not explicitly handled (treated as symbol start)

---

## 🎯 Required Changes

### 1️⃣ Add New Token Types

```typescript
enum TokenType {
  // ... existing tokens ...

  // New keywords (explicit)
  KW_MODULE,       // MODULE
  KW_TYPECLASS,    // TYPECLASS
  KW_INSTANCE,     // INSTANCE
  KW_IMPORT,       // import
  KW_OPEN,         // open

  // New operators
  COLON,           // :

  // Existing keyword (already in Symbol)
  // But we might promote to explicit later if needed
}
```

### 2️⃣ Modify Identifier Regex

**Current (assumption)**:
```regex
identifier: [a-zA-Z_][a-zA-Z0-9_:-]*
```

**Problem**: Colon allowed inside identifier → qualified_identifier ambiguous

**New**:
```regex
identifier: [a-zA-Z_][a-zA-Z0-9_-]*
            // NOTE: colon (":") explicitly excluded
            // hyphens allowed (for function names like "add-one")
```

### 3️⃣ Add Colon Token

**Rule**:
```regex
colon: ":"
```

**Placement**: When lexer sees `:` alone, emit COLON token

**Examples**:
```
math:add       → [SYMBOL("math"), COLON, SYMBOL("add")]
:exports       → [COLON, SYMBOL("exports")]  // keyword argument
:from          → [COLON, SYMBOL("from")]
```

### 4️⃣ Keyword Recognition

**Current approach**: Keywords detected at parse time by string comparison

**New approach**: Recognize at lex time (optional, but recommended)

```typescript
const KEYWORDS = {
  "MODULE": KW_MODULE,
  "TYPECLASS": KW_TYPECLASS,
  "INSTANCE": KW_INSTANCE,
  "import": KW_IMPORT,
  "open": KW_OPEN,
  // existing...
  "FUNC": KW_FUNC,
  "INTENT": KW_INTENT,
  // etc.
};

function identifierOrKeyword(text: string): TokenType {
  return KEYWORDS[text] || SYMBOL;
}
```

---

## 📝 Lexer Changes (Detailed)

### Change 1: TokenType Enum

**File**: `src/lexer.ts`

```typescript
// BEFORE
enum TokenType {
  NUMBER, STRING, SYMBOL, LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE, EOF
}

// AFTER
enum TokenType {
  // Literals
  NUMBER, STRING, SYMBOL,

  // Delimiters
  LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE,

  // Keywords (explicit, case-sensitive)
  KW_FUNC, KW_INTENT, KW_BLOCK, KW_ROUTE, KW_PROMPT, KW_PIPE, KW_AGENT,
  KW_MODULE, KW_TYPECLASS, KW_INSTANCE, KW_IMPORT, KW_OPEN,

  // Operators
  COLON,

  EOF
}
```

### Change 2: Identifier Regex

**File**: `src/lexer.ts`, identifier scanning

```typescript
// BEFORE
function isIdentifierChar(ch: string, first: boolean): boolean {
  return /[a-zA-Z0-9_:-]/.test(ch) && (first ? /[a-zA-Z_]/.test(ch) : true);
}

// AFTER
function isIdentifierChar(ch: string, first: boolean): boolean {
  // Hyphens allowed, colons NOT allowed
  return /[a-zA-Z0-9_-]/.test(ch) && (first ? /[a-zA-Z_]/.test(ch) : true);
}

// Or as single regex:
function scanIdentifier(): Token {
  const start = this.pos;
  while (this.pos < this.input.length && /[a-zA-Z0-9_-]/.test(this.input[this.pos])) {
    this.pos++;
  }
  const text = this.input.substring(start, this.pos);
  return { type: identifierOrKeyword(text), value: text };
}
```

### Change 3: Colon Token Handling

**File**: `src/lexer.ts`, main scanning loop

```typescript
// In main scan() loop, add case for ':'
switch (ch) {
  case '(':
    tokens.push({ type: TokenType.LPAREN, value: '(' });
    this.pos++;
    break;
  case ')':
    tokens.push({ type: TokenType.RPAREN, value: ')' });
    this.pos++;
    break;
  // ... existing cases ...

  case ':':
    tokens.push({ type: TokenType.COLON, value: ':' });
    this.pos++;
    break;

  // ... rest of cases ...
}
```

### Change 4: Keyword Mapping

**File**: `src/lexer.ts`, top of class

```typescript
private static KEYWORDS: Map<string, TokenType> = new Map([
  // Phase 1-3
  ["FUNC", TokenType.KW_FUNC],
  ["INTENT", TokenType.KW_INTENT],
  ["BLOCK", TokenType.KW_BLOCK],
  ["ROUTE", TokenType.KW_ROUTE],
  ["PROMPT", TokenType.KW_PROMPT],
  ["PIPE", TokenType.KW_PIPE],
  ["AGENT", TokenType.KW_AGENT],

  // Phase 6
  ["MODULE", TokenType.KW_MODULE],
  ["TYPECLASS", TokenType.KW_TYPECLASS],
  ["INSTANCE", TokenType.KW_INSTANCE],
  ["import", TokenType.KW_IMPORT],
  ["open", TokenType.KW_OPEN],
]);

private identifierOrKeyword(text: string): TokenType {
  return Lexer.KEYWORDS.get(text) ?? TokenType.SYMBOL;
}
```

---

## ✅ Test Cases (Lexer Level)

### Test 1: Basic Identifier (No Colon)

```
Input: "math"
Expected: [SYMBOL("math"), EOF]
Current: ✅ (unchanged)
```

### Test 2: Hyphenated Identifier

```
Input: "add-one"
Expected: [SYMBOL("add-one"), EOF]
Current: ✅ (unchanged, already worked)
```

### Test 3: Colon Token Separation

```
Input: "math:add"
Expected: [SYMBOL("math"), COLON, SYMBOL("add"), EOF]
Current: ❌ (would be [SYMBOL("math:add"), EOF])
After: ✅
```

### Test 4: MODULE Keyword

```
Input: "[MODULE math"
Expected: [LBRACKET, KW_MODULE, SYMBOL("math"), EOF]
Current: ❌ (would be [LBRACKET, SYMBOL("MODULE"), SYMBOL("math"), EOF])
After: ✅
```

### Test 5: Keyword Argument

```
Input: ":exports [add]"
Expected: [COLON, SYMBOL("exports"), LBRACKET, SYMBOL("add"), RBRACKET, EOF]
Current: ❌ (colon mixed with exports)
After: ✅
```

### Test 6: Import Statement

```
Input: "(import math :from \"./math.fl\")"
Expected: [LPAREN, KW_IMPORT, SYMBOL("math"), COLON, SYMBOL("from"), STRING, RPAREN, EOF]
Current: ❌
After: ✅
```

---

## 🔄 Parser Impact

### Minimal Changes Expected

Since we're only adding new **token types** and **colon separation**:

- Parser's existing `parseIdentifier()` → still returns SYMBOL
- New parser rules can now expect KW_MODULE, KW_IMPORT, COLON
- Backward compatible with Phase 5 code

### No Breaking Changes

Phase 5 code like:

```freeLang
[FUNC add :params [$a $b] :body (+ $a $b)]
```

Still lexes to:
```
[LBRACKET, SYMBOL("FUNC"), SYMBOL("add"),
 COLON, SYMBOL("params"), [LBRACKET, SYMBOL("$a"), SYMBOL("$b"), RBRACKET],
 COLON, SYMBOL("body"), ...]
```

Parser needs no changes for Phase 5 → stays stable.

---

## 📊 Lexer Change Summary

| Item | Change | Impact |
|------|--------|--------|
| TokenType enum | +5 keywords, +1 operator | Parser must recognize new types |
| Identifier regex | Remove `:` from allowed chars | Colon now separate |
| Colon scanning | Add `:` case | Required for qualified names |
| Keyword map | Add 5 new keywords | Cleaner token discrimination |
| Backward compat | Full | Phase 5 code unaffected |

---

## 🎯 Implementation Order

1. **Add TokenType enum entries** (5 minutes)
2. **Add KEYWORDS map** (5 minutes)
3. **Fix identifier regex** (5 minutes)
4. **Add colon scanning** (5 minutes)
5. **Test lexer output** (15 minutes)
6. **Verify Phase 5 tests still pass** (10 minutes)

**Total: ~45 minutes**

---

## 📋 Files to Modify

- `src/lexer.ts` — Token enum, regex, keyword map, colon handling

---

## ✅ Verification Checklist

- [ ] `npm run build` compiles without error
- [ ] Existing Phase 5 tests still lex correctly
- [ ] Colon separates qualified names (test 3)
- [ ] MODULE/TYPECLASS/INSTANCE recognized as keywords (test 4)
- [ ] Keyword arguments (:exports, :from, etc.) lex correctly (test 5)
- [ ] No backward incompatibility with SYMBOL-based parsing

---

**Status**: READY FOR IMPLEMENTATION
**Next**: Execute lexer modifications (src/lexer.ts)

---

**Created**: 2026-04-05
**Target**: Lean, minimal, backward-compatible lexer changes
