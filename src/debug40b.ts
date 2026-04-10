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

function makeModule(js: string) {
  const sb: any = { module: { exports: {} }, console };
  vm.createContext(sb);
  vm.runInContext(js, sb);
  return sb.module.exports;
}

// Gen1 build
const gen1LexerJS = tsCompile(lexerSrc);
// Find "ssc2" in generated lexer JS
const idx = gen1LexerJS.indexOf("ssc2");
if (idx >= 0) {
  console.log(`Found "ssc2" at position ${idx} in Gen1 lexer JS`);
  console.log(gen1LexerJS.slice(Math.max(0, idx-100), idx+100));
} else {
  console.log("No ssc2 in tsCompile lexer");
  // check standalone
  const codegenMod1 = makeModule(tsCompile(codegenSrc));
  const lexerMod1 = makeModule(tsCompile(lexerSrc));
  const parserMod1 = makeModule(tsCompile(parserSrc));
  const lexer2JS = codegenMod1["gen-js"](parserMod1.parse(lexerMod1.lex(lexerSrc)));
  const idx2 = lexer2JS.indexOf("ssc2");
  if (idx2 >= 0) {
    console.log(`Found "ssc2" at position ${idx2} in Gen2 lexer JS`);
    console.log(lexer2JS.slice(Math.max(0, idx2-100), idx2+100));
  } else {
    console.log("No ssc2 in Gen2 lexer either");
  }
}
