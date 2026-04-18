// FreeLang v9: Phase 86 — Language Server Protocol 핵심 구현
// VS Code 등 편집기와 연동: 자동완성, 진단, 호버, 포맷

import { lex } from "./lexer";
import { parse } from "./parser";
import { FLFormatter } from "./formatter";
import { FLLinter, buildLintContext, createDefaultLinter } from "./linter";

// ──────────────────────────────────────────────
// LSP 기본 타입
// ──────────────────────────────────────────────

export interface LSPPosition {
  line: number;
  character: number;
}

export interface LSPRange {
  start: LSPPosition;
  end: LSPPosition;
}

export interface LSPDiagnostic {
  range: LSPRange;
  message: string;
  severity: 1 | 2 | 3 | 4; // 1=Error, 2=Warning, 3=Information, 4=Hint
}

export interface LSPCompletionItem {
  label: string;
  kind: number; // 3=Function, 6=Variable
  detail?: string;
  documentation?: string;
}

// ──────────────────────────────────────────────
// 내장 함수 목록 (자동완성용)
// ──────────────────────────────────────────────

const BUILTIN_FUNCTIONS: Array<{ name: string; detail: string; doc: string }> = [
  { name: "abs",            detail: "(abs n: number) -> number",          doc: "절댓값 반환" },
  { name: "and",            detail: "(and a b) -> bool",                  doc: "논리 AND" },
  { name: "append",         detail: "(append list item) -> list",          doc: "리스트에 아이템 추가" },
  { name: "array",          detail: "(array ...items) -> array",           doc: "배열 생성" },
  { name: "assoc",          detail: "(assoc map key val) -> map",          doc: "맵에 키-값 연결" },
  { name: "async",          detail: "(async fn) -> promise",               doc: "비동기 함수 래퍼" },
  { name: "await",          detail: "(await promise) -> value",            doc: "Promise 대기" },
  { name: "bool",           detail: "(bool val) -> bool",                  doc: "Boolean 변환" },
  { name: "catch",          detail: "(catch err handler)",                 doc: "예외 캐치" },
  { name: "ceil",           detail: "(ceil n: number) -> number",          doc: "올림" },
  { name: "channel",        detail: "(channel) -> channel",                doc: "채널 생성" },
  { name: "concat",         detail: "(concat a b) -> list",                doc: "두 리스트 연결" },
  { name: "cond",           detail: "(cond (pred expr) ...) -> value",     doc: "다중 조건 분기" },
  { name: "cons",           detail: "(cons head tail) -> list",            doc: "head를 tail 앞에 붙이기" },
  { name: "count",          detail: "(count coll) -> number",              doc: "컬렉션 원소 수" },
  { name: "date-format",    detail: "(date-format date fmt) -> string",    doc: "날짜 포맷" },
  { name: "define",         detail: "(define name value)",                 doc: "변수/함수 정의" },
  { name: "defmacro",       detail: "(defmacro name ...)",                 doc: "매크로 정의" },
  { name: "defprotocol",    detail: "(defprotocol name ...)",              doc: "프로토콜 정의" },
  { name: "defstruct",      detail: "(defstruct name fields)",             doc: "구조체 정의" },
  { name: "dissoc",         detail: "(dissoc map key) -> map",             doc: "맵에서 키 제거" },
  { name: "do",             detail: "(do expr ...) -> last",               doc: "순차 실행" },
  { name: "each",           detail: "(each f coll) -> nil",                doc: "각 원소에 함수 적용" },
  { name: "empty?",         detail: "(empty? coll) -> bool",               doc: "컬렉션이 비었는지 확인" },
  { name: "entries",        detail: "(entries map) -> list",               doc: "맵의 [key, val] 쌍 목록" },
  { name: "filter",         detail: "(filter pred coll) -> list",          doc: "조건에 맞는 원소 필터링" },
  { name: "filter-lazy",    detail: "(filter-lazy pred seq) -> lazy",      doc: "지연 평가 필터" },
  { name: "first",          detail: "(first coll) -> value",               doc: "첫 번째 원소 반환" },
  { name: "flat-map",       detail: "(flat-map f coll) -> list",           doc: "flatMap" },
  { name: "floor",          detail: "(floor n: number) -> number",         doc: "내림" },
  { name: "fn",             detail: "(fn [params] body) -> function",      doc: "익명 함수 생성" },
  { name: "get",            detail: "(get map key) -> value",              doc: "맵/배열에서 값 가져오기" },
  { name: "http-get",       detail: "(http-get url) -> response",          doc: "HTTP GET 요청" },
  { name: "http-post",      detail: "(http-post url body) -> response",    doc: "HTTP POST 요청" },
  { name: "if",             detail: "(if pred then else) -> value",        doc: "조건 분기" },
  { name: "impl",           detail: "(impl protocol type ...)",            doc: "프로토콜 구현" },
  { name: "iterate",        detail: "(iterate f init) -> lazy",            doc: "반복 지연 시퀀스" },
  { name: "json-parse",     detail: "(json-parse str) -> value",           doc: "JSON 파싱" },
  { name: "json-stringify",  detail: "(json-stringify val) -> string",     doc: "JSON 직렬화" },
  { name: "keys",           detail: "(keys map) -> list",                  doc: "맵의 키 목록" },
  { name: "length",         detail: "(length coll) -> number",             doc: "길이 반환" },
  { name: "let",            detail: "(let ([k v] ...) body) -> value",     doc: "지역 바인딩" },
  { name: "let*",           detail: "(let* ([k v] ...) body) -> value",    doc: "순차 지역 바인딩" },
  { name: "list",           detail: "(list ...items) -> list",             doc: "리스트 생성" },
  { name: "map",            detail: "(map f coll) -> list",                doc: "각 원소에 함수 적용 후 수집" },
  { name: "map-get",        detail: "(map-get map key) -> value",          doc: "맵 값 조회" },
  { name: "map-set",        detail: "(map-set map key val) -> map",        doc: "맵 값 설정" },
  { name: "match",          detail: "(match val (pat body) ...) -> value", doc: "패턴 매칭" },
  { name: "max",            detail: "(max a b) -> number",                 doc: "최댓값" },
  { name: "merge",          detail: "(merge map1 map2) -> map",            doc: "두 맵 병합" },
  { name: "min",            detail: "(min a b) -> number",                 doc: "최솟값" },
  { name: "nil?",           detail: "(nil? val) -> bool",                  doc: "nil 여부 확인" },
  { name: "not",            detail: "(not val) -> bool",                   doc: "논리 NOT" },
  { name: "now",            detail: "(now) -> timestamp",                  doc: "현재 시각" },
  { name: "null?",          detail: "(null? val) -> bool",                 doc: "null 여부 확인" },
  { name: "num",            detail: "(num val) -> number",                 doc: "숫자 변환" },
  { name: "or",             detail: "(or a b) -> bool",                    doc: "논리 OR" },
  { name: "parallel",       detail: "(parallel ...tasks) -> list",         doc: "병렬 실행" },
  { name: "pop",            detail: "(pop list) -> list",                  doc: "마지막 원소 제거" },
  { name: "pow",            detail: "(pow base exp) -> number",            doc: "거듭제곱" },
  { name: "print",          detail: "(print val) -> nil",                  doc: "값 출력 (개행 없음)" },
  { name: "println",        detail: "(println val) -> nil",                doc: "값 출력 (개행 포함)" },
  { name: "push",           detail: "(push list item) -> list",            doc: "리스트에 아이템 추가" },
  { name: "push!",          detail: "(push! list item) -> nil",            doc: "리스트에 아이템 가변 추가" },
  { name: "range",          detail: "(range start end) -> list",           doc: "정수 범위 리스트" },
  { name: "receive!",       detail: "(receive! ch) -> value",              doc: "채널에서 수신" },
  { name: "reduce",         detail: "(reduce f init coll) -> value",       doc: "리스트를 값으로 축약" },
  { name: "rest",           detail: "(rest coll) -> list",                 doc: "첫 원소를 제외한 나머지" },
  { name: "reverse",        detail: "(reverse coll) -> list",              doc: "역순 리스트" },
  { name: "round",          detail: "(round n: number) -> number",         doc: "반올림" },
  { name: "send!",          detail: "(send! ch val) -> nil",               doc: "채널로 전송" },
  { name: "set",            detail: "(set map key val) -> map",            doc: "맵/배열에 값 설정" },
  { name: "sleep",          detail: "(sleep ms: number) -> nil",           doc: "지정 시간(ms) 대기" },
  { name: "sort",           detail: "(sort cmp coll) -> list",             doc: "리스트 정렬" },
  { name: "sqrt",           detail: "(sqrt n: number) -> number",          doc: "제곱근" },
  { name: "str",            detail: "(str val) -> string",                 doc: "문자열 변환" },
  { name: "string-contains", detail: "(string-contains s sub) -> bool",   doc: "문자열 포함 여부" },
  { name: "string-join",    detail: "(string-join list sep) -> string",    doc: "리스트를 구분자로 합치기" },
  { name: "string-length",  detail: "(string-length s) -> number",         doc: "문자열 길이" },
  { name: "string-split",   detail: "(string-split s sep) -> list",        doc: "문자열 분리" },
  { name: "substring",      detail: "(substring s start end) -> string",   doc: "부분 문자열" },
  { name: "take",           detail: "(take n seq) -> list",                doc: "앞에서 n개 가져오기" },
  { name: "throw",          detail: "(throw err) -> never",                doc: "예외 발생" },
  { name: "try",            detail: "(try body (catch e handler)) -> value", doc: "예외 처리" },
  { name: "type-of",        detail: "(type-of val) -> string",             doc: "값의 타입 반환" },
  { name: "unless",         detail: "(unless pred body) -> value",         doc: "pred가 false일 때 실행" },
  { name: "update",         detail: "(update map key f) -> map",           doc: "맵 값을 함수로 갱신" },
  { name: "values",         detail: "(values map) -> list",                doc: "맵의 값 목록" },
  { name: "when",           detail: "(when pred body) -> value",           doc: "pred가 true일 때 실행" },
  { name: "zip",            detail: "(zip a b) -> list",                   doc: "두 리스트를 쌍으로 묶기" },
];

