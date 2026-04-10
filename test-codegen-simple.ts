import { Interpreter } from "./src/interpreter";
import { lex } from "./src/lexer";
import { parse } from "./src/parser";
import * as fs from "fs";
import * as vm from "vm";

const interp = new Interpreter();
for (const f of ["freelang-lexer.fl","freelang-parser.fl","freelang-codegen.fl"]) {
  interp.interpret(parse(lex(fs.readFileSync("src/"+f,"utf-8"))));
}

const simple = "(define x 42) (println x)";
const escaped = JSON.stringify(simple);
const result = interp.interpret(parse(lex(`(gen-js (parse (lex ${escaped})))`)));
console.log("result type:", typeof result);
console.log("JS:", String(result).slice(0, 300));
