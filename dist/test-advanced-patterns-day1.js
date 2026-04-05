"use strict";
// Phase 5 Week 3 Day 1: Advanced Pattern Matching Tests
// Or-patterns, Guard 조합, 패턴 중첩 검증
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
const express_1 = __importDefault(require("express"));
console.log("🚀 Phase 5 Week 3 Day 1: Advanced Pattern Matching Tests\n");
// Helper: Parse and interpret code
function parseAndInterpret(code) {
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const context = (0, interpreter_1.interpret)(ast, (0, express_1.default)());
    return context;
}
// TEST 1: Or-Pattern with Literals
console.log("=".repeat(60));
console.log("TEST 1: Or-Pattern with Literals");
console.log("=".repeat(60));
try {
    const code1 = `
(define test1 (fn [$x]
  (match $x
    ((1|2|3) "small")
    ((_) "other"))))

(test1 2)
`;
    const context = parseAndInterpret(code1);
    const result = context.lastValue;
    console.log(`Input: (1|2|3) matches literals 1, 2, or 3`);
    console.log(`Test value: 2`);
    console.log(`Result: ${result}`);
    console.log(`✅ ${result === "small" ? "PASS" : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 2: Or-Pattern with Different Values
console.log("=".repeat(60));
console.log("TEST 2: Or-Pattern Boundaries");
console.log("=".repeat(60));
try {
    const code2 = `
(define test2 (fn [$x]
  (match $x
    ((1|2|3) "small")
    ((4|5) "medium")
    ((_) "large"))))

(test2 4)
`;
    const context = parseAndInterpret(code2);
    const result = context.lastValue;
    console.log(`Input: Multiple or-patterns for different ranges`);
    console.log(`Test value: 4`);
    console.log(`Result: ${result}`);
    console.log(`✅ ${result === "medium" ? "PASS" : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 3: Or-Pattern with Variables
console.log("=".repeat(60));
console.log("TEST 3: Or-Pattern with Variables");
console.log("=".repeat(60));
try {
    const code3 = `
(define test3 (fn [$x]
  (match $x
    ((1|2) "pair")
    (($v) (+ $v 10)))))

(test3 5)
`;
    const context = parseAndInterpret(code3);
    const result = context.lastValue;
    console.log(`Input: Or-pattern (1|2) vs variable pattern ($v)`);
    console.log(`Test value: 5`);
    console.log(`Result: ${result}`);
    console.log(`✅ ${result === 15 ? "PASS" : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 4: Guard with Or-Pattern
console.log("=".repeat(60));
console.log("TEST 4: Guard with Or-Pattern");
console.log("=".repeat(60));
try {
    const code4 = `
(define test4 (fn [$x]
  (match $x
    ((1|2|3) (if (> $x 1)) "between 2-3")
    ((1|2|3) "is 1")
    ((_) "other"))))

(test4 2)
`;
    const context = parseAndInterpret(code4);
    const result = context.lastValue;
    console.log(`Input: Or-pattern combined with guard condition`);
    console.log(`Test value: 2`);
    console.log(`Result: ${result}`);
    console.log(`✅ ${result === "between 2-3" ? "PASS" : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 5: Nested List Patterns with Or
console.log("=".repeat(60));
console.log("TEST 5: Nested List Patterns with Or");
console.log("=".repeat(60));
try {
    const code5 = `
(define test5 (fn [$data]
  (match $data
    (([$a $b]) (if (and (> $a 5) (< $b 10))) "valid pair")
    (([$a $b]) "any pair")
    ((_) "not a pair"))))

(test5 [7 5])
`;
    const context = parseAndInterpret(code5);
    const result = context.lastValue;
    console.log(`Input: List pattern with guard composition`);
    console.log(`Test value: [7 5]`);
    console.log(`Result: ${result}`);
    console.log(`✅ ${result === "valid pair" ? "PASS" : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 6: Guard with Complex Condition
console.log("=".repeat(60));
console.log("TEST 6: Guard with Complex Condition");
console.log("=".repeat(60));
try {
    const code6 = `
(define test6 (fn [$x]
  (match $x
    (($v) (if (and (> $v 10) (< $v 20))) "teens")
    (($v) (if (> $v 20)) "adult")
    ((_) "young"))))

(test6 15)
`;
    const context = parseAndInterpret(code6);
    const result = context.lastValue;
    console.log(`Input: Variable pattern with guard composition`);
    console.log(`Test value: 15`);
    console.log(`Result: ${result}`);
    console.log(`✅ ${result === "teens" ? "PASS" : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 7: Or-Pattern with Wildcard
console.log("=".repeat(60));
console.log("TEST 7: Or-Pattern with Wildcard");
console.log("=".repeat(60));
try {
    const code7 = `
(define test7 (fn [$x]
  (match $x
    ((1|2|_) "matches anything"))))

(test7 99)
`;
    const context = parseAndInterpret(code7);
    const result = context.lastValue;
    console.log(`Input: Or-pattern including wildcard`);
    console.log(`Test value: 99`);
    console.log(`Result: ${result}`);
    console.log(`✅ ${result === "matches anything" ? "PASS" : "FAIL"}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// SUMMARY
console.log("=".repeat(60));
console.log("📋 PHASE 5 WEEK 3 DAY 1: ADVANCED PATTERN MATCHING SUMMARY");
console.log("=".repeat(60));
console.log("\n✅ Pattern Matching Features Tested:");
console.log("   1. Or-Pattern with Literals - (1|2|3)");
console.log("   2. Or-Pattern Boundaries - Multiple ranges");
console.log("   3. Or-Pattern with Variables - Mixed patterns");
console.log("   4. Guard with Or-Pattern - Condition combination");
console.log("   5. Nested List Patterns - Complex guards");
console.log("   6. Complex Guard Conditions - Multi-condition");
console.log("   7. Or-Pattern with Wildcard - Fallback\n");
console.log("📝 Patterns Supported:");
console.log("   • Literal: (1 2 3)");
console.log("   • Variable: ($x $y $z)");
console.log("   • Or: (1|2|3), (a|b)");
console.log("   • List: [$a $b], [& $rest]");
console.log("   • Wildcard: (_)");
console.log("   • Guard: (pattern (if condition))\n");
console.log("🎯 Day 1 Complete: 7/7 Advanced Pattern Tests Ready\n");
//# sourceMappingURL=test-advanced-patterns-day1.js.map