// ──────────────────────────────────────────────
// 유틸: 소스에서 커서 위치의 심볼 추출
// ──────────────────────────────────────────────

function getSymbolAtPosition(src: string, line: number, character: number): string | null {
  const lines = src.split("\n");
  if (line < 0 || line >= lines.length) return null;
  const lineText = lines[line];
  if (character < 0 || character > lineText.length) return null;

  // 심볼 문자 판별 (알파벳, 숫자, 특수문자 포함 FreeLang 심볼)
  const isSymbolChar = (ch: string) => /[a-zA-Z0-9_\-+*/<>=!?$]/.test(ch);

  let start = character;
  let end = character;

  while (start > 0 && isSymbolChar(lineText[start - 1])) start--;
  while (end < lineText.length && isSymbolChar(lineText[end])) end++;

  if (start === end) return null;
  return lineText.slice(start, end);
}

// ──────────────────────────────────────────────
// 유틸: AST에서 정의된 함수/변수 수집
// ──────────────────────────────────────────────

interface DefinedSymbol {
  name: string;
  kind: "function" | "variable";
  line?: number;
}

function collectDefinedSymbols(src: string): DefinedSymbol[] {
  const symbols: DefinedSymbol[] = [];

  let ast: any[];
  try {
    ast = parse(lex(src));
  } catch {
    return symbols;
  }

  const lines = src.split("\n");

  // FUNC 블록
  for (const node of ast) {
    if (node.kind === "block" && node.type === "FUNC") {
      const lineIdx = lines.findIndex(l => l.includes(node.name));
      symbols.push({
        name: node.name,
        kind: "function",
        line: lineIdx >= 0 ? lineIdx : undefined,
      });
    }
    // define 표현식
    if (node.kind === "sexpr" && node.op === "define" && node.args.length >= 1) {
      const nameNode = node.args[0];
      // variable 노드이거나 literal.symbol 노드인 경우 처리
      let symName: string | null = null;
      if (nameNode.kind === "variable") {
        symName = nameNode.name;
      } else if (nameNode.kind === "literal" && (nameNode as any).type === "symbol") {
        symName = String((nameNode as any).value);
      }
      if (symName) {
        const lineIdx = lines.findIndex(l => l.includes(symName!));
        symbols.push({
          name: symName,
          kind: "variable",
          line: lineIdx >= 0 ? lineIdx : undefined,
        });
      }
    }
  }

  return symbols;
}

