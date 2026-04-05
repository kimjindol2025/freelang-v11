// Phase 5 Week 2 Day 1: Simple TypeClass Parsing Test
// 기본 파싱만 먼저 테스트

import { lex } from "./lexer";
import { parse } from "./parser";

console.log("🚀 Phase 5 Week 2 Day 1: Simple TypeClass Parsing\n");

// TEST 1: Minimal TYPECLASS
console.log("=".repeat(60));
console.log("TEST 1: Minimal TYPECLASS");
console.log("=".repeat(60));

try {
  const code1 = `
[TYPECLASS Monad]
`;

  console.log(`Code: [TYPECLASS Monad]`);
  const tokens = lex(code1);
  console.log(`Tokens: ${tokens.map((t: any) => `${t.type}(${t.value})`).join(" ")}`);

  const ast = parse(tokens);
  console.log(`AST: ${JSON.stringify(ast[0], null, 2)}`);
  console.log(`✅ Parsed successfully\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}`);
  if ((e as any).line !== undefined) {
    console.log(`   At line ${(e as any).line}, col ${(e as any).col}\n`);
  } else {
    console.log();
  }
}

// TEST 2: TYPECLASS with field
console.log("=".repeat(60));
console.log("TEST 2: TYPECLASS with :name field");
console.log("=".repeat(60));

try {
  const code2 = `
[TYPECLASS Monad :test value]
`;

  console.log(`Code: [TYPECLASS Monad :test value]`);
  const tokens = lex(code2);
  console.log(`Tokens: ${tokens.map((t: any) => `${t.type}(${t.value})`).join(" ")}`);

  const ast = parse(tokens);
  console.log(`AST Kind: ${(ast[0] as any).kind}`);
  console.log(`AST Name: ${(ast[0] as any).name}`);
  console.log(`AST Fields: ${(ast[0] as any).fields ? Array.from((ast[0] as any).fields.keys()) : "none"}`);
  console.log(`✅ Parsed successfully\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}`);
  if ((e as any).line !== undefined) {
    console.log(`   At line ${(e as any).line}, col ${(e as any).col}\n`);
  } else {
    console.log();
  }
}

// TEST 3: Check lexer handling of :keyword
console.log("=".repeat(60));
console.log("TEST 3: Lexer :keyword handling");
console.log("=".repeat(60));

try {
  const code3 = `:typeParams`;

  console.log(`Code: :typeParams`);
  const tokens = lex(code3);
  console.log(`Tokens: ${tokens.map((t: any) => `${t.type}(${t.value})`).join(" ")}`);

  // Check what token type is produced
  const token = tokens[0];
  console.log(`First token type: ${token.type}`);
  console.log(`First token value: ${token.value}\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 4: Check MODULE parsing (working reference)
console.log("=".repeat(60));
console.log("TEST 4: MODULE parsing (reference)");
console.log("=".repeat(60));

try {
  const code4 = `
[MODULE math
  :exports [add subtract]
  :body []
]
`;

  console.log(`Code: [MODULE math :exports [add subtract] :body []]`);
  const tokens = lex(code4);
  const ast = parse(tokens);

  console.log(`AST Kind: ${(ast[0] as any).kind}`);
  console.log(`AST Name: ${(ast[0] as any).name}`);
  console.log(`✅ MODULE parsing works as reference\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}
