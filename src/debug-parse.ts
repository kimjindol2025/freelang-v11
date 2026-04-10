import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";
import * as fs from "fs";

function loadFile(interp: Interpreter, path: string) {
  const src = fs.readFileSync(path, "utf-8");
  const tokens = lex(src);
  const ast = parse(tokens);
  interp.interpret(ast);
}

const interp = new Interpreter();
try {
  loadFile(interp, "./src/freelang-lexer.fl");
  loadFile(interp, "./src/freelang-parser.fl");
  loadFile(interp, "./src/freelang-codegen.fl");
  console.log("All FL files loaded. Functions: lex:", interp.context.functions.has("lex"),
    "parse:", interp.context.functions.has("parse"),
    "gen-js:", interp.context.functions.has("gen-js"));

  // Test lex
  interp.interpret(parse(lex(`(lex "42")`)));
  const lexResult = interp.context.lastValue;
  console.log("lex('42'):", JSON.stringify(lexResult));

  // Test parse
  interp.interpret(parse(lex(`(parse (lex "42"))`)));
  const parseResult = interp.context.lastValue;
  console.log("parse(lex('42')):", JSON.stringify(parseResult));

  // Test gen-js on a FUNC block
  const flSrc = `[FUNC add :params [$a $b] :body ((+ $a $b))]`;
  interp.interpret(parse(lex(`(gen-js (parse (lex ${JSON.stringify(flSrc)})))`)));
  console.log("gen-js result:\n", interp.context.lastValue);
} catch (e: any) {
  console.error("Error:", e.message);
  if (e.stack) console.error("Stack:", e.stack.split("\n").slice(0,5).join("\n"));
}
