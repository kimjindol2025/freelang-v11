"use strict";
// Debug compose with let binding - detailed debugging
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
console.log("🔍 Debugging Compose with Let Binding (detailed)\n");
const code = `
[FUNC double :params [$x] :body (* $x 2)]
[FUNC add-one :params [$x] :body (+ $x 1)]
(let [f (compose double add-one)]
  (f 5))
`;
const interp = new interpreter_1.Interpreter();
const tokens = (0, lexer_1.lex)(code);
const ast = (0, parser_1.parse)(tokens);
// Interpret all nodes (register functions)
interp.interpret(ast);
console.log("✅ Functions registered");
// Get the let expression
let letExpr = null;
for (const node of ast) {
    if (node.kind === "sexpr" && node.op === "let") {
        letExpr = node;
        break;
    }
}
if (!letExpr) {
    console.log("❌ No let expression found");
    process.exit(1);
}
console.log("✅ Let expression found");
console.log(`   Bindings arg: ${JSON.stringify(letExpr.args[0], null, 2).substring(0, 100)}...`);
// Get the body
const body = letExpr.args[1];
console.log(`   Body: ${JSON.stringify(body).substring(0, 150)}...`);
// Try to evaluate manually
const bindings = letExpr.args[0];
const items = bindings.fields.get("items");
for (const item of items) {
    const bindingItems = item.fields.get("items");
    if (bindingItems && bindingItems.length >= 2) {
        const varName = bindingItems[0].value;
        const valueExpr = bindingItems[1];
        console.log(`\n📝 Binding variable: '${varName}'`);
        console.log(`   Value expression: ${JSON.stringify(valueExpr).substring(0, 100)}...`);
        // Evaluate the value
        const value = interp.eval(valueExpr);
        console.log(`   Evaluated value type: ${typeof value}`);
        console.log(`   Is function: ${typeof value === 'function'}`);
        console.log(`   Kind: ${value.kind}`);
        // Store in context
        interp.context.variables.set(varName, value);
        console.log(`   ✅ Stored in context.variables['${varName}']`);
        // Check that it's there
        console.log(`   Verify: ${interp.context.variables.has(varName)}`);
    }
}
// Now check variables
console.log(`\n📊 Variables in context:`);
const vars = interp.context.variables;
for (const [key, val] of vars) {
    console.log(`   '${key}' = ${typeof val === 'function' ? '[Function]' : val.kind || typeof val}`);
}
// Now try to evaluate the body
console.log(`\n⚙️ Evaluating body: ${JSON.stringify(body).substring(0, 100)}...`);
try {
    const result = interp.eval(body);
    console.log(`✅ Result: ${result}`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}`);
}
//# sourceMappingURL=test-compose-debug2.js.map