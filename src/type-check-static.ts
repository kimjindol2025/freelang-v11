// FreeLang v11 — 정적 타입 검사기
// AST 기반 컴파일 타임 타입 분석: arity check + type hint check
//
// 설계 원칙:
// - 사운드하되 완전하지 않음: 증명 가능한 오류만 리포트
// - 힌트 없는 함수/변수는 any → 오류 없음
// - 에러 = 확실한 위반 / 경고 = 가능성 있는 위반

import { lex } from "./lexer";
import { parse } from "./parser";

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export type FLType = "string" | "number" | "bool" | "array" | "map" | "nil" | "any" | "fn";

export interface ParamDef {
  name: string;        // $name
  type: FLType;        // ^string → "string", 없으면 "any"
}

export interface FnDef {
  name: string;
  params: ParamDef[];
  returnType: FLType;
  line: number;
  variadic: boolean;   // rest param (마지막 param이 $...rest 형태)
}

export interface TypeIssue {
  kind: "error" | "warning";
  code: "arity" | "type-mismatch" | "undefined-fn" | "return-type";
  line: number;
  message: string;
}

// ─────────────────────────────────────────
// 타입 추론 헬퍼
// ─────────────────────────────────────────

function hintToType(hint: string): FLType {
  const h = hint.replace(/^\^/, "").toLowerCase();
  if (h === "string" || h === "str") return "string";
  if (h === "number" || h === "num" || h === "int" || h === "float") return "number";
  if (h === "bool" || h === "boolean") return "bool";
  if (h === "array" || h === "list" || h === "vec") return "array";
  if (h === "map" || h === "object" || h === "obj") return "map";
  if (h === "nil" || h === "null") return "nil";
  if (h === "fn" || h === "function") return "fn";
  return "any";
}

function literalType(node: any): FLType | null {
  if (!node) return null;
  if (node.kind === "literal") {
    if (node.type === "string") return "string";
    if (node.type === "number") return "number";
    if (node.type === "boolean") return "bool";
    if (node.type === "nil") return "nil";
  }
  if (node.kind === "block") {
    if (node.type === "Array") return "array";
    if (node.type === "Map") return "map";
  }
  if (node.kind === "keyword") return "string"; // :keyword → string
  return null; // variable / sexpr → unknown
}

function typesCompatible(expected: FLType, actual: FLType): boolean {
  if (expected === "any" || actual === "any") return true;
  return expected === actual;
}

// ─────────────────────────────────────────
// stdlib 아리티 사전 (자주 쓰는 핵심만)
// ─────────────────────────────────────────

const STDLIB_ARITY: Map<string, { min: number; max: number }> = new Map([
  ["str",         { min: 0, max: Infinity }],
  ["println",     { min: 0, max: Infinity }],
  ["print",       { min: 0, max: Infinity }],
  ["get",         { min: 2, max: 3 }],
  ["assoc",       { min: 3, max: Infinity }],
  ["dissoc",      { min: 2, max: 2 }],
  ["keys",        { min: 1, max: 1 }],
  ["values",      { min: 1, max: 1 }],
  ["length",      { min: 1, max: 1 }],
  ["map",         { min: 2, max: 2 }],
  ["filter",      { min: 2, max: 2 }],
  ["reduce",      { min: 3, max: 3 }],
  ["append",      { min: 2, max: 2 }],
  ["slice",       { min: 2, max: 3 }],
  ["str-slice",   { min: 2, max: 3 }],
  ["str-substr",  { min: 3, max: 3 }],
  ["str-split",   { min: 2, max: 2 }],
  ["json-parse",  { min: 1, max: 1 }],
  ["json-stringify", { min: 1, max: 2 }],
  ["now-ms",      { min: 0, max: 0 }],
  ["now-iso",     { min: 0, max: 0 }],
  ["nil?",        { min: 1, max: 1 }],
  ["not",         { min: 1, max: 1 }],
  ["if",          { min: 2, max: 3 }],
  ["let",         { min: 2, max: Infinity }],
  ["do",          { min: 1, max: Infinity }],
  ["or",          { min: 2, max: Infinity }],
  ["and",         { min: 2, max: Infinity }],
  ["contains?",   { min: 2, max: 2 }],
  ["has-key?",    { min: 2, max: 2 }],
  ["http-get-bearer",  { min: 2, max: 2 }],
  ["http-post-bearer", { min: 3, max: 3 }],
  ["auth-sha256", { min: 1, max: 1 }],
  ["auth-hmac",   { min: 2, max: 2 }],
  ["server-get",  { min: 2, max: 2 }],
  ["server-post", { min: 2, max: 2 }],
  ["server-put",  { min: 2, max: 2 }],
  ["server-json", { min: 1, max: 2 }],
]);

