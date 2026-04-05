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

  // Phase 6 Keywords
  Module = "Module",       // MODULE
  TypeClass = "TypeClass", // TYPECLASS
  Instance = "Instance",   // INSTANCE
  Import = "Import",       // import
  Open = "Open",           // open

  // Phase 9a Keywords (Search)
  Search = "Search",       // search
  Fetch = "Fetch",         // fetch
  Browse = "Browse",       // browse
  Cache = "Cache",         // cache

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
