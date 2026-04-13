import { Interpreter } from "./interpreter";
import { parse } from "./parser";
import { lex } from "./lexer";
import * as fs from "fs";

const src = fs.readFileSync("./src/freelang-interpreter.fl", "utf-8");
const funcCode = "[FUNC sq :params [$n] :body ((* $n $n))] (sq 7)";
const ast = parse(lex(funcCode));

// 1) fl-apply 를 직접 테스트 (closure + vals)
const i = new Interpreter();
i.run(src);
(i as any).context.variables.set("__ast__", ast);

// sq 클로저 먼저 만들기
const ctx1 = i.run("(fl-load-funcs $__ast__ (env-new) 0)");
const env = ctx1.lastValue;
(i as any).context.variables.set("__env__", env);

// sq 클로저 꺼내기
const ctx2 = i.run("(fl-env-get $__env__ \"sq\")");
const sqClosure = ctx2.lastValue;
console.log("sq closure:", JSON.stringify(sqClosure));
(i as any).context.variables.set("__fn__", sqClosure);
(i as any).context.variables.set("__vals__", [7]);

// fl-apply 직접 호출
try {
  const ctx3 = i.run("(fl-apply $__fn__ $__vals__ $__env__)");
  console.log("fl-apply result:", ctx3.lastValue);
} catch(e: any) {
  const msg = String(e.message ?? e);
  console.log("fl-apply ERROR:", msg.slice(0, 300));
  // 스택 추적 출력
  if (e.stack) console.log("Stack:\n" + e.stack.split('\n').slice(0, 15).join('\n'));
}
