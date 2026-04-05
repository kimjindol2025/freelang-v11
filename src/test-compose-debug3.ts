// Debug compose - check actual binding structure

import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";

const code = `
[FUNC double :params [$x] :body (* $x 2)]
[FUNC add-one :params [$x] :body (+ $x 1)]
(let [f (compose double add-one)]
  (f 5))
`;

const interp = new Interpreter();
const tokens = lex(code);
const ast = parse(tokens);
interp.interpret(ast);

// Get let expression
let letExpr: any = null;
for (const node of ast) {
  if ((node as any).kind === "sexpr" && (node as any).op === "let") {
    letExpr = node;
    break;
  }
}

const bindings = letExpr.args[0];
console.log("bindings:", bindings);
console.log("bindings.kind:", bindings.kind);
console.log("bindings.type:", bindings.type);
console.log("bindings.fields type:", bindings.fields.constructor.name);
console.log("bindings.fields size:", bindings.fields.size);
console.log("bindings.fields keys:", Array.from(bindings.fields.keys()));

const items = bindings.fields.get("items");
console.log("\nitems:", items);
console.log("items type:", typeof items);
console.log("items length:", Array.isArray(items) ? items.length : "not an array");

if (Array.isArray(items) && items.length > 0) {
  const firstItem = items[0];
  console.log("\nfirstItem:", firstItem);
  console.log("firstItem.kind:", firstItem.kind);
  console.log("firstItem.type:", firstItem.type);
  console.log("firstItem.fields:", firstItem.fields);
  console.log("firstItem.fields.size:", firstItem.fields.size);
  
  const bindingItems = firstItem.fields.get("items");
  console.log("\nbindingItems:", bindingItems);
  console.log("bindingItems.length:", bindingItems.length);
  
  if (bindingItems.length >= 2) {
    console.log("\nbindingItems[0] (variable):", bindingItems[0]);
    console.log("bindingItems[1] (value expr):", bindingItems[1]);
  }
}
