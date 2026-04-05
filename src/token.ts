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

  // Phase 9b Keywords (Learning)
  Learn = "Learn",         // learn
  Recall = "Recall",       // recall
  Remember = "Remember",   // remember
  Forget = "Forget",       // forget

  // Phase 9c Keywords (Reasoning)
  Observe = "Observe",     // observe
  Analyze = "Analyze",     // analyze
  Decide = "Decide",       // decide
  Act = "Act",             // act
  Verify = "Verify",       // verify

  // Phase 9c Keywords (Conditional)
  If = "If",               // if
  When = "When",           // when
  Then = "Then",           // then
  Else = "Else",           // else

  // Phase 9c Keywords (Loop Control)
  Repeat = "Repeat",       // repeat
  Until = "Until",         // until
  While = "While",         // while

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
