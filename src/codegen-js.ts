// FreeLang v9: Phase 85 — FL AST → JavaScript 코드 생성기
// FL AST를 JavaScript 코드로 변환해 Node.js나 브라우저에서 실행 가능한 파일 생성

import { ASTNode, Block, Literal, TemplateString, Variable, SExpr, Keyword } from "./ast";

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
function __fl_map(arr, fn) { return arr.map(fn); }
function __fl_filter(arr, fn) { return arr.filter(fn); }
function __fl_reduce(arr, fn, init) { return arr.reduce(fn, init); }
function __fl_print(v) { console.log(v); return v; }
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
  "append": "_fl_append",
  "length": "_fl_length",

  // 문자열
  "str": "_fl_str",
  "contains?": "_fl_contains_q",
  "upper": "_fl_upper",
  "lower": "_fl_lower",
  "trim": "_fl_trim",

  // 맵/객체
  "get": "_fl_get",
  "keys": "_fl_keys",
  "map-set": "_fl_map_set",
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

    // 런타임 인라인 포함
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
      // nil/null 특수 처리
      if (node.value === "nil" || node.value === "null") {
        return "null";
      }
      // 다른 심볼은 변수 참조로 취급
      const cleanName = String(node.value).replace(/^\$/, "");
      return flNameToJs(cleanName);
    } else {
      // number
      return String(node.value);
    }
  }

  private genTemplateString(node: any): string {
    const value = node.value;
    // Convert FreeLang template ${...} to JavaScript template `...${...}`
    // Parse and transform: "Hello ${name}" → `Hello ${name}`
    // Also handle variable extraction: ensure variables are properly JS-named

    let jsCode = "`";
    let i = 0;
    while (i < value.length) {
      // Check for ${...} pattern
      if (value[i] === "$" && value[i + 1] === "{") {
        const start = i + 2;
        const end = value.indexOf("}", start);
        if (end > start) {
          const expr = value.slice(start, end).trim();
          // Translate FreeLang variable/expression to JavaScript
          const jsExpr = this.genNode({ kind: "variable", name: expr });
          jsCode += "${" + jsExpr + "}";
          i = end + 1;
          continue;
        }
      }
      // Handle escape sequences and special characters in template
      if (value[i] === "`") {
        jsCode += "\\`"; // Escape backticks in template literals
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
    // Variable.name: "cases-js" → "cases_js" (유효한 JS 식별자로 인코딩)
    // $ 접두사는 이미 Bootstrap parser에서 제거됨
    const cleanName = node.name.replace(/^\$/, ""); // $ 제거 (있으면)
    return flNameToJs(cleanName);
  }

  private genKeyword(node: Keyword): string {
    return JSON.stringify(node.name);
  }

  genSExpr(node: SExpr): string {
    const { op, args } = node;

    // 이항 연산자
    if (op in BINARY_OPS && args.length === 2) {
      const left = this.genNode(args[0]);
      const right = this.genNode(args[1]);
      return `(${left} ${BINARY_OPS[op]} ${right})`;
    }

    // 단항 연산자
    if (op === "not" && args.length === 1) {
      return `(!${this.genNode(args[0])})`;
    }

    // if → 삼항 연산자
    if (op === "if") {
      const cond = this.genNode(args[0]);
      const thenExpr = this.genNode(args[1]);
      const elseExpr = args[2] ? this.genNode(args[2]) : "undefined";
      return `(${cond} ? ${thenExpr} : ${elseExpr})`;
    }

    // define → let 선언
    if (op === "define") {
      const varName = this.extractVarName(args[0]);
      const value = this.genNode(args[1]);
      return `let ${varName} = ${value};`;
    }

    // set! → 할당
    if (op === "set!") {
      const varName = this.extractVarName(args[0]);
      const value = this.genNode(args[1]);
      return `${varName} = ${value};`;
    }

    // fn → 화살표 함수
    if (op === "fn") {
      return this.genFn(args);
    }

    // do → IIFE (즉시 실행 함수)
    if (op === "do") {
      return this.genDo(args);
    }

    // list → 배열 리터럴
    if (op === "list") {
      const elements = args.map((a) => this.genNode(a));
      return `[${elements.join(", ")}]`;
    }

    // str-concat → 문자열 연결
    if (op === "str-concat") {
      const parts = args.map((a) => this.genNode(a));
      return `('' + ${parts.join(" + ")})`;
    }

    // print / println → console.log
    if (op === "print" || op === "println") {
      const arg = args.length > 0 ? this.genNode(args[0]) : '""';
      return `__fl_print(${arg})`;
    }

    // map → __fl_map
    if (op === "map") {
      const arr = this.genNode(args[0]);
      const fn = this.genNode(args[1]);
      return `__fl_map(${arr}, ${fn})`;
    }

    // filter → __fl_filter
    if (op === "filter") {
      const arr = this.genNode(args[0]);
      const fn = this.genNode(args[1]);
      return `__fl_filter(${arr}, ${fn})`;
    }

    // reduce → __fl_reduce
    if (op === "reduce") {
      const arr = this.genNode(args[0]);
      const fn = this.genNode(args[1]);
      const init = args[2] ? this.genNode(args[2]) : "undefined";
      return `__fl_reduce(${arr}, ${fn}, ${init})`;
    }

    // export → 내보내기 목록에 추가
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

    // let → let 선언 (변수명 = 값)
    if (op === "let") {
      // (let [[$x 10] [$y 20]] body) 또는 (let [[x val]] body)
      if (args.length >= 2) {
        const bindingsArg = args[0];
        let bindings: ASTNode[] = [];

        // bindings이 Array 블록이면 items 추출, sexpr이면 args 사용
        if (bindingsArg.kind === "block" && (bindingsArg as Block).type === "Array") {
          const block = bindingsArg as Block;
          const items = block.fields.get("items");
          // DEBUG: Check if items is being extracted correctly
          if (!Array.isArray(items)) {
            console.error("DEBUG let: block.fields.get('items') returned:", items);
            console.error("DEBUG let: block.fields keys:", Array.from(block.fields.keys()));
            console.error("DEBUG let: block object:", block);
          }
          bindings = Array.isArray(items) ? items : [];
        } else if (bindingsArg.kind === "sexpr") {
          bindings = (bindingsArg as SExpr).args;
        }

        // 2D 형식: [[$x 10] [$y 20]] → 각 pair는 Array 블록
        const bindingStmts: string[] = [];
        for (const binding of bindings) {
          if (binding.kind === "block" && (binding as Block).type === "Array") {
            // 2D: [[$x 10]]
            const pairItems = (binding as Block).fields.get("items");
            if (Array.isArray(pairItems) && pairItems.length >= 2) {
              const varName = this.extractVarName(pairItems[0]);
              const value = this.genNode(pairItems[1]);
              bindingStmts.push(`let ${varName} = ${value};`);
            }
          }
        }

        const bodyStmts = args
          .slice(1)
          .map((a) => this.genNode(a))
          .join("\n");
        return `(() => { ${bindingStmts.join(" ")} return ${bodyStmts}; })()`;
      }
      // 단순 let (fallback)
      const varName = this.extractVarName(args[0]);
      const value = args[1] ? this.genNode(args[1]) : "undefined";
      return `(() => { let ${varName} = ${value}; return ${varName}; })()`;
    }

    // 함수 호출 (일반)
    const fnExpr = this.genFuncCall(op, args);
    return fnExpr;
  }

  private genFn(args: ASTNode[]): string {
    // (fn [$x $y] body)
    // args[0] = params 리스트 (SExpr 또는 배열)
    // args[1] = body
    const params = this.extractParamList(args[0]);
    const body = args[1] ? this.genNode(args[1]) : "undefined";
    return `((${params.join(", ")}) => ${body})`;
  }

  private genDo(args: ASTNode[]): string {
    // (do e1 e2 ... eN) → (() => { e1; e2; return eN; })()
    if (args.length === 0) return "(() => undefined)()";
    if (args.length === 1) return `(() => ${this.genNode(args[0])})()`;

    const stmts = args.slice(0, -1).map((a) => {
      const code = this.genNode(a);
      return code.endsWith(";") ? code : `${code};`;
    });
    const last = this.genNode(args[args.length - 1]);
    return `(() => { ${stmts.join(" ")} return ${last}; })()`;
  }

  private genFuncCall(op: string, args: ASTNode[]): string {
    const argStrs = args.map((a) => this.genNode(a));
    // semantic 매핑: builtin 또는 인코딩된 함수명 사용
    const jsOp = flNameToJs(op);
    return `${jsOp}(${argStrs.join(", ")})`;
  }

  genBlock(node: Block): string {
    switch (node.type) {
      case "FUNC":
        return this.genFuncBlock(node);
      case "MODULE":
        return this.genModuleBlock(node);
      case "SERVICE":
        return this.genServiceBlock(node);
      case "MODEL":
        return this.genModelBlock(node);
      case "CONTROLLER":
        return this.genControllerBlock(node);
      case "MAP":
      case "Map":
        return this.genMapBlock(node);
      case "ARRAY":
      case "Array":
        return this.genArrayBlock(node);
      default:
        return `/* unsupported block: ${node.type} */`;
    }
  }

  private genMapBlock(node: Block): string {
    // Map 리터럴: {:key1 val1 :key2 val2 ...} → { key1: val1, key2: val2, ... }
    const items = node.fields.get("items");
    if (!items) return "{}";

    const pairs: string[] = [];
    if (Array.isArray(items)) {
      // 키-값 쌍: [key1, val1, key2, val2, ...]
      for (let i = 0; i < items.length; i += 2) {
        const keyNode = items[i];
        const valNode = items[i + 1];

        // 키 추출 (문자열 또는 키워드)
        let key: string;
        if (keyNode.kind === "literal" && typeof keyNode.value === "string") {
          key = keyNode.value;
        } else if (keyNode.kind === "keyword") {
          key = keyNode.name;
        } else {
          key = this.genNode(keyNode);
        }

        const val = this.genNode(valNode);
        pairs.push(`${key}: ${val}`);
      }
    }

    return `{ ${pairs.join(", ")} }`;
  }

  private genArrayBlock(node: Block): string {
    // 배열 리터럴: [item1 item2 ...] → [ item1, item2, ... ]
    const items = node.fields.get("items");
    if (!items) return "[]";
    const elements = (Array.isArray(items) ? items : [items]).map((item) => this.genNode(item as ASTNode));
    return `[ ${elements.join(", ")} ]`;
  }

  private genFuncBlock(node: Block): string {
    // [FUNC name :params [$a $b] :body body]
    const params = this.extractBlockParams(node);
    const body = node.fields.get("body");
    const bodyCode = body ? this.genNode(body as ASTNode) : "undefined";
    const jsName = this.flNameToJs(node.name);
    return `function ${jsName}(${params.join(", ")}) { return ${bodyCode}; }`;
  }

  private flNameToJs(name: string): string {
    // Global flNameToJs 함수에 위임 (예약어 + 특수문자 처리)
    return flNameToJs(name);
  }

  private genModuleBlock(node: Block): string {
    const body = node.fields.get("body");
    if (!body) return "";
    if (Array.isArray(body)) {
      return body.map((n) => this.genNode(n)).join("\n");
    }
    return this.genNode(body as ASTNode);
  }

  private genServiceBlock(node: Block): string {
    const name = node.name;
    const methods = node.fields.get("methods");
    const inject = node.fields.get("inject");

    const injectParams = inject
      ? Array.isArray(inject)
        ? (inject as any[])
            .map((dep: any) => {
              const depName =
                dep.kind === "variable" ? dep.name : dep.kind === "literal" ? String(dep.value) : String(dep);
              return `private ${depName}: ${depName}`;
            })
            .join(", ")
        : ""
      : "";

    let methodsCode = "";
    if (methods && methods.kind === "sexpr") {
      const sExpr = methods as SExpr;
      methodsCode = sExpr.args
        .map((arg) => {
          if (arg.kind === "sexpr" && arg.op === "fn") {
            const fnExpr = arg as SExpr;
            const fnNameArg = fnExpr.args[0];
            const fnParamsArg = fnExpr.args[1];
            const fnBodyArg = fnExpr.args[2];

            const fnName =
              fnNameArg.kind === "variable" ? fnNameArg.name.replace(/^\$/, "") : fnNameArg.kind === "literal" ? String((fnNameArg as any).value) : "method";
            const fnParams = this.extractParamList(fnParamsArg)
              .map((p) => p.replace(/^\$/, ""))
              .join(", ");
            const fnBody = fnBodyArg ? this.genNode(fnBodyArg) : "undefined";

            return `  ${fnName}(${fnParams}) { return ${fnBody}; }`;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }

    return [
      `// Generated by FreeLang v11 — SERVICE block`,
      `export class ${name} {`,
      injectParams ? `  constructor(${injectParams}) {}` : `  constructor() {}`,
      methodsCode,
      `}`,
    ].join("\n");
  }

  private genModelBlock(node: Block): string {
    const name = node.name;
    const table = node.fields.get("table") || name.toLowerCase() + "s";
    const fields = node.fields.get("fields");

    let sqlColumns = "  id SERIAL PRIMARY KEY";
    let tsInterface = `export interface ${name} {\n  id: number;`;

    if (fields && fields.kind === "sexpr") {
      const sExpr = fields as SExpr;
      for (const arg of sExpr.args) {
        if (arg.kind === "sexpr") {
          const fieldExpr = arg as SExpr;
          const fieldName =
            fieldExpr.op.startsWith("$") || fieldExpr.op.startsWith(":") ? fieldExpr.op : String((fieldExpr.args[0] as any).value || fieldExpr.op);
          const cleanFieldName = fieldName.replace(/^[\$:]/, "").replace(/-/g, "_");

          sqlColumns += `,\n  ${cleanFieldName} VARCHAR(255)`;
          tsInterface += `\n  ${cleanFieldName.replace(/_/g, "")}: string;`;
        }
      }
    }

    tsInterface += `\n  createdAt: Date;\n  updatedAt: Date;\n}`;

    return [
      `-- Generated by FreeLang v11 — MODEL block (SQL)`,
      `CREATE TABLE IF NOT EXISTS ${table} (`,
      sqlColumns,
      `,\n  created_at TIMESTAMP DEFAULT NOW(),`,
      `\n  updated_at TIMESTAMP DEFAULT NOW()`,
      `\n);`,
      ``,
      `// TypeScript interface`,
      tsInterface,
    ].join("\n");
  }

  private genControllerBlock(node: Block): string {
    const prefix = node.fields.get("prefix") || "/";
    const routes = node.fields.get("routes");

    let routeCode = "";
    if (routes && routes.kind === "sexpr") {
      const sExpr = routes as SExpr;
      for (let i = 0; i < sExpr.args.length; i += 2) {
        const methodLit = sExpr.args[i];
        const routeLit = sExpr.args[i + 1];
        const handlerLit = sExpr.args[i + 2];

        const method = methodLit.kind === "literal" ? String((methodLit as any).value) : "GET";
        const route = routeLit.kind === "literal" ? String((routeLit as any).value) : "/";
        const fullRoute = prefix === "/" ? route : `${prefix}${route}`;

        routeCode += `router.${method.toLowerCase()}("${fullRoute}", async (req, res) => {
  try {
    // TODO: Execute handler
    res.json({ status: 200 });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
`;
      }
    }

    return [
      `// Generated by FreeLang v11 — CONTROLLER block`,
      `import { Router } from "express";`,
      `export const router = Router();`,
      ``,
      routeCode,
    ].join("\n");
  }

  private genTryBlock(node: any): string {
    // node: {kind: "try-block", body: ASTNode, catchClauses?: CatchClause[], finallyBlock?: ASTNode}
    const body = this.genNode(node.body);
    const parts: string[] = [`(()=>{try{return ${body};}`];

    // catch clauses
    if (node.catchClauses && node.catchClauses.length > 0) {
      for (const catchClause of node.catchClauses) {
        const param = catchClause.variable || "err";
        const handler = this.genNode(catchClause.handler);
        parts.push(`catch(${param}){return ${handler};}`);
      }
    }

    // finally block
    if (node.finallyBlock) {
      const finallyCode = this.genNode(node.finallyBlock);
      parts.push(`finally{${finallyCode};}`);
    }

    parts.push(`})()`);
    return parts.join("");
  }

  private extractVarName(node: ASTNode): string {
    if (node.kind === "variable") {
      const name = node.name.replace(/^\$/, "");
      return flNameToJs(name); // $x → x
    }
    if (node.kind === "literal" && typeof node.value === "string") {
      return flNameToJs(node.value); // x 그대로 ($ 추가 금지)
    }
    return "unknown";
  }

  private extractParamList(node: ASTNode): string[] {
    if (!node) return [];
    if (node.kind === "sexpr") {
      // (list $x $y ...) 형태
      return node.args.map((a) => {
        if (a.kind === "variable") return a.name;
        if (a.kind === "literal") return `$${a.value}`;
        return "$p";
      });
    }
    // 단일 파라미터
    if (node.kind === "variable") return [node.name];
    return [];
  }

  private extractBlockParams(node: Block): string[] {
    const params = node.fields.get("params");
    if (!params) return [];
    if (Array.isArray(params)) {
      return params.map((p) => {
        if (p.kind === "variable") return p.name;
        if (p.kind === "literal") return `$${p.value}`;
        return "$p";
      });
    }
    // 단일 노드
    const p = params as ASTNode;
    if (p.kind === "variable") return [p.name];
    return [];
  }

  private minify(code: string): string {
    return code
      .replace(/\/\/[^\n]*/g, "") // 주석 제거
      .replace(/\s+/g, " ")       // 공백 정규화
      .trim();
  }
}
