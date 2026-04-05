"use strict";
// Debug: Pipe 연산자 문제 분석
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
console.log("🔍 Debugging Pipe Operator\n");
const code = `
[FUNC double :params [$x] :body (* $x 2)]
[FUNC add-one :params [$x] :body (+ $x 1)]
`;
const interp = new interpreter_1.Interpreter();
const tokens = (0, lexer_1.lex)(code);
const ast = (0, parser_1.parse)(tokens);
console.log("✅ 파싱 결과:");
ast.forEach((node, idx) => {
    console.log(`   AST[${idx}]: kind=${node.kind}, type=${node.type}, name=${node.name}`);
});
// 평가 (함수 등록)
console.log("\n✅ 함수 등록 시작:");
try {
    // Use interpret() instead of eval() to properly register FUNC blocks
    const ctx = interp.interpret(ast);
    console.log(`   ✓ Registered ${ast.length} AST nodes`);
}
catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
}
// 함수가 등록되었는지 확인
const ctx = interp.context;
console.log("✅ 함수 등록 상태:");
console.log(`   - Functions map size: ${ctx.functions.size}`);
ctx.functions.forEach((fn, name) => {
    console.log(`   - ${name}: params=[${fn.params}], body=${fn.body.type || fn.body}`);
});
// 직접 호출 테스트
console.log("\n✅ 직접 함수 호출 테스트:");
try {
    const result1 = interp.callUserFunction("add-one", [5]);
    console.log(`   add-one(5) = ${result1}`);
}
catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
}
try {
    const result2 = interp.callUserFunction("double", [6]);
    console.log(`   double(6) = ${result2}`);
}
catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
}
// Pipe 테스트
console.log("\n✅ Pipe 테스트:");
const pipeCode = "(pipe 5 add-one double)";
try {
    const pipeTokens = (0, lexer_1.lex)(pipeCode);
    const pipeAst = (0, parser_1.parse)(pipeTokens);
    console.log(`   Parsed AST: ${JSON.stringify(pipeAst[0], null, 2).substring(0, 200)}...`);
    const result = interp.eval(pipeAst[0]);
    console.log(`   Result: ${result}`);
}
catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
    console.log(`   Stack: ${e.stack?.split("\n").slice(0, 5).join("\n")}`);
}
//# sourceMappingURL=test-pipe-debug.js.map