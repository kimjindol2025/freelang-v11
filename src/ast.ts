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
