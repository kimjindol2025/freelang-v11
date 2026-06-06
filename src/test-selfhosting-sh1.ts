import { Interpreter } from "./interpreter";
import { parse } from "./parser";
import { lex } from "./lexer";
import * as fs from "fs";

const src = fs.readFileSync("./src/freelang-interpreter.fl", "utf-8");

const tests: [string, any][] = [
  ["(+ 1 2)", 3],
  ["(* 3 4)", 12],
  ['(if true "yes" "no")', "yes"],
  ['(if false "yes" "no")', "no"],
  ["(let [[$x 10]] (+ $x 5))", 15],
  ["(let [[$x 3] [$y 4]] (* $x $y))", 12],
  ["(do (+ 1 1) (* 2 3))", 6],
  ["(let [[$x 10]] (let [[$y 5]] (- $x $y)))", 5],
  ["[FUNC sq :params [$n] :body ((* $n $n))] (sq 7)", 49],
];

let pass = 0, fail = 0;
for (const [code, expected] of tests) {
  try {
    const i = new Interpreter();
    i.run(src);
    const ast = parse(lex(code));
    (i as any).context.variables.set("__ast__", ast);
    const ctx = i.run("(interpret $__ast__)");
    const result = ctx.lastValue;
    if (result === expected) {
      console.log("PASS:", code, "->", result);
      pass++;
    } else {
      console.log("FAIL:", code, "-> expected:", expected, "got:", JSON.stringify(result));
      fail++;
    }
  } catch (e: any) {
    console.log("ERROR:", code, String(e.message ?? e).slice(0, 150));
    fail++;
  }
}
console.log("\n결과:", pass, "/", pass + fail, "PASS");
