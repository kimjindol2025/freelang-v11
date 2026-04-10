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

const codegen1JS = tsCompile(codegenSrc);

// Look for replace definition in codegen1JS
const lines = codegen1JS.split('\n');
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('replace') && (l.includes('function') || l.includes('=>') || l.includes('split') || l.includes('const replace'))) {
    console.log(`Line ${i+1}: ${l}`);
  }
}

// Also check gen-literal function
const genLitIdx = codegen1JS.indexOf('gen_literal') || codegen1JS.indexOf('gen-literal');
if (genLitIdx >= 0) {
  console.log('\ngen-literal area:');
  console.log(codegen1JS.substring(genLitIdx, genLitIdx + 500));
}
