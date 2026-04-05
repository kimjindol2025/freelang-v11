// Debug compose with let binding - detailed debugging

import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";

console.log("🔍 Debugging Compose with Let Binding (detailed)\n");

const code = `
[FUNC double :params [$x] :body (* $x 2)]
[FUNC add-one :params [$x] :body (+ $x 1)]
(let [f (compose double add-one)]
  (f 5))
`;

const interp = new Interpreter();
const tokens = lex(code);
const ast = parse(tokens);

// Interpret all nodes (register functions)
interp.interpret(ast);
console.log("✅ Functions registered");

// Get the let expression
let letExpr: any = null;
for (const node of ast) {
  if ((node as any).kind === "sexpr" && (node as any).op === "let") {
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
const items = (bindings as any).fields.get("items");

for (const item of items) {
  const bindingItems = (item as any).fields.get("items");
  if (bindingItems && bindingItems.length >= 2) {
    const varName = bindingItems[0].value;
    const valueExpr = bindingItems[1];
    
    console.log(`\n📝 Binding variable: '${varName}'`);
    console.log(`   Value expression: ${JSON.stringify(valueExpr).substring(0, 100)}...`);
    
    // Evaluate the value
    const value = (interp as any).eval(valueExpr);
    console.log(`   Evaluated value type: ${typeof value}`);
    console.log(`   Is function: ${typeof value === 'function'}`);
    console.log(`   Kind: ${(value as any).kind}`);
    
    // Store in context
    (interp as any).context.variables.set(varName, value);
    console.log(`   ✅ Stored in context.variables['${varName}']`);
    
    // Check that it's there
    console.log(`   Verify: ${(interp as any).context.variables.has(varName)}`);
  }
}

// Now check variables
console.log(`\n📊 Variables in context:`)
const vars = (interp as any).context.variables;
for (const [key, val] of vars) {
  console.log(`   '${key}' = ${typeof val === 'function' ? '[Function]' : (val as any).kind || typeof val}`);
}

// Now try to evaluate the body
console.log(`\n⚙️ Evaluating body: ${JSON.stringify(body).substring(0, 100)}...`);
try {
  const result = (interp as any).eval(body);
  console.log(`✅ Result: ${result}`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}`);
}
