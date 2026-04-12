"use strict";
// FreeLang v9: Phase 85 — FL AST → JavaScript 코드 생성기
// FL AST를 JavaScript 코드로 변환해 Node.js나 브라우저에서 실행 가능한 파일 생성
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSCodegen = void 0;
const DEFAULT_OPTIONS = {
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
const BINARY_OPS = {
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
class JSCodegen {
    constructor() {
        this.exportedNames = [];
        this.opts = { ...DEFAULT_OPTIONS };
    }
    generate(nodes, opts) {
        this.opts = { ...DEFAULT_OPTIONS, ...opts };
        this.exportedNames = [];
        const parts = [];
        // 런타임 인라인 포함
        if (this.opts.runtime) {
            parts.push(FL_RUNTIME);
            parts.push("");
        }
        // 노드 코드 생성
        const bodyParts = [];
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
            }
            else if (this.opts.module === "esm") {
                const exports = this.exportedNames.join(", ");
                parts.push(`export { ${exports} };`);
            }
        }
        else {
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
                        .filter(Boolean);
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
    genNode(node) {
        switch (node.kind) {
            case "literal":
                return this.genLiteral(node);
            case "variable":
                return this.genVariable(node);
            case "sexpr":
                return this.genSExpr(node);
            case "block":
                return this.genBlock(node);
            case "keyword":
                return this.genKeyword(node);
            default:
                return `/* unsupported: ${node.kind} */`;
        }
    }
    genLiteral(node) {
        if (node.type === "string") {
            return JSON.stringify(node.value);
        }
        else if (node.type === "boolean") {
            return node.value ? "true" : "false";
        }
        else if (node.type === "null") {
            return "null";
        }
        else if (node.type === "symbol") {
            // symbol은 문자열로 처리
            return JSON.stringify(node.value);
        }
        else {
            // number
            return String(node.value);
        }
    }
    genVariable(node) {
        // $x → $x (그대로 유지)
        return node.name;
    }
    genKeyword(node) {
        return JSON.stringify(node.name);
    }
    genSExpr(node) {
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
                }
                else if (arg.kind === "literal" && typeof arg.value === "string") {
                    this.exportedNames.push(arg.value);
                }
            }
            return "";
        }
        // let → let 선언 (변수명 = 값)
        if (op === "let") {
            // (let [$x val] body) 형태
            if (args.length >= 2 && args[0].kind === "sexpr") {
                // 바인딩 목록
                const bindings = args[0].args;
                const bindingStmts = [];
                for (let i = 0; i < bindings.length; i += 2) {
                    const varName = this.extractVarName(bindings[i]);
                    const value = this.genNode(bindings[i + 1]);
                    bindingStmts.push(`let ${varName} = ${value};`);
                }
                const bodyStmts = args
                    .slice(1)
                    .map((a) => this.genNode(a))
                    .join("\n");
                return `(() => { ${bindingStmts.join(" ")} return ${bodyStmts}; })()`;
            }
            // 단순 let
            const varName = this.extractVarName(args[0]);
            const value = args[1] ? this.genNode(args[1]) : "undefined";
            return `let ${varName} = ${value};`;
        }
        // 함수 호출 (일반)
        const fnExpr = this.genFuncCall(op, args);
        return fnExpr;
    }
    genFn(args) {
        // (fn [$x $y] body)
        // args[0] = params 리스트 (SExpr 또는 배열)
        // args[1] = body
        const params = this.extractParamList(args[0]);
        const body = args[1] ? this.genNode(args[1]) : "undefined";
        return `((${params.join(", ")}) => ${body})`;
    }
    genDo(args) {
        // (do e1 e2 ... eN) → (() => { e1; e2; return eN; })()
        if (args.length === 0)
            return "(() => undefined)()";
        if (args.length === 1)
            return `(() => ${this.genNode(args[0])})()`;
        const stmts = args.slice(0, -1).map((a) => {
            const code = this.genNode(a);
            return code.endsWith(";") ? code : `${code};`;
        });
        const last = this.genNode(args[args.length - 1]);
        return `(() => { ${stmts.join(" ")} return ${last}; })()`;
    }
    genFuncCall(op, args) {
        const argStrs = args.map((a) => this.genNode(a));
        // $ 없는 함수명은 그대로, $로 시작하면 변수
        return `${op}(${argStrs.join(", ")})`;
    }
    genBlock(node) {
        switch (node.type) {
            case "FUNC":
                return this.genFuncBlock(node);
            case "MODULE":
                return this.genModuleBlock(node);
            default:
                return `/* unsupported block: ${node.type} */`;
        }
    }
    genFuncBlock(node) {
        // [FUNC name :params [$a $b] :body body]
        const params = this.extractBlockParams(node);
        const body = node.fields.get("body");
        const bodyCode = body ? this.genNode(body) : "undefined";
        return `function ${node.name}(${params.join(", ")}) { return ${bodyCode}; }`;
    }
    genModuleBlock(node) {
        const body = node.fields.get("body");
        if (!body)
            return "";
        if (Array.isArray(body)) {
            return body.map((n) => this.genNode(n)).join("\n");
        }
        return this.genNode(body);
    }
    extractVarName(node) {
        if (node.kind === "variable") {
            return node.name; // $x 그대로
        }
        if (node.kind === "literal" && typeof node.value === "string") {
            return `$${node.value}`;
        }
        return "$unknown";
    }
    extractParamList(node) {
        if (!node)
            return [];
        if (node.kind === "sexpr") {
            // (list $x $y ...) 형태
            return node.args.map((a) => {
                if (a.kind === "variable")
                    return a.name;
                if (a.kind === "literal")
                    return `$${a.value}`;
                return "$p";
            });
        }
        // 단일 파라미터
        if (node.kind === "variable")
            return [node.name];
        return [];
    }
    extractBlockParams(node) {
        const params = node.fields.get("params");
        if (!params)
            return [];
        if (Array.isArray(params)) {
            return params.map((p) => {
                if (p.kind === "variable")
                    return p.name;
                if (p.kind === "literal")
                    return `$${p.value}`;
                return "$p";
            });
        }
        // 단일 노드
        const p = params;
        if (p.kind === "variable")
            return [p.name];
        return [];
    }
    minify(code) {
        return code
            .replace(/\/\/[^\n]*/g, "") // 주석 제거
            .replace(/\s+/g, " ") // 공백 정규화
            .trim();
    }
}
exports.JSCodegen = JSCodegen;
//# sourceMappingURL=codegen-js.js.map