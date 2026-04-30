// FreeLang v9: Phase 85 — FL AST → JavaScript 코드 생성기
// FL AST를 JavaScript 코드로 변환해 Node.js나 브라우저에서 실행 가능한 파일 생성

import { ASTNode, Block, Literal, TemplateString, Variable, SExpr, Keyword } from "./ast";
import { generateRuntimePreamble } from "./runtime-helpers";

export interface CodegenOptions {
  module: "commonjs" | "esm"; // 기본 "commonjs"
  runtime: boolean;           // fl-runtime 인라인 포함 여부
  minify: boolean;            // 기본 false
  target: "node" | "browser"; // 기본 "node"
}

const DEFAULT_OPTIONS: CodegenOptions = {
  module: "commonjs",
  runtime: false,
  minify: false,
  target: "node",
};

// FL Runtime 최소 헬퍼 함수 셋
const FL_RUNTIME = `
function _fl_map(arr, fn) { return (arr || []).map(fn); }
function _fl_filter(arr, fn) { return (arr || []).filter(fn); }
function _fl_reduce(arr, fn, init) { return (arr || []).reduce(fn, init); }
function _fl_print(v) { console.log(v); return v; }
`.trim();

// 이항 연산자 매핑
const BINARY_OPS: Record<string, string> = {
  "+": "+",
  "-": "-",
  "*": "*",
  "/": "/",
  "%": "%",
  "=": "===",
  "==": "===",
  "!=": "!==",
  "<": "<",
  ">": ">",
  "<=": "<=",
  ">=": ">=",
  "and": "&&",
  "or": "||",
};

// FL 내장 함수 → JS 네이티브 바인딩 매핑 (semantic codegen)
const BUILTIN_MAP: Record<string, string> = {
  // 타입 체크
  "null?": "_fl_null_q",
  "nil?": "_fl_null_q",
  "cli-args": "_fl_get_argv",
  "file_read": "_fl_file_read",
  "file_write": "_fl_file_write",
  "char_at": "_fl_char_at",
  "char-at": "_fl_char_at",
  "substring": "_fl_substring",
  "true?": "_fl_true_q",
  "false?": "_fl_false_q",
  "string?": "_fl_string_q",
  "number?": "_fl_number_q",
  "list?": "_fl_list_q",
  "array?": "_fl_array_q",
  "map?": "_fl_map_q",
  "fn?": "_fl_fn_q",
  "empty?": "_fl_empty_q",

  // 문자 검증 (lexer 헬퍼)
  "is-digit?": "_fl_is_digit_q",
  "is-alpha?": "_fl_is_alpha_q",
  "is-alnum?": "_fl_is_alnum_q",
  "is-space?": "_fl_is_space_q",
  "is-symbol-char?": "_fl_is_symbol_char_q",

  // 기본 연산
  "map": "_fl_map",
  "filter": "_fl_filter",
  "reduce": "_fl_reduce",
  "first": "_fl_first",
  "last": "_fl_last",
  "rest": "_fl_rest",
  "append": "_fl_append", "slice": "_fl_slice",
  "length": "_fl_length",
  "range": "_fl_range",

  // 문자열
  "str": "_fl_str",
  "contains?": "_fl_contains_q",
  "str-contains": "_fl_contains_q",
  "upper": "_fl_upper",
  "str-upper": "_fl_upper",
  "lower": "_fl_lower",
  "str-lower": "_fl_lower",
  "trim": "_fl_trim",

  "str-index-of": "_fl_str_index_of",
  "str_index_of": "_fl_str_index_of",

  // 맵/객체
  "get": "_fl_get",
  "keys": "_fl_keys",
  "json_keys": "_fl_keys",
  "map-set": "_fl_map_set", "json-set": "_fl_map_set", "json_set": "_fl_map_set",
  "has-key?": "_fl_has_key_q",
};

// JavaScript 예약어 목록
const JS_RESERVED = new Set([
  "abstract", "arguments", "await", "boolean", "break", "byte", "case", "catch",
  "char", "class", "const", "continue", "debugger", "default", "delete", "do",
  "double", "else", "enum", "eval", "export", "extends", "false", "final",
  "finally", "float", "for", "function", "goto", "if", "implements", "import",
  "in", "instanceof", "int", "interface", "let", "long", "native", "new",
  "null", "package", "private", "protected", "public", "return", "short", "static",
  "super", "switch", "synchronized", "this", "throw", "throws", "transient",
  "true", "try", "typeof", "var", "void", "volatile", "while", "with", "yield"
]);

