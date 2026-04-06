export declare enum TokenType {
    Number = "Number",
    String = "String",
    Symbol = "Symbol",
    Keyword = "Keyword",
    Variable = "Variable",// $varname
    LBracket = "LBracket",// [
    RBracket = "RBracket",// ]
    LParen = "LParen",// (
    RParen = "RParen",// )
    LBrace = "LBrace",// {
    RBrace = "RBrace",// }
    Module = "Module",// MODULE
    TypeClass = "TypeClass",// TYPECLASS
    Instance = "Instance",// INSTANCE
    Import = "Import",// import
    Open = "Open",// open
    Search = "Search",// search
    Fetch = "Fetch",// fetch
    Browse = "Browse",// browse
    Cache = "Cache",// cache
    Learn = "Learn",// learn
    Recall = "Recall",// recall
    Remember = "Remember",// remember
    Forget = "Forget",// forget
    Observe = "Observe",// observe
    Analyze = "Analyze",// analyze
    Decide = "Decide",// decide
    Act = "Act",// act
    Verify = "Verify",// verify
    If = "If",// if
    When = "When",// when
    Then = "Then",// then
    Else = "Else",// else
    Repeat = "Repeat",// repeat
    Until = "Until",// until
    While = "While",// while
    Colon = "Colon",// :
    EOF = "EOF"
}
export interface Token {
    type: TokenType;
    value: string;
    line: number;
    col: number;
}
//# sourceMappingURL=token.d.ts.map