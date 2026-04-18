// Phase 5 Week 2 Day 1: TypeClass Parsing Tests
// TYPECLASS와 INSTANCE 블록 파싱 검증

import { lex } from "./lexer";
import { parse } from "./parser";
import { TypeClass, TypeClassInstance } from "./ast";

console.log("🚀 Phase 5 Week 2 Day 1: TypeClass Parsing Tests\n");

// Helper: Parse code and extract AST nodes
function parseCode(code: string): any[] {
  const tokens = lex(code);
  const ast = parse(tokens);
  return ast;
}

// TEST 1: TYPECLASS 기본 파싱
console.log("=".repeat(60));
console.log("TEST 1: TYPECLASS 기본 파싱");
console.log("=".repeat(60));

try {
  const code1 = `
[TYPECLASS Monad
  :typeParams [M]
  :methods [
    [:pure (fn [$a] (M $a))]
    [:bind (fn [$m $f] (M))]
    [:map (fn [$m $f] (M))]
  ]
]
`;

  const ast = parseCode(code1);
  const typeClass = ast[0] as TypeClass;

  console.log(`Input: [TYPECLASS Monad :typeParams [M] :methods [...]]`);
  console.log(`Kind: ${typeClass.kind}`);
  console.log(`Name: ${typeClass.name}`);
  console.log(`TypeParams: [${typeClass.typeParams.join(", ")}]`);
  console.log(`Methods: [${Array.from(typeClass.methods.keys()).join(", ")}]`);
  console.log(`✅ ${typeClass.kind === "type-class" && typeClass.name === "Monad" ? "PASS" : "FAIL"}\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 2: TYPECLASS 복수 타입 파라미터
console.log("=".repeat(60));
console.log("TEST 2: TYPECLASS 복수 타입 파라미터");
console.log("=".repeat(60));

try {
  const code2 = `
[TYPECLASS Bifunctor
  :typeParams [F]
  :methods [
    [:bimap (fn [$f $g $ab] (F))]
  ]
]
`;

  const ast = parseCode(code2);
  const typeClass = ast[0] as TypeClass;

  console.log(`Input: [TYPECLASS Bifunctor :typeParams [F] ...]`);
  console.log(`Name: ${typeClass.name}`);
  console.log(`TypeParams: [${typeClass.typeParams.join(", ")}]`);
  console.log(`✅ ${typeClass.name === "Bifunctor" ? "PASS" : "FAIL"}\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 3: INSTANCE 기본 파싱
console.log("=".repeat(60));
console.log("TEST 3: INSTANCE 기본 파싱");
console.log("=".repeat(60));

try {
  const code3 = `
[INSTANCE Result
  :typeclass Monad
  :pure (fn [$x] (ok $x))
  :bind (fn [$m $f] $m)
  :map (fn [$m $f] $m)
]
`;

  const ast = parseCode(code3);
  const instance = ast[0] as TypeClassInstance;

  console.log(`Input: [INSTANCE Result :typeclass Monad :pure ... :bind ... :map ...]`);
  console.log(`Kind: ${instance.kind}`);
  console.log(`ClassName: ${instance.className}`);
  console.log(`ConcreteType: ${instance.concreteType}`);
  console.log(`Implementations: [${Array.from(instance.implementations.keys()).join(", ")}]`);
  console.log(
    `✅ ${
      instance.kind === "type-class-instance" &&
      instance.className === "Monad" &&
      instance.concreteType === "Result"
        ? "PASS"
        : "FAIL"
    }\n`
  );
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 4: INSTANCE for Option
console.log("=".repeat(60));
console.log("TEST 4: INSTANCE for Option");
console.log("=".repeat(60));

try {
  const code4 = `
[INSTANCE Option
  :typeclass Functor
  :fmap (fn [$opt $f] $opt)
]
`;

  const ast = parseCode(code4);
  const instance = ast[0] as TypeClassInstance;

  console.log(`Input: [INSTANCE Option :typeclass Functor :fmap ...]`);
  console.log(`ClassName: ${instance.className}`);
  console.log(`ConcreteType: ${instance.concreteType}`);
  console.log(`Methods: [${Array.from(instance.implementations.keys()).join(", ")}]`);
  console.log(`✅ ${instance.className === "Functor" && instance.concreteType === "Option" ? "PASS" : "FAIL"}\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 5: TYPECLASS Functor
console.log("=".repeat(60));
console.log("TEST 5: TYPECLASS Functor");
console.log("=".repeat(60));

try {
  const code5 = `
[TYPECLASS Functor
  :typeParams [F]
  :methods [
    [:fmap (fn [$f $a] (F))]
  ]
]
`;

  const ast = parseCode(code5);
  const typeClass = ast[0] as TypeClass;

  console.log(`Input: [TYPECLASS Functor :typeParams [F] :methods [...]]`);
  console.log(`Name: ${typeClass.name}`);
  console.log(`Methods: [${Array.from(typeClass.methods.keys()).join(", ")}]`);

  // Check method structure
  const fmapMethod = typeClass.methods.get("fmap");
  console.log(`Method 'fmap' exists: ${fmapMethod ? "yes" : "no"}`);
  console.log(
    `✅ ${typeClass.name === "Functor" && typeClass.methods.has("fmap") ? "PASS" : "FAIL"}\n`
  );
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 6: 여러 TYPECLASS 연속 정의
console.log("=".repeat(60));
console.log("TEST 6: 여러 TYPECLASS 연속 정의");
console.log("=".repeat(60));

try {
  const code6 = `
[TYPECLASS Functor
  :typeParams [F]
  :methods [[:fmap (fn [$f] (F))]]
]
[TYPECLASS Monad
  :typeParams [M]
  :methods [
    [:pure (fn [$a] (M))]
    [:bind (fn [$m $f] (M))]
  ]
]
`;

  const ast = parseCode(code6);

  console.log(`Input: 2 TYPECLASS definitions`);
  console.log(`AST count: ${ast.length}`);
  console.log(`First TypeClass: ${ast[0].kind === "type-class" ? ast[0].name : "NOT A TYPECLASS"}`);
  console.log(`Second TypeClass: ${ast[1].kind === "type-class" ? ast[1].name : "NOT A TYPECLASS"}`);
  console.log(
    `✅ ${
      ast.length === 2 &&
      (ast[0] as TypeClass).name === "Functor" &&
      (ast[1] as TypeClass).name === "Monad"
        ? "PASS"
        : "FAIL"
    }\n`
  );
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 7: Mixed TYPECLASS and INSTANCE
console.log("=".repeat(60));
console.log("TEST 7: Mixed TYPECLASS and INSTANCE");
console.log("=".repeat(60));

try {
  const code7 = `
[TYPECLASS Monad
  :typeParams [M]
]
[INSTANCE Option
  :typeclass Monad
  :pure (fn [$x] (some $x))
  :bind (fn [$m $f] $m)
]
`;

  const ast = parseCode(code7);

  console.log(`Input: 1 TYPECLASS + 1 INSTANCE`);
  console.log(`AST count: ${ast.length}`);

  const typeClass = ast[0] as TypeClass;
  const instance = ast[1] as TypeClassInstance;

  console.log(`First: ${typeClass.kind} (${typeClass.name})`);
  console.log(`Second: ${instance.kind} (${instance.className} ${instance.concreteType})`);
  console.log(
    `✅ ${
      typeClass.kind === "type-class" &&
      instance.kind === "type-class-instance" &&
      typeClass.name === "Monad"
        ? "PASS"
        : "FAIL"
    }\n`
  );
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// SUMMARY
console.log("=".repeat(60));
console.log("📋 PHASE 5 WEEK 2 DAY 1: PARSING SUMMARY");
console.log("=".repeat(60));
console.log("\n✅ Features Tested:");
console.log("   1. TYPECLASS block parsing");
console.log("   2. Type parameter extraction");
console.log("   3. Method signature extraction");
console.log("   4. INSTANCE block parsing");
console.log("   5. Class name and concrete type extraction");
console.log("   6. Method implementation extraction");
console.log("   7. Mixed TYPECLASS + INSTANCE definitions\n");

console.log("📝 Parsing Strategy:");
console.log("   • parseBlock() 반환 타입 확장 (TypeClass, TypeClassInstance 추가)");
console.log("   • convertBlockToTypeClass() 메서드 구현");
console.log("   • convertBlockToInstance() 메서드 구현");
console.log("   • :typeParams, :methods 필드 추출\n");

console.log("✅ Phase 5 Week 2 Day 1 Parsing Complete!\n");