// FL 심볼을 JS 유효 식별자로 인코딩
function flNameToJs(name: string): string {
  // BUILTIN_MAP에 있으면 직접 매핑
  if (BUILTIN_MAP[name]) {
    return BUILTIN_MAP[name];
  }

  // 일반 심볼 인코딩: 특수문자 → 안전한 이름
  const encoded = name
    .replace(/\?$/g, "_q")      // 끝의 ? → _q
    .replace(/!/g, "_bang")     // ! → _bang
    .replace(/>/g, "_gt")       // > → _gt
    .replace(/</g, "_lt")       // < → _lt
    .replace(/=/g, "_eq")       // = → _eq
    .replace(/\+/g, "_plus")    // + → _plus
    .replace(/\*/g, "_star")    // * → _star
    .replace(/\//g, "_slash")   // / → _slash
    .replace(/-/g, "_");        // - → _ (마지막에 처리)

  // JavaScript 예약어 체크
  if (JS_RESERVED.has(encoded)) {
    return `_${encoded}`;
  }

  return encoded;
}

export class JSCodegen {
  private opts: CodegenOptions;
  private exportedNames: string[] = [];

  constructor() {
    this.opts = { ...DEFAULT_OPTIONS };
  }

  generate(nodes: ASTNode[], opts?: Partial<CodegenOptions>): string {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
    this.exportedNames = [];

    const parts: string[] = [];

    // 런타임 헬퍼 함수 프리앰블 (항상 포함 - self-hosting 지원)
    parts.push(generateRuntimePreamble());
    parts.push("");

    // 추가 런타임 인라인 포함 (레거시)
    if (this.opts.runtime) {
      parts.push(FL_RUNTIME);
      parts.push("");
    }

    // 노드 코드 생성
    const bodyParts: string[] = [];
    for (const node of nodes) {
      const code = this.genNode(node);
      if (code !== "") {
        bodyParts.push(code);
      }
    }
    parts.push(...bodyParts);

    // 모듈 export 처리
    if (this.exportedNames.length > 0) {
      if (this.opts.module === "commonjs") {
        const exports = this.exportedNames
          .map((n) => `  ${n}: ${n}`)
          .join(",\n");
        parts.push(`module.exports = {\n${exports}\n};`);
      } else if (this.opts.module === "esm") {
        const exports = this.exportedNames.join(", ");
        parts.push(`export { ${exports} };`);
      }
    } else {
      // export 없어도 모듈 형식 표시 (빈 exports)
      if (this.opts.module === "commonjs") {
        // 기본적으로 module.exports 세팅만
        if (bodyParts.some((p) => p.startsWith("function "))) {
          // 함수가 있으면 자동으로 exports 추가
          const funcNames = bodyParts
            .filter((p) => p.startsWith("function "))
            .map((p) => {
              const m = p.match(/^function\s+(\w+)/);
              return m ? m[1] : null;
            })
            .filter(Boolean) as string[];
          if (funcNames.length > 0) {
            const exportsStr = funcNames.map((n) => `  ${n}: ${n}`).join(",\n");
            parts.push(`module.exports = {\n${exportsStr}\n};`);
          }
        }
      }
    }

    const result = parts.join("\n");
    return this.opts.minify ? this.minify(result) : result;
  }

  genNode(node: ASTNode): string {
    switch (node.kind) {
      case "literal":
        return this.genLiteral(node);
      case "template-string":
        return this.genTemplateString(node);
      case "variable":
        return this.genVariable(node);
      case "sexpr":
        return this.genSExpr(node);
      case "block":
        return this.genBlock(node);
      case "keyword":
        return this.genKeyword(node as Keyword);
      case "try-block":
        return this.genTryBlock(node as any);
      default:
        return `/* unsupported: ${(node as any).kind} */`;
    }
  }

  genLiteral(node: Literal): string {
    if (node.type === "string") {
      return JSON.stringify(node.value);
    } else if (node.type === "boolean") {
      return node.value ? "true" : "false";
    } else if (node.type === "null") {
      return "null";
    } else if (node.type === "symbol") {
      if (node.value === "nil" || node.value === "null") {
        return "null";
      }
      const cleanName = String(node.value).replace(/^\$/, "");
      return flNameToJs(cleanName);
    } else {
      return String(node.value);
    }
  }

  private genTemplateString(node: any): string {
    const value = node.value;
    let jsCode = "`";
    let i = 0;
    while (i < value.length) {
      if (value[i] === "$" && value[i + 1] === "{") {
        const start = i + 2;
        const end = value.indexOf("}", start);
        if (end > start) {
          const expr = value.slice(start, end).trim();
          const jsExpr = this.genNode({ kind: "variable", name: expr } as any);
          jsCode += "${" + jsExpr + "}";
          i = end + 1;
          continue;
        }
      }
      if (value[i] === "`") {
        jsCode += "\\`";
      } else if (value[i] === "\\") {
        jsCode += "\\\\";
      } else {
        jsCode += value[i];
      }
      i++;
    }
    jsCode += "`";
    return jsCode;
  }

  private genVariable(node: Variable): string {
    const cleanName = node.name.replace(/^\$/, "");
    return flNameToJs(cleanName);
  }

  private genKeyword(node: Keyword): string {
    return JSON.stringify(node.name);
  }

  genSExpr(node: SExpr): string {
    const { op, args } = node;

    if (op === "and") return "(" + args.map(a => this.genNode(a)).join(" && ") + ")";
    if (op === "or") return "(" + args.map(a => this.genNode(a)).join(" || ") + ")";
    if (op === "cond") return this.genCond(args);
    if (op === "while") return this.genWhile(args);
    if (op === "loop") return this.genLoop(args);

    if (op in BINARY_OPS && args.length === 2) {
      const left = this.genNode(args[0]);
      const right = this.genNode(args[1]);
      return `(${left} ${BINARY_OPS[op]} ${right})`;
    }

    if (op === "-" && args.length === 1) {
      return `(-${this.genNode(args[0])})`;
    }

    if (op === "not" && args.length === 1) {
      return `(!${this.genNode(args[0])})`;
    }

    if (op === "if") {
      const cond = this.genNode(args[0]);
      const thenExpr = this.genNode(args[1]);
      const elseExpr = args[2] ? this.genNode(args[2]) : "undefined";
      return `(${cond} ? ${thenExpr} : ${elseExpr})`;
    }

    if (op === "define") {
      const varName = this.extractVarName(args[0]);
      const value = this.genNode(args[1]);
      return `let ${varName} = ${value};`;
    }

    if (op === "set!") {
      const varName = this.extractVarName(args[0]);
      const value = this.genNode(args[1]);
      return `(${varName} = ${value})`;
    }

    if (op === "defn" || op === "defun") {
      const name = this.extractVarName(args[0]);
      const params = this.extractParamList(args[1]);
      const body = args[2] ? this.genNode(args[2]) : "undefined";
      return `function ${name}(${params.join(", ")}) { return ${body}; }`;
    }

    if (op === "fn") return this.genFn(args);
    if (op === "do") return this.genDo(args);

    if (op === "list") {
      const elements = args.map((a) => this.genNode(a));
      return `[${elements.join(", ")}]`;
    }

    if (op === "str-concat") {
      const parts = args.map((a) => this.genNode(a));
      return `('' + ${parts.join(" + ")})`;
    }

    if (op === "print" || op === "println") {
      const arg = args.length > 0 ? this.genNode(args[0]) : '""';
      return `_fl_print(${arg})`;
    }

    if (op === "map") return `_fl_map(${this.genNode(args[1])}, ${this.genNode(args[0])})`;
    if (op === "filter") return `_fl_filter(${this.genNode(args[1])}, ${this.genNode(args[0])})`;
    if (op === "reduce") return `_fl_reduce(${this.genNode(args[2])}, ${this.genNode(args[0])}, ${this.genNode(args[1])})`;

    if (op === "export") {
      for (const arg of args) {
        if (arg.kind === "variable") {
          this.exportedNames.push(arg.name);
        } else if (arg.kind === "literal" && typeof arg.value === "string") {
          this.exportedNames.push(arg.value);
        }
      }
      return "";
    }

    if (op === "let") {
      if (args.length >= 2) {
        const bindingsArg = args[0];
        let bindings: ASTNode[] = [];
        if (bindingsArg.kind === "block" && (bindingsArg as Block).type === "Array") {
          bindings = (bindingsArg as Block).fields.get("items") as any || [];
        } else if (bindingsArg.kind === "sexpr") {
          bindings = (bindingsArg as SExpr).args;
        }

        const bindingStmts: string[] = [];
        for (const binding of bindings) {
          if (binding.kind === "block" && (binding as Block).type === "Array") {
            const pairItems = (binding as Block).fields.get("items") as any || [];
            if (pairItems.length >= 2) {
              const varName = this.extractVarName(pairItems[0]);
              const value = this.genNode(pairItems[1]);
              bindingStmts.push(`let ${varName} = ${value};`);
            }
          }
        }

        const bodyStmts = args.slice(1).map((a) => this.genNode(a)).join("; ");
        return `(() => { ${bindingStmts.join(" ")} return ${bodyStmts}; })()`;
      }
      const varName = this.extractVarName(args[0]);
      const value = args[1] ? this.genNode(args[1]) : "undefined";
      return `(() => { let ${varName} = ${value}; return ${varName}; })()`;
    }

    return this.genFuncCall(op, args);
  }

  private genCond(args: any[]): string {
    if (args.length === 0) return "null";
    const clauses = args.map(arg => {
      if (arg.kind === "block" && arg.type === "Array") return arg.fields.get("items") || [];
      return Array.isArray(arg) ? arg : [arg];
    });
    let res = "null";
    for (let i = clauses.length - 1; i >= 0; i--) {
      const pair = clauses[i];
      const test = this.genNode(pair[0]);
      const body = pair[1] ? this.genNode(pair[1]) : "null";
      res = "(" + test + " ? " + body + " : " + res + ")";
    }
    return res;
  }

  private genWhile(args: any[]): string {
    const cond = this.genNode(args[0]);
    const body = args.slice(1).map(a => this.genNode(a)).join("; ");
    return "(() => { while(" + cond + ") { " + body + " } })()";
  }

  private genLoop(args: any[]): string {
    const bindingsBlock = args[0];
    const bodyExprs = args.slice(1);
    let items = [];
    if (bindingsBlock.kind === "block" && bindingsBlock.type === "Array") items = bindingsBlock.fields.get("items") || [];
    const inits = [];
    for (let i = 0; i < items.length; i += 2) {
      const name = items[i].name ? items[i].name.replace(/^\$/, "") : "p";
      const val = this.genNode(items[i+1]);
      inits.push("let " + name + " = " + val);
    }
    const bodyCode = bodyExprs.map(e => this.genNode(e)).join("; ");
    return "(() => { " + inits.join("; ") + "; while(true) { " + bodyCode + "; break; } })()";
  }

  private genFn(args: ASTNode[]): string {
    const params = this.extractParamList(args[0]);
    const body = args[1] ? this.genNode(args[1]) : "undefined";
    return `((${params.join(", ")}) => ${body})`;
  }

  private genDo(args: ASTNode[]): string {
    if (args.length === 0) return "(() => undefined)()";
    if (args.length === 1) return `(() => ${this.genNode(args[0])})()`;
    const stmts = args.slice(0, -1).map((a) => {
      const c = this.genNode(a).trim();
      return (c === "" || c.endsWith(";")) ? c : c + ";";
    }).filter(s => s !== "");
    const last = this.genNode(args[args.length - 1]);
    return `(() => { ${stmts.join(" ")} return ${last}; })()`;
  }

  private genFuncCall(op: string, args: ASTNode[]): string {
    const argStrs = args.map((a) => this.genNode(a));
    const jsOp = flNameToJs(op);
    return `${jsOp}(${argStrs.join(", ")})`;
  }

  genBlock(node: Block): string {
    switch (node.type) {
      case "FUNC": return this.genFuncBlock(node);
      case "MODULE": return this.genModuleBlock(node);
      case "SERVICE": return this.genServiceBlock(node);
      case "MODEL": return this.genModelBlock(node);
      case "CONTROLLER": return this.genControllerBlock(node);
      case "MAP": case "Map": return this.genMapBlock(node);
      case "ARRAY": case "Array": return this.genArrayBlock(node);
      default: return `/* unsupported block: ${node.type} */`;
    }
  }

  private genMapBlock(node: Block): string {
    const pairs: string[] = [];
    node.fields.forEach((val, key) => {
      if (key === "items" && node.type === "Map") return;
      const jsKey = key.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/) ? key : JSON.stringify(key);
      pairs.push(jsKey + ": " + this.genNode(val as any));
    });
    return "{ " + pairs.join(", ") + " }";
  }

  private genArrayBlock(node: Block): string {
    const items = node.fields.get("items");
    let pNodes = Array.isArray(items) ? items : ((items as any) && (items as any).kind === "block" ? (items as any).fields.get("items") : []);
    const elements = (pNodes || []).map((a: any) => this.genNode(a));
    return "[" + elements.join(", ") + "]";
  }

  private genFuncBlock(node: Block): string {
    const params = this.extractBlockParams(node);
    const body = node.fields.get("body");
    const bodyCode = body ? this.genNode(body as ASTNode) : "undefined";
    const jsName = this.flNameToJs(node.name);
    return `function ${jsName}(${params.join(", ")}) { return ${bodyCode}; }`;
  }

  private flNameToJs(name: string): string {
    return flNameToJs(name);
  }

  private genModuleBlock(node: Block): string {
    const body = node.fields.get("body");
    if (!body) return "";
    if (Array.isArray(body)) return body.map((n) => this.genNode(n)).join("\n");
    return this.genNode(body as ASTNode);
  }

  private genServiceBlock(node: Block): string {
    const name = node.name;
    const methods = node.fields.get("methods");
    const inject = node.fields.get("inject");
    const injectParams = inject ? (Array.isArray(inject) ? (inject as any[]).map((dep: any) => `private ${dep.name || dep}: ${dep.name || dep}`).join(", ") : "") : "";
    let methodsCode = "";
    if (methods && methods.kind === "sexpr") {
      methodsCode = (methods as SExpr).args.map((arg) => {
        if (arg.kind === "sexpr" && arg.op === "fn") {
          const fnExpr = arg as SExpr;
          const fnName = (fnExpr.args[0] as any).name || (fnExpr.args[0] as any).value || "method";
          const fnParams = this.extractParamList(fnExpr.args[1]).map((p) => p.replace(/^\$/, "")).join(", ");
          const fnBody = fnExpr.args[2] ? this.genNode(fnExpr.args[2]) : "undefined";
          return `  ${fnName}(${fnParams}) { return ${fnBody}; }`;
        }
        return "";
      }).filter(Boolean).join("\n");
    }
    return [`export class ${name} {`, injectParams ? `  constructor(${injectParams}) {}` : `  constructor() {}`, methodsCode, `}`].join("\n");
  }

  private genModelBlock(node: Block): string {
    const name = node.name;
    const table = node.fields.get("table") || name.toLowerCase() + "s";
    const fields = node.fields.get("fields");
    let sqlColumns = "  id SERIAL PRIMARY KEY";
    if (fields && fields.kind === "sexpr") {
      for (const arg of (fields as SExpr).args) {
        if (arg.kind === "sexpr") {
          const fName = (arg as SExpr).op.replace(/^[\$:]/, "").replace(/-/g, "_");
          sqlColumns += `,\n  ${fName} VARCHAR(255)`;
        }
      }
    }
    return [`CREATE TABLE IF NOT EXISTS ${table} (`, sqlColumns, `,\n  created_at TIMESTAMP DEFAULT NOW(),\n  updated_at TIMESTAMP DEFAULT NOW()\n);`].join("\n");
  }

  private genControllerBlock(node: Block): string {
    const prefix = node.fields.get("prefix") || "/";
    const routes = node.fields.get("routes");
    let routeCode = "";
    if (routes && routes.kind === "sexpr") {
      const sExpr = routes as SExpr;
      for (let i = 0; i < sExpr.args.length; i += 3) {
        const method = String((sExpr.args[i] as any).value || "GET").toLowerCase();
        const route = String((sExpr.args[i+1] as any).value || "/");
        routeCode += `router.${method}("${prefix === "/" ? route : prefix + route}", async (req, res) => { res.json({ status: 200 }); });\n`;
      }
    }
    return [`import { Router } from "express";`, `export const router = Router();`, routeCode].join("\n");
  }

  private genTryBlock(node: any): string {
    const body = this.genNode(node.body);
    const parts: string[] = [`(()=>{try{return ${body};}`];
    if (node.catchClauses) {
      for (const cc of node.catchClauses) {
        parts.push(`catch(${cc.variable || "err"}){return ${this.genNode(cc.handler)};}`);
      }
    }
    if (node.finallyBlock) parts.push(`finally{${this.genNode(node.finallyBlock)};}`);
    return parts.join("") + "})()";
  }

  private extractVarName(node: ASTNode): string {
    if (node.kind === "variable") return flNameToJs(node.name.replace(/^\$/, ""));
    if (node.kind === "literal" && typeof node.value === "string") return flNameToJs(node.value);
    return "unknown";
  }

  private extractParamList(node: ASTNode): string[] {
    if (!node) return [];
    let pNodes = (node as any).kind === "block" && (node as any).type === "Array" ? (node as any).fields.get("items") : (node.kind === "sexpr" ? node.args : [node]);
    return (pNodes || []).map((p: any) => (p.name || String(p.value || "p")).replace(/^\\$/, "")).map(n => flNameToJs(n));
  }

  private extractBlockParams(node: Block): string[] {
    const params = node.fields.get("params");
    if (!params) return [];
    let pNodes = Array.isArray(params) ? params : ((params as any).kind === "block" && (params as any).type === "Array" ? (params as any).fields.get("items") : [params]);
    return (pNodes || []).map((p: any) => (p.name || String(p.value || "p")).replace(/^\\$/, "")).map(n => flNameToJs(n));
  }

  private minify(code: string): string {
    return code.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, " ").trim();
  }
}
