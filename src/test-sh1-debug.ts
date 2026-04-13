import { Interpreter } from "./interpreter";
import { parse } from "./parser";
import { lex } from "./lexer";
import * as fs from "fs";

const src = fs.readFileSync("./src/freelang-interpreter.fl", "utf-8");

// FUNC 블록이 어떻게 파싱되는지 확인
const funcCode = "[FUNC sq :params [$n] :body ((* $n $n))] (sq 7)";
const ast = parse(lex(funcCode));
console.log("AST length:", ast.length);
console.log("Node 0 kind:", (ast[0] as any).kind, "type:", (ast[0] as any).type, "name:", (ast[0] as any).name);

const n0 = ast[0] as any;
console.log("fields keys:", n0.fields instanceof Map ? [...n0.fields.keys()] : Object.keys(n0.fields ?? {}));
if (n0.fields instanceof Map) {
  const body = n0.fields.get("body");
  const params = n0.fields.get("params");
  console.log("params:", JSON.stringify(params));
  console.log("body kind:", body?.kind, "type:", body?.type);
  if (body?.kind === "block") {
    const items = body.fields instanceof Map ? body.fields.get("items") : body.fields?.items;
    console.log("body items:", JSON.stringify(items));
  } else {
    console.log("body:", JSON.stringify(body));
  }
}

// 이제 interpret 테스트
const i = new Interpreter();
i.run(src);
(i as any).context.variables.set("__ast__", ast);

try {
  // sq 클로저가 만들어지는지 테스트
  const ctx = i.run("(fl-load-funcs $__ast__ (env-new) 0)");
  const env = ctx.lastValue;
  console.log("\nenv type:", typeof env);
  console.log("env.vars length:", Array.isArray(env?.vars) ? env.vars.length : "N/A");
  if (Array.isArray(env?.vars)) {
    console.log("env.vars[0]:", JSON.stringify(env.vars[0]));
  }
} catch(e: any) {
  console.log("fl-load-funcs ERROR:", String(e.message ?? e).slice(0, 200));
}
