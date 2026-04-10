import * as vm from "vm";
import * as fs from "fs";
import * as path from "path";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

const flSrcDir = path.join(__dirname, "..", "src");
const lexerSrc = fs.readFileSync(path.join(flSrcDir, "freelang-lexer.fl"), "utf-8");
const parserSrc = fs.readFileSync(path.join(flSrcDir, "freelang-parser.fl"), "utf-8");
const codegenSrc = fs.readFileSync(path.join(flSrcDir, "freelang-codegen.fl"), "utf-8");

function patternToOp(p: any): string {
  if (!p || p.kind === "wildcard-pattern") return "_";
  if (p.kind === "literal-pattern") {
    if (p.type === "string") return JSON.stringify(String(p.value));
    return String(p.value);
  }
  if (p.kind === "variable-pattern") return p.name;
  return "_";
}
function convertTStoFL(node: any): any {
  if (node === null || node === undefined) return node;
  if (typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(convertTStoFL);
  const kind = node.kind;
  if (kind === "block") {
    const rawFields = node.fields;
    const fields: any = {};
    if (rawFields instanceof Map) {
      for (const [k, v] of rawFields) fields[k] = convertTStoFL(v);
    } else {
      for (const [k, v] of Object.entries(rawFields || {})) fields[k] = convertTStoFL(v);
    }
    if (node.type === "Array") return { kind: "array", items: fields.items || [] };
    if (node.type === "Map") return { kind: "map-literal", pairs: fields };
    return { kind: "block", type: node.type, name: node.name, fields };
  }
  if (kind === "sexpr") return { kind: "sexpr", op: node.op, args: (node.args || []).map(convertTStoFL) };
  if (kind === "pattern-match") {
    const subject = convertTStoFL(node.value);
    const cl: any[] = (node.cases || []).map((c: any) => ({
      kind: "sexpr", op: patternToOp(c.pattern), args: [convertTStoFL(c.body)]
    }));
    if (node.defaultCase) cl.push({ kind: "sexpr", op: "_", args: [convertTStoFL(node.defaultCase)] });
    return { kind: "sexpr", op: "match", args: [subject, ...cl] };
  }
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = Array.isArray(v) ? (v as any[]).map(convertTStoFL) : convertTStoFL(v);
  }
  return result;
}

function tsCompile(flSrc: string): string {
  const interp = new Interpreter();
  for (const src of [lexerSrc, parserSrc, codegenSrc]) {
    interp.interpret(parse(lex(src)));
  }
  const flAst = convertTStoFL(parse(lex(flSrc)));
  (interp.context as any).variables.set("$__fl_ast__", flAst);
  interp.interpret(parse(lex("(gen-js $__fl_ast__)")));
  return interp.context.lastValue as string;
}

function makeModule(jsCode: string): any {
  const sandbox: any = { module: { exports: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox);
  return sandbox.module.exports;
}

const lexer1JS = tsCompile(lexerSrc);
const parser1JS = tsCompile(parserSrc);
const codegen1JS = tsCompile(codegenSrc);
const lexerMod1 = makeModule(lexer1JS);
const parserMod1 = makeModule(parser1JS);
const codegenMod1 = makeModule(codegen1JS);

const tokens = lexerMod1.lex(lexerSrc);
const ast = parserMod1.parse(tokens);
const lexer2JS: string = codegenMod1["gen-js"](ast);

// Binary search for syntax error position
let lo = 0, hi = lexer2JS.length;
while (lo < hi - 1) {
  const mid = Math.floor((lo + hi) / 2);
  try {
    new Function(lexer2JS.substring(0, mid) + "}}}");
    lo = mid;
  } catch(e: any) {
    if (e.message.includes("Invalid or unexpected token")) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
}
console.log(`Error around position ${lo}-${hi}`);
console.log(JSON.stringify(lexer2JS.substring(lo-50, hi+50)));
