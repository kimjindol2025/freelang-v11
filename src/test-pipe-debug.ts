// Debug: Pipe 연산자 문제 분석

import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";

console.log("🔍 Debugging Pipe Operator\n");

const code = `
[FUNC double :params [$x] :body (* $x 2)]
[FUNC add-one :params [$x] :body (+ $x 1)]
`;

const interp = new Interpreter();
const tokens = lex(code);
const ast = parse(tokens);

console.log("✅ 파싱 결과:");
ast.forEach((node, idx) => {
  console.log(`   AST[${idx}]: kind=${(node as any).kind}, type=${(node as any).type}, name=${(node as any).name}`);
});

// 평가 (함수 등록)
console.log("\n✅ 함수 등록 시작:");
try {
  // Use interpret() instead of eval() to properly register FUNC blocks
  const ctx = interp.interpret(ast);
  console.log(`   ✓ Registered ${ast.length} AST nodes`);
} catch (e: any) {
  console.log(`   ❌ Error: ${e.message}`);
}

// 함수가 등록되었는지 확인
const ctx = (interp as any).context;
console.log("✅ 함수 등록 상태:");
console.log(`   - Functions map size: ${ctx.functions.size}`);
ctx.functions.forEach((fn: any, name: string) => {
  console.log(`   - ${name}: params=[${fn.params}], body=${fn.body.type || fn.body}`);
});

// 직접 호출 테스트
console.log("\n✅ 직접 함수 호출 테스트:");
try {
  const result1 = (interp as any).callUserFunction("add-one", [5]);
  console.log(`   add-one(5) = ${result1}`);
} catch (e: any) {
  console.log(`   ❌ Error: ${e.message}`);
}

try {
  const result2 = (interp as any).callUserFunction("double", [6]);
  console.log(`   double(6) = ${result2}`);
} catch (e: any) {
  console.log(`   ❌ Error: ${e.message}`);
}

// Pipe 테스트
console.log("\n✅ Pipe 테스트:");
const pipeCode = "(pipe 5 add-one double)";
try {
  const pipeTokens = lex(pipeCode);
  const pipeAst = parse(pipeTokens);
  console.log(`   Parsed AST: ${JSON.stringify(pipeAst[0], null, 2).substring(0, 200)}...`);

  const result = (interp as any).eval(pipeAst[0]);
  console.log(`   Result: ${result}`);
} catch (e: any) {
  console.log(`   ❌ Error: ${e.message}`);
  console.log(`   Stack: ${e.stack?.split("\n").slice(0, 5).join("\n")}`);
}
