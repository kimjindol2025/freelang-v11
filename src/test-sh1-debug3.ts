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
const ctx1 = i.run("(fl-load-funcs $__ast__ (env-new) 0)");
const env = ctx1.lastValue;
(i as any).context.variables.set("__env__", env);

const sqClosure = i.run("(fl-env-get $__env__ \"sq\")").lastValue;
(i as any).context.variables.set("__fn__", sqClosure);
(i as any).context.variables.set("__vals__", [7]);
(i as any).context.variables.set("__n7__", 7);

// 단계별 테스트
try {
  // 1. env-child 테스트
  const r1 = i.run("(env-child $__env__)").lastValue;
  console.log("env-child ok, vars:", r1?.vars?.length);
  (i as any).context.variables.set("__child__", r1);
  
  // 2. env-bind-all 테스트
  const params = sqClosure.params; // ["n"]
  (i as any).context.variables.set("__params__", params);
  const r2 = i.run("(env-bind-all $__child__ $__params__ $__vals__ 0)").lastValue;
  console.log("env-bind-all ok, vars:", r2?.vars);
  (i as any).context.variables.set("__call-env__", r2);
  
  // 3. fl-eval-body 테스트 (직접)
  const body = sqClosure.body;
  (i as any).context.variables.set("__body__", body);
  console.log("body:", JSON.stringify(body));
  
  const r3 = i.run("(fl-eval (get $__body__ 0) $__call-env__)").lastValue;
  console.log("fl-eval body result:", r3);
  
} catch(e: any) {
  const msg = String(e.message ?? e);
  console.log("ERROR:", msg.slice(0, 200));
  // 스택에서 callUserFunction 패턴 몇번 반복되는지 확인
  if (e.stack) {
    const lines = e.stack.split('\n');
    const count = lines.filter((l: string) => l.includes('callUserFunction')).length;
    console.log("callUserFunction depth:", count);
    console.log("First 20 stack lines:\n" + lines.slice(0, 20).join('\n'));
  }
}
