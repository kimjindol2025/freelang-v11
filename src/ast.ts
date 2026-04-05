// FreeLang v9: AST Node definitions

export type ASTNode =
  | Block
  | Literal
  | Variable
  | SExpr
  | Keyword
  | TypeVariable
  | PatternMatch
  | Pattern;

// [BLOCK_TYPE name :key1 val1 :key2 val2 ...]
export interface Block {
  kind: "block";
  type: string; // "INTENT", "FUNC", "PROMPT", "PIPE", "AGENT"
  name: string;
  fields: Map<string, ASTNode | ASTNode[]>;
  typeAnnotations?: Map<string, TypeAnnotation>; // :params and :return types (Phase 3)
  generics?: string[]; // Generic type variables: ["T", "K", "V"] (Phase 4)
}

// Literal values
export interface Literal {
  kind: "literal";
  type: "number" | "string" | "symbol" | "boolean" | "null";
  value: string | number | boolean | null;
}

// $varname
export interface Variable {
  kind: "variable";
  name: string;
}

// (symbol arg1 arg2 ...)
export interface SExpr {
  kind: "sexpr";
  op: string;
  args: ASTNode[];
}

// :keyword
export interface Keyword {
  kind: "keyword";
  name: string;
}

// Type annotation (NEW for Phase 3)
export interface TypeAnnotation {
  kind: "type";
  name: string;              // "int", "string", "bool", "array<int>", "map<string,int>", "T"
  generic?: TypeAnnotation;  // for array<T>, map<K,V>
  union?: TypeAnnotation[];  // for Type1 | Type2
  optional?: boolean;        // for Type?
  isTypeVariable?: boolean;  // true if this is a generic type variable (Phase 4)
}

// Type variable reference (NEW for Phase 4 Generics)
export interface TypeVariable {
  kind: "type-variable";
  name: string;  // "T", "K", "V", etc.
}

// Pattern nodes (NEW for Phase 4 Week 3-4 - Pattern Matching)

// Literal pattern: matches exact literal value (1, "hello", true)
export interface LiteralPattern {
  kind: "literal-pattern";
  type: "number" | "string" | "symbol" | "boolean";
  value: string | number | boolean;
}

// Variable pattern: binds matched value to variable (x, y)
export interface VariablePattern {
  kind: "variable-pattern";
  name: string;  // variable name (without $)
}

// Wildcard pattern: matches any value, doesn't bind (_)
export interface WildcardPattern {
  kind: "wildcard-pattern";
}

// List pattern: destructures lists ([x & xs], [x y z])
export interface ListPattern {
  kind: "list-pattern";
  elements: Pattern[];
  restElement?: string;  // for [x & rest] syntax
}

// Struct pattern: destructures objects ({:name :age})
export interface StructPattern {
  kind: "struct-pattern";
  fields: Map<string, Pattern>;  // field name -> pattern
}

// Union of all pattern types
export type Pattern = LiteralPattern | VariablePattern | WildcardPattern | ListPattern | StructPattern;

// Pattern match expression: (match value case1 case2 ...)
export interface PatternMatch {
  kind: "pattern-match";
  value: ASTNode;           // expression to match
  cases: MatchCase[];       // pattern -> result pairs
  defaultCase?: ASTNode;    // optional default case
}

// Single case in pattern match: (pattern body)
export interface MatchCase {
  pattern: Pattern;
  guard?: ASTNode;          // optional guard condition (if expr)
  body: ASTNode;            // result expression
}

// Function signature (NEW for Phase 3)
export interface FuncSignature {
  name: string;
  params: Array<{ name: string; type: TypeAnnotation }>;
  returnType: TypeAnnotation;
}

// Parser state
export interface ParserState {
  tokens: any[];
  pos: number;
}

// Helpers
export function makeLiteral(type: "number" | "string" | "symbol" | "boolean" | "null", value: any): Literal {
  return { kind: "literal", type, value };
}

export function makeVariable(name: string): Variable {
  return { kind: "variable", name };
}

export function makeSExpr(op: string, args: ASTNode[]): SExpr {
  return { kind: "sexpr", op, args };
}

export function makeKeyword(name: string): Keyword {
  return { kind: "keyword", name };
}

export function makeBlock(type: string, name: string, fields: Map<string, ASTNode | ASTNode[]>): Block {
  return { kind: "block", type, name, fields };
}

// Helper: Create type annotation (Phase 3)
export function makeTypeAnnotation(
  name: string,
  generic?: TypeAnnotation,
  union?: TypeAnnotation[],
  optional?: boolean
): TypeAnnotation {
  return { kind: "type", name, generic, union, optional };
}

// Helper: Create function signature (Phase 3)
export function makeFuncSignature(
  name: string,
  params: Array<{ name: string; type: TypeAnnotation }>,
  returnType: TypeAnnotation
): FuncSignature {
  return { name, params, returnType };
}

// Helper: Create type variable (Phase 4)
export function makeTypeVariable(name: string): TypeVariable {
  return { kind: "type-variable", name };
}

// Helpers: Create patterns (Phase 4 Week 3-4)

export function makeLiteralPattern(
  type: "number" | "string" | "symbol" | "boolean",
  value: string | number | boolean
): LiteralPattern {
  return { kind: "literal-pattern", type, value };
}

export function makeVariablePattern(name: string): VariablePattern {
  return { kind: "variable-pattern", name };
}

export function makeWildcardPattern(): WildcardPattern {
  return { kind: "wildcard-pattern" };
}

export function makeListPattern(elements: Pattern[], restElement?: string): ListPattern {
  return { kind: "list-pattern", elements, restElement };
}

export function makeStructPattern(fields: Map<string, Pattern>): StructPattern {
  return { kind: "struct-pattern", fields };
}

export function makeMatchCase(pattern: Pattern, body: ASTNode, guard?: ASTNode): MatchCase {
  return { pattern, guard, body };
}

export function makePatternMatch(value: ASTNode, cases: MatchCase[], defaultCase?: ASTNode): PatternMatch {
  return { kind: "pattern-match", value, cases, defaultCase };
}
