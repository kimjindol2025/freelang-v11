import * as vm from "vm";
import * as fs from "fs";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

const lexerSrc = fs.readFileSync("src/freelang-lexer.fl", "utf-8");
const parserSrc = fs.readFileSync("src/freelang-parser.fl", "utf-8");
const codegenSrc = fs.readFileSync("src/freelang-codegen.fl", "utf-8");

function convertTStoFL(node: any): any {
  if (node === null || node === undefined) return node;
  if (typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(convertTStoFL);
  const kind = node.kind;
  if (kind === "block") {
    const fields: Record<string,any> = {};
    if (node.fields instanceof Map) for (const [k,v] of node.fields) fields[k] = convertTStoFL(v);
    if (node.type === "Array") return { kind: "array", items: fields.items || [] };
    if (node.type === "Map") return { kind: "map-literal", pairs: fields };
    return { kind: "block", type: node.type, name: node.name, fields, line: node.line ?? null };
  }
  if (kind === "sexpr") return { kind: "sexpr", op: node.op, args: (node.args||[]).map(convertTStoFL), line: node.line ?? null };
  const r: any = {};
  for (const [k,v] of Object.entries(node)) r[k] = Array.isArray(v) ? (v as any[]).map(convertTStoFL) : convertTStoFL(v);
  return r;
}

function tsCompile(src: string): string {
  const interp = new Interpreter();
  for (const s of [lexerSrc, parserSrc, codegenSrc]) interp.interpret(parse(lex(s)));
  const ast = convertTStoFL(parse(lex(src)));
  (interp.context as any).variables.set("$__fl_ast__", ast);
  interp.interpret(parse(lex("(gen-js $__fl_ast__)")));
  return interp.context.lastValue as string;
}

// Print all_literals_q from Gen1 codegen
const gen1CG = tsCompile(codegenSrc);
const idx = gen1CG.indexOf("all_literals_q");
if (idx >= 0) {
  console.log("=== all_literals_q in Gen1 codegen ===");
  console.log(gen1CG.slice(idx, idx + 300));
}
const idx2 = gen1CG.indexOf("fold_concat_r");
if (idx2 >= 0) {
  console.log("\n=== fold_concat_r in Gen1 codegen ===");
  console.log(gen1CG.slice(idx2, idx2 + 300));
}
const idx3 = gen1CG.indexOf("try_fold");
if (idx3 >= 0) {
  console.log("\n=== try_fold in Gen1 codegen ===");
  console.log(gen1CG.slice(idx3, idx3 + 300));
}
