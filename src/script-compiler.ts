// v11 Script Compiler: Script tokens → S-expression

import { ScriptToken, ScriptTokenType, scriptLex } from "./script-lexer";

export function compileScript(source: string): string {
  const tokens = scriptLex(source);
  const compiler = new ScriptCompiler(tokens);
  return compiler.compile();
}

class ScriptCompiler {
  private tokens: ScriptToken[];
  private pos = 0;
  private output: string[] = [];

  constructor(tokens: ScriptToken[]) {
    this.tokens = tokens;
  }

  compile(): string {
    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      const stmt = this.parseStatement();
      if (stmt) {
        this.output.push(stmt);
      }
    }

    // 모든 정의를 do 블록으로 감싸기
    if (this.output.length === 0) return "(do)";
    if (this.output.length === 1) return this.output[0];
    return `(do ${this.output.join("\n")})`;
  }

  private parseStatement(): string {
    const token = this.peek();

    if (token.type === "KEYWORD") {
      switch (token.value) {
        case "func": return this.parseFuncDef();
        case "if": return this.parseIf();
        case "while": return this.parseWhile();
        case "return": return this.parseReturn();
        case "def":
        case "let":
        case "const": return this.parseVarDef();
        default: break;
      }
    }

    if (token.type === "IDENT") {
      const expr = this.parseExpression();
      this.skipNewlines();
      return expr;
    }

    this.advance();
    return "";
  }

  private parseFuncDef(): string {
    this.expect("KEYWORD", "func");
    const name = this.expect("IDENT").value;
    this.expect("LPAREN");

    const params: string[] = [];
    while (!this.checkType("RPAREN") && !this.isAtEnd()) {
      params.push(this.expect("IDENT").value);
      if (this.checkType("COMMA")) {
        this.advance();
      }
    }
    this.expect("RPAREN");
    this.expect("LBRACE");
    this.skipNewlines();

    const body = this.parseBlock();
    this.expect("RBRACE");
    this.skipNewlines();

    const paramList = params.length > 0 ? ` [${params.join(" ")}]` : " []";
    return `(defn ${name}${paramList}\n${body})`;
  }

  private parseIf(): string {
    this.expect("KEYWORD", "if");
    const cond = this.parseExpression();
    this.expect("LBRACE");
    this.skipNewlines();
    const thenBody = this.parseBlock();
    this.expect("RBRACE");
    this.skipNewlines();

    let elseBody = "nil";
    if (this.checkType("KEYWORD") && this.peek().value === "else") {
      this.advance();
      this.expect("LBRACE");
      this.skipNewlines();
      elseBody = this.parseBlock();
      this.expect("RBRACE");
      this.skipNewlines();
    }

    return `(if ${cond}\n  ${thenBody}\n  ${elseBody})`;
  }

  private parseWhile(): string {
    this.expect("KEYWORD", "while");
    const cond = this.parseExpression();
    this.expect("LBRACE");
    this.skipNewlines();
    const body = this.parseBlock();
    this.expect("RBRACE");
    this.skipNewlines();

    return `(while ${cond}\n  ${body})`;
  }

  private parseReturn(): string {
    this.expect("KEYWORD", "return");
    const expr = this.parseExpression();
    this.skipNewlines();
    return expr;
  }

  private parseVarDef(): string {
    this.advance(); // def/let/const
    const name = this.expect("IDENT").value;
    this.expect("ASSIGN");
    const value = this.parseExpression();
    this.skipNewlines();
    return `(def ${name} ${value})`;
  }

  private parseBlock(): string {
    const stmts: string[] = [];

    while (!this.checkType("RBRACE") && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.checkType("RBRACE")) break;

      const stmt = this.parseStatement();
      if (stmt) {
        stmts.push(stmt);
      }
    }

    if (stmts.length === 0) return "nil";
    if (stmts.length === 1) return stmts[0];
    return `(do ${stmts.join("\n  ")})`;
  }

  private parseExpression(): string {
    return this.parseAssignment();
  }

  private parseAssignment(): string {
    let expr = this.parseLogicalOr();

    if (this.checkType("ASSIGN")) {
      this.advance();
      const value = this.parseAssignment();
      // 간단한 변수 할당: x = 10 → (set! x 10)
      if (expr.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        return `(set! ${expr} ${value})`;
      }
    }

    return expr;
  }

  private parseLogicalOr(): string {
    let expr = this.parseLogicalAnd();

    while (this.checkType("OPERATOR") && this.peek().value === "||") {
      this.advance();
      const right = this.parseLogicalAnd();
      expr = `(or ${expr} ${right})`;
    }

    return expr;
  }

  private parseLogicalAnd(): string {
    let expr = this.parseEquality();

    while (this.checkType("OPERATOR") && this.peek().value === "&&") {
      this.advance();
      const right = this.parseEquality();
      expr = `(and ${expr} ${right})`;
    }

    return expr;
  }

  private parseEquality(): string {
    let expr = this.parseComparison();

    while (this.checkType("OPERATOR") && (this.peek().value === "==" || this.peek().value === "!=")) {
      const op = this.advance().value;
      const right = this.parseComparison();
      const fn = op === "==" ? "=" : "not=";
      expr = `(${fn} ${expr} ${right})`;
    }

    return expr;
  }

  private parseComparison(): string {
    let expr = this.parseAdditive();

    while (this.checkType("OPERATOR") && [">", "<", ">=", "<="].includes(this.peek().value)) {
      const op = this.advance().value;
      const right = this.parseAdditive();
      expr = `(${op} ${expr} ${right})`;
    }

    return expr;
  }

  private parseAdditive(): string {
    let expr = this.parseMultiplicative();

    while (this.checkType("OPERATOR") && (this.peek().value === "+" || this.peek().value === "-")) {
      const op = this.advance().value;
      const right = this.parseMultiplicative();
      expr = `(${op} ${expr} ${right})`;
    }

    return expr;
  }

  private parseMultiplicative(): string {
    let expr = this.parseUnary();

    while (this.checkType("OPERATOR") && (this.peek().value === "*" || this.peek().value === "/")) {
      const op = this.advance().value;
      const right = this.parseUnary();
      expr = `(${op} ${expr} ${right})`;
    }

    return expr;
  }

  private parseUnary(): string {
    if (this.checkType("OPERATOR") && (this.peek().value === "!" || this.peek().value === "-")) {
      const op = this.advance().value;
      const expr = this.parseUnary();
      const fn = op === "!" ? "not" : "-";
      return `(${fn} ${expr})`;
    }

    return this.parsePostfix();
  }

  private parsePostfix(): string {
    let expr = this.parsePrimary();

    while (true) {
      if (this.checkType("LPAREN")) {
        this.advance();
        const args: string[] = [];
        while (!this.checkType("RPAREN") && !this.isAtEnd()) {
          args.push(this.parseExpression());
          if (this.checkType("COMMA")) {
            this.advance();
          }
        }
        this.expect("RPAREN");
        expr = `(${expr}${args.length > 0 ? " " + args.join(" ") : ""})`;
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): string {
    const token = this.peek();

    if (token.type === "NUMBER") {
      return this.advance().value;
    }

    if (token.type === "STRING") {
      return `"${this.advance().value}"`;
    }

    if (token.type === "IDENT") {
      return this.advance().value;
    }

    if (token.type === "KEYWORD") {
      if (token.value === "true") {
        this.advance();
        return "true";
      }
      if (token.value === "false") {
        this.advance();
        return "false";
      }
      if (token.value === "null") {
        this.advance();
        return "nil";
      }
    }

    if (token.type === "LPAREN") {
      this.advance();
      const expr = this.parseExpression();
      this.expect("RPAREN");
      return `(${expr})`;
    }

    throw new Error(`Unexpected token: ${token.type} "${token.value}" at line ${token.line}`);
  }

  private skipNewlines(): void {
    while (!this.isAtEnd() && this.checkType("NEWLINE")) {
      this.advance();
    }
  }

  private peek(): ScriptToken {
    return this.tokens[this.pos];
  }

  private advance(): ScriptToken {
    return this.tokens[this.pos++];
  }

  private checkType(type: ScriptTokenType): boolean {
    return !this.isAtEnd() && this.peek().type === type;
  }

  private expect(type: ScriptTokenType, value?: string): ScriptToken {
    const token = this.peek();
    if (token.type !== type || (value && token.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` "${value}"` : ""}, got ${token.type} "${token.value}" at line ${token.line}`);
    }
    return this.advance();
  }

  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length || this.peek().type === "EOF";
  }
}
