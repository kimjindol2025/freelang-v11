import { Interpreter } from "./interpreter";
import { parse } from "./parser";
import { lex } from "./lexer";
import * as fs from "fs";

const src = fs.readFileSync("./src/freelang-interpreter.fl", "utf-8");
const funcCode = "[FUNC sq :params [$n] :body ((* $n $n))] (sq 7)";
const ast = parse(lex(funcCode));

const i = new Interpreter();
i.run(src);
(i as any).context.variables.set("__ast__", ast);
const env = i.run("(fl-load-funcs $__ast__ (env-new) 0)").lastValue;
(i as any).context.variables.set("__env__", env);
const sqClosure = i.run("(fl-env-get $__env__ \"sq\")").lastValue;
(i as any).context.variables.set("__fn__", sqClosure);
(i as any).context.variables.set("__vals__", [7]);

// fl-apply 직접 테스트
try {
  const r = i.run("(fl-apply $__fn__ $__vals__ $__env__)").lastValue;
  console.log("fl-apply result:", r);
} catch(e: any) {
  const msg = String(e.message ?? e);
  console.log("fl-apply ERROR:", msg.slice(0, 200));
  if (e.stack) {
    const lines = e.stack.split('\n');
    const cuCount = lines.filter((l: string) => l.includes('callUserFunction')).length;
    console.log("callUserFunction depth:", cuCount);
    // fl 함수 호출 패턴 추출
    const flLines = lines.filter((l: string) => l.includes('eval-call-function') || l.includes('callUserFunction') || l.includes('evalLet'));
    console.log("Key stack frames (first 15):", flLines.slice(0, 15).join('\n'));
  }
}
