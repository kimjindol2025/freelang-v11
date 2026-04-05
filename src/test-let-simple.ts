import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";

const code = `
(let [x 5]
  (+ $x 10))
`;

const interp = new Interpreter();
const tokens = lex(code);
const ast = parse(tokens);

console.log("AST:", JSON.stringify(ast, null, 2).substring(0, 300));

try {
  interp.interpret(ast);
  // Get the result by evaluating the last node
  let result: any;
  for (const node of ast) {
    if ((node as any).kind !== "block") {
      result = (interp as any).eval(node);
    }
  }
  console.log("Result:", result);
} catch (e: any) {
  console.log("Error:", e.message);
  console.log("Stack:", e.stack?.split("\n").slice(0, 5).join("\n"));
}
