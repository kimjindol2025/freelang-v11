// FreeLang v9: Token types

export enum TokenType {
  // Literals
  Number = "Number",
  String = "String",
  Symbol = "Symbol",
  Keyword = "Keyword",
  Variable = "Variable", // $varname

  // Delimiters
  LBracket = "LBracket",   // [
  RBracket = "RBracket",   // ]
  LParen = "LParen",       // (
  RParen = "RParen",       // )

  // Special
  Colon = "Colon",         // :
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}