// 특수 형식 — arity 체크 제외
const SPECIAL_FORMS = new Set([
  "define", "defn", "defun", "fn", "lambda",
  "if", "cond", "let", "let*", "when", "unless",
  "do", "begin", "and", "or", "not",
  "match", "try", "catch", "throw",
  "load", "fl-require",
  "server-get", "server-post", "server-put", "server-delete",
  "server-start", "server-json", "server-html", "server-text", "server-status",
  "db-create", "db-query", "db-exec", "db-insert",
]);

// ─────────────────────────────────────────
// 1단계: defn 수집
// ─────────────────────────────────────────

function collectDefns(ast: any): Map<string, FnDef> {
  const defs = new Map<string, FnDef>();

  function walkNode(node: any): void {
    if (!node || typeof node !== "object") return;
    if (node.kind !== "sexpr") {
      // body 배열 순회
      if (Array.isArray(node.body)) node.body.forEach(walkNode);
      return;
    }

    const op = node.op;
    if (op !== "defn" && op !== "defun") {
      node.args?.forEach(walkNode);
      return;
    }

    // defn 처리
    let idx = 0;
    const args = node.args || [];

    // ^return-type 힌트
    let returnType: FLType = "any";
    if (args[idx]?.kind === "literal" && String(args[idx]?.value ?? "").startsWith("^")) {
      const hint = String(args[idx].value);
      if (hint !== "^pure") returnType = hintToType(hint);
      idx++;
    }

    // 함수명
    const nameNode = args[idx++];
    let name: string = "";
    if (nameNode?.kind === "variable") name = nameNode.name;
    else if (nameNode?.kind === "literal" && nameNode?.type === "symbol") name = String(nameNode.value);
    if (!name) return;

    // 파라미터 목록
    const paramsNode = args[idx];
    const params: ParamDef[] = [];
    let variadic = false;

    if (paramsNode?.kind === "block" && paramsNode?.type === "Array") {
      const items: any[] = paramsNode.fields?.get?.("items") ?? [];
      let i = 0;
      while (i < items.length) {
        const item = items[i];
        // ^type 힌트 (Symbol "^type" 형태)
        if (item?.kind === "literal" && String(item?.value ?? "").startsWith("^")) {
          const paramType = hintToType(String(item.value));
          i++;
          const paramNode = items[i];
          if (paramNode?.kind === "variable") {
            params.push({ name: paramNode.name, type: paramType });
          }
        } else if (item?.kind === "variable") {
          const pname = item.name;
          if (pname.startsWith("...") || pname.startsWith("rest")) variadic = true;
          params.push({ name: pname, type: "any" });
        }
        i++;
      }
    }

    defs.set(name, { name, params, returnType, line: node.line ?? 0, variadic });

    // defn body도 순회
    args.slice(idx + 1).forEach(walkNode);
  }

  if (Array.isArray(ast)) ast.forEach(walkNode);
  return defs;
}

// ─────────────────────────────────────────
// 2단계: 호출 검사
// ─────────────────────────────────────────

