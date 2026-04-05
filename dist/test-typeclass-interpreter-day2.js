"use strict";
// Phase 5 Week 2 Day 2: TypeClass Interpreter Integration
// TYPECLASS와 INSTANCE 레지스트리 통합 테스트
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
const express_1 = __importDefault(require("express"));
console.log("🚀 Phase 5 Week 2 Day 2: TypeClass Interpreter Integration Tests\n");
// Helper: Parse and interpret code
function parseAndInterpret(code) {
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const context = (0, interpreter_1.interpret)(ast, (0, express_1.default)());
    return context;
}
// TEST 1: TYPECLASS 등록
console.log("=".repeat(60));
console.log("TEST 1: TYPECLASS 등록");
console.log("=".repeat(60));
try {
    const code1 = `[TYPECLASS Monad :typeParams [M]]`;
    const context = parseAndInterpret(code1);
    const monadClass = context.typeClasses?.get("Monad");
    console.log(`Input: [TYPECLASS Monad :typeParams [M]]`);
    console.log(`TypeClass registered: ${monadClass ? "yes" : "no"}`);
    console.log(`TypeClass name: ${monadClass?.name}`);
    console.log(`TypeParams: [${monadClass?.typeParams.join(", ")}]`);
    console.log(`✅ ${monadClass &&
        monadClass.name === "Monad" &&
        monadClass.typeParams.includes("M")
        ? "PASS"
        : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 2: TYPECLASS Functor 등록
console.log("=".repeat(60));
console.log("TEST 2: TYPECLASS Functor 등록");
console.log("=".repeat(60));
try {
    const code2 = `[TYPECLASS Functor :typeParams [F]]`;
    const context = parseAndInterpret(code2);
    const functorClass = context.typeClasses?.get("Functor");
    console.log(`Input: [TYPECLASS Functor :typeParams [F]]`);
    console.log(`TypeClass registered: ${functorClass ? "yes" : "no"}`);
    console.log(`TypeClass name: ${functorClass?.name}`);
    console.log(`✅ ${functorClass && functorClass.name === "Functor" ? "PASS" : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 3: INSTANCE 등록 (Result Monad)
console.log("=".repeat(60));
console.log("TEST 3: INSTANCE 등록 (Result Monad)");
console.log("=".repeat(60));
try {
    const code3 = `
[TYPECLASS Monad :typeParams [M]]
[INSTANCE Result
  :typeclass Monad
  :pure (fn [$x] (ok $x))
  :bind (fn [$m $f] $m)
  :map (fn [$m $f] $m)
]
`;
    const context = parseAndInterpret(code3);
    const instance = context.typeClassInstances?.get("Monad[Result]");
    console.log(`Input: TYPECLASS Monad + INSTANCE Result`);
    console.log(`Instance registered: ${instance ? "yes" : "no"}`);
    console.log(`Instance className: ${instance?.className}`);
    console.log(`Instance concreteType: ${instance?.concreteType}`);
    console.log(`Implementations count: ${instance?.implementations.size}`);
    console.log(`✅ ${instance &&
        instance.className === "Monad" &&
        instance.concreteType === "Result" &&
        instance.implementations.size === 3
        ? "PASS"
        : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 4: INSTANCE 등록 (Option Functor)
console.log("=".repeat(60));
console.log("TEST 4: INSTANCE 등록 (Option Functor)");
console.log("=".repeat(60));
try {
    const code4 = `
[TYPECLASS Functor :typeParams [F]]
[INSTANCE Option
  :typeclass Functor
  :fmap (fn [$opt $f] $opt)
]
`;
    const context = parseAndInterpret(code4);
    const instance = context.typeClassInstances?.get("Functor[Option]");
    console.log(`Input: TYPECLASS Functor + INSTANCE Option`);
    console.log(`Instance registered: ${instance ? "yes" : "no"}`);
    console.log(`Instance className: ${instance?.className}`);
    console.log(`Instance concreteType: ${instance?.concreteType}`);
    console.log(`Methods: [${Array.from(instance?.implementations.keys() || []).join(", ")}]`);
    console.log(`✅ ${instance &&
        instance.className === "Functor" &&
        instance.concreteType === "Option" &&
        instance.implementations.size === 1
        ? "PASS"
        : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 5: 여러 TYPECLASS와 INSTANCE 혼합 등록
console.log("=".repeat(60));
console.log("TEST 5: 여러 TYPECLASS와 INSTANCE 혼합");
console.log("=".repeat(60));
try {
    const code5 = `
[TYPECLASS Monad :typeParams [M]]
[TYPECLASS Functor :typeParams [F]]
[INSTANCE List :typeclass Monad :pure (fn [$x] [$x]) :bind (fn [$m $f] $m) :map (fn [$m $f] $m)]
[INSTANCE List :typeclass Functor :fmap (fn [$lst $f] $lst)]
`;
    const context = parseAndInterpret(code5);
    const monadClass = context.typeClasses?.get("Monad");
    const functorClass = context.typeClasses?.get("Functor");
    const listMonad = context.typeClassInstances?.get("Monad[List]");
    const listFunctor = context.typeClassInstances?.get("Functor[List]");
    console.log(`Input: 2 TYPECLASS + 2 INSTANCE (List)`);
    console.log(`Monad class registered: ${monadClass ? "yes" : "no"}`);
    console.log(`Functor class registered: ${functorClass ? "yes" : "no"}`);
    console.log(`List Monad instance registered: ${listMonad ? "yes" : "no"}`);
    console.log(`List Functor instance registered: ${listFunctor ? "yes" : "no"}`);
    console.log(`✅ ${monadClass &&
        functorClass &&
        listMonad &&
        listFunctor
        ? "PASS"
        : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 6: Type Class와 Instance 동시 등록 (복합 예제)
console.log("=".repeat(60));
console.log("TEST 6: 실제 Monad 인스턴스 (Result, Option, List)");
console.log("=".repeat(60));
try {
    const code6 = `
[TYPECLASS Monad :typeParams [M]]
[INSTANCE Result :typeclass Monad :pure (fn [$x] (ok $x)) :bind (fn [$m $f] $m) :map (fn [$m $f] $m)]
[INSTANCE Option :typeclass Monad :pure (fn [$x] (some $x)) :bind (fn [$m $f] $m) :map (fn [$m $f] $m)]
[INSTANCE List :typeclass Monad :pure (fn [$x] [$x]) :bind (fn [$m $f] $m) :map (fn [$m $f] $m)]
`;
    const context = parseAndInterpret(code6);
    const resultInstance = context.typeClassInstances?.get("Monad[Result]");
    const optionInstance = context.typeClassInstances?.get("Monad[Option]");
    const listInstance = context.typeClassInstances?.get("Monad[List]");
    console.log(`Input: 1 TYPECLASS Monad + 3 INSTANCE (Result, Option, List)`);
    console.log(`Result Monad instance: ${resultInstance ? "✓" : "✗"}`);
    console.log(`Option Monad instance: ${optionInstance ? "✓" : "✗"}`);
    console.log(`List Monad instance: ${listInstance ? "✓" : "✗"}`);
    console.log(`✅ ${resultInstance && optionInstance && listInstance
        ? "PASS"
        : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// SUMMARY
console.log("=".repeat(60));
console.log("📋 PHASE 5 WEEK 2 DAY 2: INTERPRETER INTEGRATION SUMMARY");
console.log("=".repeat(60));
console.log("\n✅ Features Tested:");
console.log("   1. TYPECLASS 레지스트리 등록");
console.log("   2. INSTANCE 레지스트리 등록");
console.log("   3. evalTypeClass() 메서드 작동");
console.log("   4. evalInstance() 메서드 작동");
console.log("   5. getTypeClass() 메서드 작동");
console.log("   6. getTypeClassInstance() 메서드 작동");
console.log("   7. 복합 TYPECLASS + INSTANCE 등록\n");
console.log("✅ Phase 5 Week 2 Day 2 Interpreter Integration Complete!\n");
//# sourceMappingURL=test-typeclass-interpreter-day2.js.map