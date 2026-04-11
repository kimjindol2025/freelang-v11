"use strict";
// FreeLang v9: Phase 54 — FL utility library (import 실전)
// fl-list-utils.fl + fl-str-utils.fl + fl-app-demo.fl 검증
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
        failed++;
    }
}
function makeInterp(filePath) {
    const src = fs.readFileSync(filePath, "utf-8");
    const interp = new interpreter_1.Interpreter();
    interp.currentFilePath = filePath;
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp;
}
function run(interp, src) {
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
const srcDir = __dirname;
// ── list-utils 직접 테스트 ─────────────────────────────────────────
console.log("[Phase 54] FL utility library 검증\n");
console.log("[fl-list-utils.fl 직접 테스트]");
{
    const listInterp = makeInterp(path.join(srcDir, "fl-list-utils.fl"));
    test("sum([1,2,3,4,5]) = 15", () => {
        const res = run(listInterp, "(sum [1.0 2.0 3.0 4.0 5.0])");
        if (res !== 15)
            throw new Error(`got ${res}`);
    });
    test("mean([1,2,3,4,5]) = 3", () => {
        const res = run(listInterp, "(mean [1.0 2.0 3.0 4.0 5.0])");
        if (Math.abs(res - 3.0) > 0.001)
            throw new Error(`got ${res}`);
    });
    test("lst-max([3,1,4,1,5,9]) = 9", () => {
        const res = run(listInterp, "(lst-max [3.0 1.0 4.0 1.0 5.0 9.0])");
        if (res !== 9)
            throw new Error(`got ${res}`);
    });
    test("lst-min([3,1,4,1,5,9]) = 1", () => {
        const res = run(listInterp, "(lst-min [3.0 1.0 4.0 1.0 5.0 9.0])");
        if (res !== 1)
            throw new Error(`got ${res}`);
    });
    test("take([1,2,3,4,5], 3) = [1,2,3]", () => {
        const res = run(listInterp, "(take [1.0 2.0 3.0 4.0 5.0] 3)");
        if (!Array.isArray(res) || res.length !== 3 || res[0] !== 1 || res[2] !== 3)
            throw new Error(`got ${JSON.stringify(res)}`);
    });
    test("drop([1,2,3,4,5], 2) = [3,4,5]", () => {
        const res = run(listInterp, "(drop [1.0 2.0 3.0 4.0 5.0] 2)");
        if (!Array.isArray(res) || res.length !== 3 || res[0] !== 3 || res[2] !== 5)
            throw new Error(`got ${JSON.stringify(res)}`);
    });
}
// ── str-utils 직접 테스트 ────────────────────────────────────────────
console.log("\n[fl-str-utils.fl 직접 테스트]");
{
    const strInterp = makeInterp(path.join(srcDir, "fl-str-utils.fl"));
    test('repeat-str("FL", 3) = "FLFLFL"', () => {
        const res = run(strInterp, '(repeat-str "FL" 3)');
        if (res !== "FLFLFL")
            throw new Error(`got "${res}"`);
    });
    test('pad-left("42", 5, "0") = "00042"', () => {
        const res = run(strInterp, '(pad-left "42" 5 "0")');
        if (res !== "00042")
            throw new Error(`got "${res}"`);
    });
    test('pad-left("hello", 3, "0") = "hello" (no truncation)', () => {
        const res = run(strInterp, '(pad-left "hello" 3 "0")');
        if (res !== "hello")
            throw new Error(`got "${res}"`);
    });
}
// ── fl-app-demo.fl import 통합 테스트 ────────────────────────────────
console.log("\n[fl-app-demo.fl import 통합 테스트]");
{
    const demoPath = path.join(srcDir, "fl-app-demo.fl");
    const demoSrc = fs.readFileSync(demoPath, "utf-8");
    const demoInterp = new interpreter_1.Interpreter();
    demoInterp.currentFilePath = demoPath;
    test("fl-app-demo.fl 실행 및 두 네임스페이스 모두 등록", () => {
        demoInterp.interpret((0, parser_1.parse)((0, lexer_1.lex)(demoSrc)));
        const fns = demoInterp.context.functions;
        if (!fns.has("list:sum"))
            throw new Error("list:sum 없음");
        if (!fns.has("stru:repeat-str"))
            throw new Error("stru:repeat-str 없음");
    });
}
// ── 결과 ──────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 54 FL utility library: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
process.exit(0);
//# sourceMappingURL=test-phase54-fl-utils.js.map