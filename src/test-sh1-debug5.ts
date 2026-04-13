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

// fl-apply 전에 각 단계 테스트
try {
  // closure? 테스트
  const r1 = i.run("(closure? $__fn__)").lastValue;
  console.log("closure?:", r1);
  
  // env-child 테스트
  const r2 = i.run("(env-child $__env__)").lastValue;
  console.log("env-child:", JSON.stringify(r2).slice(0, 100));
  (i as any).context.variables.set("__child__", r2);
  
  // (get $fn :params) 테스트
  const r3 = i.run("(get $__fn__ :params)").lastValue;
  console.log("fn.params:", JSON.stringify(r3));
  (i as any).context.variables.set("__params__", r3);
  
  // env-bind-all 테스트
  const r4 = i.run("(env-bind-all $__child__ $__params__ $__vals__ 0)").lastValue;
  console.log("env-bind-all:", JSON.stringify(r4).slice(0, 100));
  (i as any).context.variables.set("__call-env__", r4);
  
  // (get $fn :body) 테스트
  const r5 = i.run("(get $__fn__ :body)").lastValue;
  console.log("fn.body:", JSON.stringify(r5).slice(0, 100));
  (i as any).context.variables.set("__body__", r5);
  
  // fl-eval-body 테스트
  const r6 = i.run("(fl-eval-body $__body__ $__call-env__)").lastValue;
  console.log("fl-eval-body:", r6);
  
} catch(e: any) {
  const msg = String(e.message ?? e);
  console.log("ERROR:", msg.slice(0, 200));
  if (e.stack) {
    const lines = e.stack.split('\n');
    console.log("Stack (20 lines):\n" + lines.slice(0, 20).join('\n'));
  }
}
