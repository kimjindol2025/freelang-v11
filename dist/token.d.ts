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
    Module = "Module",// MODULE
    TypeClass = "TypeClass",// TYPECLASS
    Instance = "Instance",// INSTANCE
    Import = "Import",// import
    Open = "Open",// open
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