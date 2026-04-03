// FreeLang v9: AST Node definitions

export type ASTNode =
  | Block
  | Literal
  | Variable
  | SExpr
  | Keyword;

// [BLOCK_TYPE name :key1 val1 :key2 val2 ...]
export interface Block {
  kind: "block";
  type: string; // "INTENT", "FUNC", "PROMPT", "PIPE", "AGENT"
  name: string;
  fields: Map<string, ASTNode | ASTNode[]>;
  typeAnnotations?: Map<string, TypeAnnotation>; // :params and :return types (Phase 3)
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
  name: string;              // "int", "string", "bool", "array<int>", "map<string,int>"
  generic?: TypeAnnotation;  // for array<T>, map<K,V>
  union?: TypeAnnotation[];  // for Type1 | Type2
  optional?: boolean;        // for Type?
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
