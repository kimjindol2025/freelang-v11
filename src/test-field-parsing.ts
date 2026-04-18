// Phase 5 Week 2: Field Parsing Debug
// 필드 파싱이 제대로 되는지 확인

import { lex } from "./lexer";
import { parse } from "./parser";

console.log("🚀 Field Parsing Debug\n");

// TEST 1: MODULE with exports (working reference)
console.log("=".repeat(60));
console.log("TEST 1: MODULE with :exports (reference)");
console.log("=".repeat(60));

try {
  const code1 = `[MODULE math :exports [add] :body []]`;

  console.log(`Code: ${code1}`);
  const tokens = lex(code1);
  console.log(`Tokens: ${tokens.map((t: any) => `${t.type}`).join(" ")}`);

  const ast = parse(tokens);
  const module = ast[0] as any;

  console.log(`AST Kind: ${module.kind}`);
  console.log(`AST Name: ${module.name}`);
  console.log(`Has fields: ${module.fields ? "yes" : "no"}`);
  console.log(`Fields size: ${module.fields ? module.fields.size : 0}`);
  console.log(`Exports: ${module.exports ? module.exports.join(", ") : "none"}`);
  console.log(`✅ MODULE parsing OK\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 2: FUNC with params (working reference)
console.log("=".repeat(60));
console.log("TEST 2: FUNC with :params (reference)");
console.log("=".repeat(60));

try {
  const code2 = `[FUNC add :params [$x $y] :body (+ $x $y)]`;

  console.log(`Code: ${code2}`);
  const tokens = lex(code2);
  const ast = parse(tokens);
  const func = ast[0] as any;

  console.log(`AST Kind: ${func.kind}`);
  console.log(`AST Type: ${func.type}`);
  console.log(`Has fields: ${func.fields ? "yes" : "no"}`);
  console.log(`Fields size: ${func.fields ? func.fields.size : 0}`);
  console.log(`Fields keys: ${func.fields ? Array.from(func.fields.keys()).join(", ") : "none"}`);
  console.log(`✅ FUNC parsing OK\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 3: TYPECLASS with :typeParams
console.log("=".repeat(60));
console.log("TEST 3: TYPECLASS with :typeParams");
console.log("=".repeat(60));

try {
  const code3 = `[TYPECLASS Monad :typeParams [M]]`;

  console.log(`Code: ${code3}`);
  const tokens = lex(code3);
  console.log(`Tokens: ${tokens.map((t: any) => `${t.type}(${t.value})`).join(" ")}`);

  const ast = parse(tokens);
  const tc = ast[0] as any;

  console.log(`AST Kind: ${tc.kind}`);
  console.log(`AST Name: ${tc.name}`);
  console.log(`TypeParams: [${tc.typeParams.join(", ")}]`);
  console.log(`✅ TYPECLASS parsing OK\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 4: TYPECLASS with :methods
console.log("=".repeat(60));
console.log("TEST 4: TYPECLASS with :methods");
console.log("=".repeat(60));

try {
  const code4 = `
[TYPECLASS Monad
  :methods [
    [:pure (fn [$a] (M))]
  ]
]
`;

  console.log(`Code: [TYPECLASS Monad :methods [...]]`);
  const tokens = lex(code4);
  const ast = parse(tokens);
  const tc = ast[0] as any;

  console.log(`AST Kind: ${tc.kind}`);
  console.log(`AST Name: ${tc.name}`);
  console.log(`Methods size: ${tc.methods ? tc.methods.size : 0}`);
  console.log(`Methods keys: ${tc.methods ? Array.from(tc.methods.keys()).join(", ") : "none"}`);
  console.log(`✅ TYPECLASS methods OK\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 5: INSTANCE with methods
console.log("=".repeat(60));
console.log("TEST 5: INSTANCE with methods");
console.log("=".repeat(60));

try {
  const code5 = `
[INSTANCE Result
  :typeclass Monad
  :pure (fn [$x] (ok $x))
  :bind (fn [$m $f] $m)
]
`;

  console.log(`Code: [INSTANCE Result :typeclass Monad :pure ... :bind ...]`);
  const tokens = lex(code5);
  const ast = parse(tokens);
  const inst = ast[0] as any;

  console.log(`AST Kind: ${inst.kind}`);
  console.log(`ClassName: ${inst.className}`);
  console.log(`ConcreteType: ${inst.concreteType}`);
  console.log(`Methods size: ${inst.implementations ? inst.implementations.size : 0}`);
  console.log(`Methods keys: ${inst.implementations ? Array.from(inst.implementations.keys()).join(", ") : "none"}`);
  console.log(`✅ ${inst.className === "Monad" && inst.concreteType === "Result" ? "PASS" : "FAIL"}\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}