// ──────────────────────────────────────────────
// FLLanguageServer
// ──────────────────────────────────────────────

export class FLLanguageServer {
  private linter: FLLinter;
  private formatter: FLFormatter;

  constructor() {
    this.linter = createDefaultLinter();
    this.formatter = new FLFormatter();
  }

  /**
   * 소스 코드에서 진단(에러/경고) 목록 반환
   * - 파싱 에러 → severity 1 (Error)
   * - linter 경고 → severity 2 (Warning) / 3 (Info)
   */
  getDiagnostics(src: string, filename?: string): LSPDiagnostic[] {
    const diagnostics: LSPDiagnostic[] = [];
    const srcLines = src.split("\n");

    // 1. 파싱 에러 확인
    let parseOk = true;
    try {
      const tokens = lex(src);
      parse(tokens);
    } catch (e: any) {
      parseOk = false;
      // 에러 메시지에서 줄 번호 추출 시도
      const msg = String((e as Error).message ?? e);
      const lineMatch = msg.match(/line[:\s]+(\d+)/i) || msg.match(/at line (\d+)/i);
      const lineNum = lineMatch ? parseInt(lineMatch[1], 10) - 1 : 0;
      const safeLineNum = Math.max(0, Math.min(lineNum, srcLines.length - 1));
      const lineLen = srcLines[safeLineNum]?.length ?? 0;

      diagnostics.push({
        range: {
          start: { line: safeLineNum, character: 0 },
          end: { line: safeLineNum, character: lineLen },
        },
        message: `Parse error: ${msg}`,
        severity: 1,
      });
    }

    // 2. 파싱 성공 시 linter 실행
    if (parseOk) {
      const lintDiags = this.linter.lint(src);
      for (const ld of lintDiags) {
        // severity 매핑
        let lspSeverity: 1 | 2 | 3 | 4;
        if (ld.severity === "error") {
          lspSeverity = 1;
        } else if (ld.severity === "warn") {
          lspSeverity = 2;
        } else {
          lspSeverity = 3;
        }

        const lineNum = ld.line !== undefined ? ld.line - 1 : 0;
        const safeLineNum = Math.max(0, Math.min(lineNum, srcLines.length - 1));
        const col = ld.col ?? 0;
        const lineLen = srcLines[safeLineNum]?.length ?? 0;

        diagnostics.push({
          range: {
            start: { line: safeLineNum, character: col },
            end: { line: safeLineNum, character: lineLen },
          },
          message: `[${ld.rule}] ${ld.message}`,
          severity: lspSeverity,
        });
      }
    }

    return diagnostics;
  }