function checkCalls(ast: any, defs: Map<string, FnDef>): TypeIssue[] {
  const issues: TypeIssue[] = [];

  function walkNode(node: any, insideDefn?: string): void {
    if (!node || typeof node !== "object") return;

    if (node.kind !== "sexpr") {
      if (Array.isArray(node.body)) node.body.forEach((n: any) => walkNode(n, insideDefn));
      return;
    }

    const op: string = String(node.op ?? "");
    const args: any[] = node.args ?? [];
    const line: number = node.line ?? 0;

    // 특수 형식 내부 순회만
    if (op === "defn" || op === "defun") {
      let idx = 0;
      if (args[idx]?.kind === "literal" && String(args[idx]?.value ?? "").startsWith("^")) idx++;
      const nameNode = args[idx++];
      let fnName = "";
      if (nameNode?.kind === "variable") fnName = nameNode.name;
      else if (nameNode?.kind === "literal") fnName = String(nameNode.value);
      // skip params, recurse into body
      args.slice(idx + 1).forEach((a: any) => walkNode(a, fnName));
      return;
    }

    if (SPECIAL_FORMS.has(op)) {
      args.forEach((a: any) => walkNode(a, insideDefn));
      return;
    }

    // 사용자 정의 함수 호출 체크
    const def = defs.get(op);
    if (def && !def.variadic) {
      const argCount = args.length;
      const paramCount = def.params.length;

      // Arity check
      if (argCount !== paramCount) {
        issues.push({
          kind: "error",
          code: "arity",
          line,
          message: `(${op}) — 인자 ${argCount}개 전달, ${paramCount}개 필요 (${def.params.map(p => "$" + p.name).join(" ")})`,
        });
      } else {
        // Type check — 타입 힌트 있는 파라미터만 검사
        for (let i = 0; i < def.params.length; i++) {
          const param = def.params[i];
          if (param.type === "any") continue;
          const actual = literalType(args[i]);
          if (actual === null) continue; // 변수/표현식은 unknown → skip
          if (!typesCompatible(param.type, actual)) {
            issues.push({
              kind: "warning",
              code: "type-mismatch",
              line,
              message: `(${op}) — $${param.name}: ^${param.type} 파라미터에 ${actual} 전달`,
            });
          }
        }
      }
    }

    // stdlib arity check
    const stdlib = STDLIB_ARITY.get(op);
    if (stdlib && !def) {
      const ac = args.length;
      if (ac < stdlib.min || ac > stdlib.max) {
        const range = stdlib.max === Infinity
          ? `${stdlib.min}개 이상`
          : stdlib.min === stdlib.max
            ? `${stdlib.min}개`
            : `${stdlib.min}~${stdlib.max}개`;
        issues.push({
          kind: "error",
          code: "arity",
          line,
          message: `(${op}) — 인자 ${ac}개 전달, ${range} 필요`,
        });
      }
    }

    // 재귀 순회
    args.forEach((a: any) => walkNode(a, insideDefn));
  }

  if (Array.isArray(ast)) ast.forEach((n: any) => walkNode(n));
  return issues;
}

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────

export interface TypeCheckResult {
  errors: TypeIssue[];
  warnings: TypeIssue[];
  fnCount: number;
  checkedCalls: number;
}

export function typeCheckSource(source: string): TypeCheckResult {
  try {
    const tokens = lex(source);
    const ast: any[] = parse(tokens) as any[];
    const defs = collectDefns(ast);
    const issues = checkCalls(ast, defs);

    return {
      errors: issues.filter(i => i.kind === "error"),
      warnings: issues.filter(i => i.kind === "warning"),
      fnCount: defs.size,
      checkedCalls: issues.length,
    };
  } catch {
    return { errors: [], warnings: [], fnCount: 0, checkedCalls: 0 };
  }
}

export function formatTypeIssues(issues: TypeIssue[], filePath: string): string {
  if (issues.length === 0) return "";
  const base = require("path").basename(filePath);
  const lines: string[] = [`\n\x1b[36m[type-check]\x1b[0m  ${base} — ${issues.length}건`];
  for (const issue of issues) {
    const icon = issue.kind === "error" ? "\x1b[31m✖\x1b[0m" : "\x1b[33m⚠\x1b[0m";
    const label = issue.kind === "error" ? "\x1b[31m" : "\x1b[33m";
    lines.push(`  ${icon}  line ${issue.line}: ${label}${issue.code}\x1b[0m — ${issue.message}`);
  }
  return lines.join("\n");
}
