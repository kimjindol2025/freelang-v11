const { lex } = require("./lexer");
const { parse } = require("./parser");

const code = "[FUNC test :body (fn [$x] (+ $x 1))]";
const tokens = lex(code);
console.log("Tokens:", tokens.slice(6,13).map(t => t.type + ":" + t.value).join(" "));

const blocks = parse(tokens);
const block = blocks[0];
const bodyField = block.fields.get("body");
console.log("\nBody field kind:", bodyField.kind);
console.log("Body op:", bodyField.op);
console.log("Body args length:", bodyField.args.length);
console.log("Body args[0] kind:", bodyField.args[0]?.kind);
console.log("Body args[0] type:", bodyField.args[0]?.type);
console.log("Body args[1]:", bodyField.args[1]);