  /**
   * 커서 위치에서 자동완성 항목 반환
   * - 내장 함수 목록
   * - 현재 파일에 정의된 함수/변수
   * - 알파벳 순 정렬
   */
  getCompletions(src: string, line: number, char: number): LSPCompletionItem[] {
    const items: LSPCompletionItem[] = [];
    const seen = new Set<string>();

    // 내장 함수 추가 (kind=3: Function)
    for (const builtin of BUILTIN_FUNCTIONS) {
      if (!seen.has(builtin.name)) {
        seen.add(builtin.name);
        items.push({
          label: builtin.name,
          kind: 3, // Function
          detail: builtin.detail,
          documentation: builtin.doc,
        });
      }
    }

    // 현재 파일의 정의된 심볼 추가
    const defined = collectDefinedSymbols(src);
    for (const sym of defined) {
      if (!seen.has(sym.name)) {
        seen.add(sym.name);
        items.push({
          label: sym.name,
          kind: sym.kind === "function" ? 3 : 6, // 3=Function, 6=Variable
          detail: sym.kind === "function"
            ? `(function) ${sym.name}`
            : `(variable) $${sym.name}`,
          documentation: sym.kind === "function"
            ? `사용자 정의 함수: ${sym.name}`
            : `사용자 정의 변수: ${sym.name}`,
        });
      }
    }

    // 알파벳 순 정렬
    items.sort((a, b) => a.label.localeCompare(b.label));

    return items;
  }

  /**
   * 커서 아래 심볼의 타입/문서 반환
   * - 내장 함수: 문서 반환
   * - 알 수 없는 위치: null 반환
   */
  getHover(src: string, line: number, char: number): string | null {
    const symbol = getSymbolAtPosition(src, line, char);
    if (!symbol) return null;

    // 내장 함수 확인
    const builtin = BUILTIN_FUNCTIONS.find(b => b.name === symbol);
    if (builtin) {
      return `**${builtin.name}**\n\n\`\`\`\n${builtin.detail}\n\`\`\`\n\n${builtin.doc}`;
    }

    // 사용자 정의 심볼 확인
    const defined = collectDefinedSymbols(src);
    const sym = defined.find(s => s.name === symbol);
    if (sym) {
      if (sym.kind === "function") {
        return `**${sym.name}** (사용자 정의 함수)`;
      } else {
        return `**$${sym.name}** (사용자 정의 변수)`;
      }
    }

    return null;
  }

  /**
   * 소스 코드를 포맷하여 반환
   * formatter.ts의 FLFormatter 활용
   */
  formatDocument(src: string): string {
    try {
      return this.formatter.format(src);
    } catch {
      // 포맷 실패 시 원본 반환
      return src;
    }
  }
}
