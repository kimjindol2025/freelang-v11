// eval-special-forms.ts — FreeLang v9 Special Form Evaluation
// Phase 57 리팩토링: interpreter.ts의 특수 폼을 분리
// fn, async, set!, define, func-ref, call, compose, pipe,
// let, set, if, cond, do/begin/progn, loop, recur, while, and, or, map
// Phase 63: defmacro, macroexpand 추가
// Phase 61: TCO 모드에서 꼬리 위치 함수 호출 → TailCall 토큰 반환
// Phase 66: defstruct — 타입이 있는 레코드 타입
// Phase 96: fl-try — Result 기반 에러 처리

import { Interpreter } from "./interpreter";
import { SExpr, ASTNode, Variable, Literal } from "./ast";
import { isBlock, isControlBlock } from "./ast";
import { tailCall, isTailCall } from "./tco";
import { StructRegistry } from "./struct-system"; // Phase 66
import { recordEvent, getEvents, newTraceId, EventSeverity } from "./runtime-events";
import { defineContract } from "./runtime-contracts";
import { pushBudget, popBudget, BudgetExceededError, checkBudget, hasBudget } from "./runtime-budget";
import { pushContext, popContext } from "./runtime-context";

// loop/recur 내부 max-ms 체크 헬퍼 (인라인으로 checkBudget 호출)
function checkBudgetInLoop(): void {
  if (hasBudget()) checkBudget(Date.now(), 0, 0);
}
import { ok, err, isOk, isErr, fromThrown, ErrorCategory } from "./result-type"; // Phase 96
import { ReturnSignal } from "./return-signal";
import { BytecodeCompiler } from "./compiler"; // Phase 3-E: VM defn 컴파일
import { registerVMFunction } from "./vm-eligible"; // Phase 3-E: VM 함수 등록
import { FLRuntimeError, ErrorCodes } from "./errors"; // Phase A: 통일 에러
import { propRegistry, PropDef } from "./stdlib-property"; // AI-Native Phase 4
import { ScopeVarMeta } from "./interpreter-scope"; // Phase Y-1: 변수 메타정보

const _vmCompiler = new BytecodeCompiler(); // Phase 3-E

// ── AI-Native Phase 1: 함수 메타 레지스트리 ────────────────────────
export interface FnMeta {
  doc?: string;      // v11.7.3: 함수 설명
  returns?: string;
  context?: string;
  effects?: string[];
  examples?: string;
  property?: any;    // raw AST node — evaluated lazily by defn handler
  line?: number;
  file?: string;
}
export const fnMetaRegistry = new Map<string, FnMeta>();

const META_KEYS = new Set(["doc", "returns", "context", "effects", "examples", "property"]);

function extractMapMeta(mapNode: any): FnMeta | null {
  if (mapNode?.kind !== "block" || mapNode?.type !== "Map") return null;
  const fields: Map<string, any> = mapNode.fields;
  if (!fields || !(fields instanceof Map)) return null;
  if (!META_KEYS.has([...fields.keys()].find(k => META_KEYS.has(k)) ?? "")) return null;
  const meta: FnMeta = {};
  const strVal = (n: any): string | undefined =>
    n?.kind === "literal" ? String(n.value) : undefined;
  if (fields.has("doc"))      meta.doc      = strVal(fields.get("doc"));
  if (fields.has("returns"))  meta.returns  = strVal(fields.get("returns"));
  if (fields.has("context"))  meta.context  = strVal(fields.get("context"));
  if (fields.has("examples")) meta.examples = strVal(fields.get("examples"));
  if (fields.has("effects")) {
    const eNode = fields.get("effects") as any;
    if (eNode?.kind === "block" && eNode?.type === "Array") {
      const items = eNode.fields?.get("items") as any[];
      if (Array.isArray(items)) meta.effects = items.map(it => strVal(it) ?? "?");
    }
  }
  if (fields.has("property")) meta.property = fields.get("property"); // raw node
  return meta;
}

// ── Phase Y-1: 타입 추론 헬퍼 ─────────────────────────────
function inferType(value: any): { kind: "type"; name: string } | undefined {
  if (typeof value === "number") return { kind: "type", name: "number" };
  if (typeof value === "string") return { kind: "type", name: "string" };
  if (typeof value === "boolean") return { kind: "type", name: "boolean" };
  if (value === null) return { kind: "type", name: "nil" };
  if (Array.isArray(value)) return { kind: "type", name: "list" };
  if (value && typeof value === "object") {
    if ((value as any)["_isVMFunc"] || (value as any).params) return { kind: "type", name: "function" };
    return { kind: "type", name: "map" };
  }
  return undefined;
}

// ── AI-Native Phase 2: Effects 정적 분석 ─────────────────────────
// 함수명 → 발생 effect 매핑 (well-known side effects)
export const EFFECT_CATALOG = new Map<string, string>([
  // HTTP 클라이언트
  ["http_get",            "http"], ["http-get",            "http"],
  ["http_post",           "http"], ["http-post",           "http"],
  ["http_put",            "http"], ["http-put",            "http"],
  ["http_delete",         "http"], ["http-delete",         "http"],
  ["http_patch",          "http"], ["http-patch",          "http"],
  ["http_get_bearer",     "http"], ["http_post_bearer",    "http"],
  ["http_post_json",      "http"], ["http_get_json",       "http"],
  // 파일 I/O
  ["file_read",  "file-read"],  ["file-read",  "file-read"],
  ["file_write", "file-write"], ["file-write", "file-write"],
  ["file_append","file-write"], ["file_delete","file-write"],
  ["file_exists","file-read"],  ["file_list",  "file-read"],
  // DB
  ["db_query",   "db-read"],  ["db-query",   "db-read"],
  ["db_execute", "db-write"], ["db-execute", "db-write"],
  ["db_insert",  "db-write"], ["db-insert",  "db-write"],
  ["db_update",  "db-write"], ["db-update",  "db-write"],
  ["db_delete",  "db-write"], ["db-delete",  "db-write"],
  // Shell
  ["shell_exec", "shell"], ["shell-exec", "shell"],
  ["shell_exec_result", "shell"], ["shell-exec-result", "shell"],
  ["shell_run",  "shell"],
  // I/O (stdout)
  ["println", "io"], ["print", "io"],
  ["log/info", "io"], ["log/warn", "io"], ["log/error", "io"],
  // 시간/랜덤 (non-determinism)
  ["now",        "time"], ["timestamp", "time"],
  ["random",     "random"], ["rand-int",  "random"],
  // HTTP 서버 시작
  ["server_start", "server"], ["server-start", "server"],
]);

function collectBodyEffects(node: any, found: Set<string>): void {
  if (!node) return;
  if (node.kind === "sexpr") {
    const op: string = node.op ?? "";
    const eff = EFFECT_CATALOG.get(op);
    if (eff) found.add(eff);
    if (Array.isArray(node.args)) node.args.forEach((a: any) => collectBodyEffects(a, found));
  } else if (node.kind === "block") {
    if (node.fields instanceof Map) node.fields.forEach((v: any) => collectBodyEffects(v, found));
  } else if (node.kind === "literal" || node.kind === "variable") {
    // leaf — no recursion needed
  }
}

function checkEffects(fnName: string, declaredEffects: string[], bodyNode: any, line?: number, isPure?: boolean): void {
  const found = new Set<string>();
  collectBodyEffects(bodyNode, found);

  const pure = isPure || declaredEffects.length === 0;
  const declaredSet = new Set(declaredEffects.map(e =>
    e.startsWith(":") ? e.slice(1) : e));

  const undeclared: string[] = [];
  for (const eff of found) {
    if (!declaredSet.has(eff)) undeclared.push(eff);
  }

  if (undeclared.length > 0) {
    const hint = undeclared.map(e => `:${e}`).join(" ");
    if (pure) {
      // Phase 3: ^pure/:effects [] 위반 → 컴파일 에러
      throw new FLRuntimeError(
        ErrorCodes.PURE_VIOLATION,
        `${fnName}: ^pure 함수에서 side effect 감지 — ${hint}`,
        { fn: fnName, expected: "no side effects", got: hint },
        undefined, line
      );
    }
    process.stderr.write(
      `\x1b[33m[effects]\x1b[0m  \x1b[1m${fnName}\x1b[0m` +
      `${line ? ` (line ${line})` : ""}` +
      `  선언 안 된 effect: \x1b[33m${hint}\x1b[0m` +
      `  → :effects 에 추가 필요\n`
    );
  }
}

// ── Phase A: 통일 에러 helper ────────────────────────────────────
function throwArgCount(fn: string, expected: string, got: number, line?: number): never {
  throw new FLRuntimeError(
    ErrorCodes.ARG_COUNT,
    `${fn}: expects ${expected} args, got ${got}`,
    { fn, expected, got: String(got) },
    undefined, line
  );
}

function throwInvalidForm(fn: string, msg: string, line?: number): never {
  throw new FLRuntimeError(
    ErrorCodes.INVALID_FORM,
    `${fn}: ${msg}`,
    { fn },
    undefined, line
  );
}

function throwFnNotFound(fnName: string, line?: number): never {
  throw new FLRuntimeError(
    ErrorCodes.FN_NOT_FOUND,
    `Function not found: ${fnName}`,
    { fn: fnName },
    undefined, line
  );
}

export function evalSpecialForm(interp: Interpreter, op: string, expr: SExpr): any {
  const ev = (node: any) => (interp as any).eval(node);
  const callUser = (name: string, a: any[]) => (interp as any).callUserFunction(name, a);
  const callFnVal = (fn: any, a: any[]) => (interp as any).callFunctionValue(fn, a);
  const callAsyncFnVal = (fn: any, a: any[]) => (interp as any).callAsyncFunctionValue(fn, a);
  const callFn = (fn: any, a: any[]) => (interp as any).callFunction(fn, a);
  const ctx = interp.context;

  // ── trace ─────────────────────────────────────────────────────────
  // (trace expr) → expr 평가 + [TRACE] expr/value/elapsed 출력 후 값 반환
  if (op === "trace") {
    if (expr.args.length === 0) return null;
    const traceId = newTraceId();
    const traceStart = Date.now();
    const traceVal = ev(expr.args[0]);
    const traceElapsed = Date.now() - traceStart;
    let traceExprText = "?";
    try { traceExprText = ctx.macroExpander.astToString(expr.args[0]); } catch {}
    const traceDisplay = (interp as any).toDisplayString
      ? (interp as any).toDisplayString(traceVal)
      : String(traceVal);
    process.stderr.write(
      `[TRACE]\n  expr:    ${traceExprText}\n  value:   ${traceDisplay}\n  elapsed: ${traceElapsed}ms\n`
    );
    recordEvent({
      type: "trace", traceId, timestamp: Date.now(),
      file: (interp as any).currentFilePath, line: expr.line,
      expr: traceExprText, value: traceVal, elapsedMs: traceElapsed
    });
    return traceVal;
  }

  // ── with-trace ────────────────────────────────────────────────────
  // (with-trace expr) 또는 (with-trace :severity :error expr)
  if (op === "with-trace") {
    if (expr.args.length === 0) return null;

    // 선택적 :severity 키워드 파싱
    // FreeLang에서 :foo → {kind:"literal", type:"string", value:"foo"} 또는 {kind:"keyword", name:"foo"}
    const _wtNodeStr = (n: any): string | null => {
      if (!n) return null;
      if (n.kind === "keyword") return String(n.name);
      if (n.kind === "literal" && (n.type === "string" || n.type === "symbol")) return String(n.value);
      return null;
    };
    let wtSeverity: EventSeverity | undefined;
    let wtArgIdx = 0;
    if (expr.args.length >= 3) {
      const keyStr = _wtNodeStr(expr.args[0]);
      if (keyStr === "severity") {
        const sevStr = _wtNodeStr(expr.args[1]) ?? "";
        if (["debug","info","warn","error","fatal"].includes(sevStr)) {
          wtSeverity = sevStr as EventSeverity;
          wtArgIdx = 2;
        }
      }
    }

    const wtBodyArg = expr.args[wtArgIdx];
    if (!wtBodyArg) return null;

    const wtTraceId = newTraceId();
    const prevLen = getEvents().length;
    const wtStart = Date.now();
    const wtVal = ev(wtBodyArg);
    const wtElapsed = Date.now() - wtStart;
    let wtExpr = "?";
    try { wtExpr = ctx.macroExpander.astToString(wtBodyArg); } catch {}
    const childCount = getEvents().length - prevLen;
    const wtDisplay = (interp as any).toDisplayString
      ? (interp as any).toDisplayString(wtVal) : String(wtVal);
    recordEvent({
      type: "trace", traceId: wtTraceId, timestamp: Date.now(),
      severity: wtSeverity,
      expr: `(with-trace ${wtExpr})`, value: wtVal, elapsedMs: wtElapsed
    });
    process.stderr.write(
      `[with-trace] ${wtExpr}\n  value:   ${wtDisplay}\n  elapsed: ${wtElapsed}ms  events: ${childCount}\n`
    );
    return wtVal;
  }

  // ── use ──────────────────────────────────────────────────────────
  // ── defcontract ───────────────────────────────────────────────────
  // (defcontract name {:event-type :runtime-error :threshold 3 ...})
  if (op === "defcontract") {
    if (expr.args.length < 2) throw new Error("defcontract requires name and config map");
    const nameArg = expr.args[0] as any;
    const contractName =
      nameArg.kind === "variable" ? String(nameArg.name).replace(/^\$/, "")
      : nameArg.kind === "literal" ? String(nameArg.value)
      : String(nameArg);

    const configVal: Record<string, any> = ev(expr.args[1]) ?? {};
    // FreeLang에서 :key → string "key", 맵 키도 string
    const cfgGet = (k: string): any => configVal[k] ?? configVal[":" + k] ?? null;
    const cfgStr = (k: string): string | undefined => {
      const v = cfgGet(k);
      return v != null ? String(v).replace(/^:/, "") : undefined;
    };
    const cfgNum = (k: string): number | undefined => {
      const v = cfgGet(k);
      return v != null ? Number(v) : undefined;
    };

    const eventType = cfgStr("event-type") ?? "any";
    const threshold = cfgNum("threshold") ?? 3;
    const windowMs  = cfgNum("window-ms")  ?? 5000;
    const action    = (cfgStr("action") ?? "warn") as "warn" | "error" | "collapse" | "throttle";
    const errorKind = cfgStr("error-kind");

    defineContract(contractName, {
      eventType: eventType as any,
      threshold, windowMs, action,
      ...(errorKind ? { errorKind } : {}),
    });
    return contractName;
  }

  // ── with-budget ─────────────────────────────────────────────────
  // (with-budget {:max-ms N :max-events N :max-recursion N} body)
  // with-trace 패턴 동일 — body는 AST 지연 평가
  if (op === "with-budget") {
    if (expr.args.length < 2) throw new Error("with-budget requires budget-map and body");
    const budgetMap: Record<string, any> = ev(expr.args[0]) ?? {};
    const bodyNode = expr.args[1];

    const cfgNum = (k: string): number | undefined => {
      const v = budgetMap[k] ?? budgetMap[":" + k];
      return v != null ? Number(v) : undefined;
    };

    const maxMs        = cfgNum("max-ms");
    const maxEvents    = cfgNum("max-events");
    const maxRecursion = cfgNum("max-recursion");

    const startMs        = Date.now();
    const startEvents    = getEvents().length;
    const startRecursion = (interp as any).callDepth ?? 0;
    const ctxId          = pushContext();

    pushBudget({ maxMs, maxEvents, maxRecursion, startMs, startEvents, startRecursion, contextId: ctxId });

    try {
      const result = ev(bodyNode);
      popBudget();
      popContext();
      return result;
    } catch (e) {
      popBudget();
      popContext();
      if (e instanceof BudgetExceededError) {
        const actual = e.kind === "max-ms"        ? Date.now() - startMs
                     : e.kind === "max-events"    ? getEvents().length - startEvents
                     : (interp as any).callDepth - startRecursion;
        recordEvent({
          type: "budget-exceeded",
          timestamp: Date.now(),
          message: `Budget exceeded: ${e.kind} (limit=${e.limit}, actual=${actual})`,
          label: e.kind,
          value: { "budget-kind": e.kind, "limit": e.limit, "actual": actual, "context-id": ctxId },
        });
        return { "type": "budget-exceeded", "budget-kind": e.kind, "limit": e.limit, "actual": actual, "context-id": ctxId };
      }
      throw e;
    }
  }

  // Phase D: (use NAME) — self/stdlib/NAME.fl 자동 로드 (간소 import)
  // 이미 import된 모듈은 cache로 skip (interp.importedFiles)
  if (op === "use") {
    if (expr.args.length < 1) throwArgCount("use", ">=1", expr.args.length, expr.line);
    const fs = require("fs");
    const path = require("path");
    let loadedAny = false;
    for (const arg of expr.args) {
      // arg는 literal symbol 또는 string. value로 통일
      let name: string | null = null;
      if ((arg as any).kind === "literal") name = String((arg as any).value);
      else if ((arg as any).kind === "variable") name = String((arg as any).name).replace(/^\$/, "");
      if (!name) throwInvalidForm("use", "module name must be symbol or string", expr.line);
      // Y5: 플러그인 탐색 경로 (우선순위)
      // 1. ./plugins/NAME.fl (로컬)
      // 2. ~/.fl/plugins/NAME.fl (글로벌)
      // 3. self/stdlib/NAME.fl (내장)
      // 4. NAME.fl (프로젝트)
      const homeDir = require("os").homedir();
      const candidates = [
        path.resolve(process.cwd(), "plugins", name + ".fl"),
        path.resolve(homeDir, ".fl", "plugins", name + ".fl"),
        path.resolve(process.cwd(), "self/stdlib", name + ".fl"),
        path.resolve(process.cwd(), name + ".fl"),
        path.resolve(process.cwd(), name),
      ];
      let absPath: string | null = null;
      for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) { absPath = c; break; }
      }
      if (!absPath) {
        throw new FLRuntimeError(
          ErrorCodes.RUNTIME,
          `(use ${name}): module not found. Tried: ${candidates.join(", ")}`,
          { fn: "use", varName: name },
          undefined, expr.line
        );
      }
      // 이미 로드된 파일이면 skip
      const importedSet: Set<string> = (interp as any).importedFiles ?? new Set();
      if (importedSet.has(absPath)) continue;
      importedSet.add(absPath);
      (interp as any).importedFiles = importedSet;
      // 파일 로드 + 평가
      const src = fs.readFileSync(absPath, "utf-8");
      const { lex } = require("./lexer");
      const { parse } = require("./parser");
      (interp as any).interpret(parse(lex(src, absPath)));
      loadedAny = true;
    }
    return loadedAny;
  }

  // ── fn ───────────────────────────────────────────────────────────
  if (op === "fn") {
    if (expr.args.length < 2) throwArgCount("fn", ">=2", expr.args.length, expr.line);
    const paramsNode = expr.args[0];
    const params: any[] = [];
    const paramDefaults: (any | undefined)[] = []; // parallel to params, undefined if no default
    if ((paramsNode as any).kind === "block" && (paramsNode as any).type === "Array") {
      const items = (paramsNode as any).fields.get("items");
      if (Array.isArray(items)) {
        const _pAnns: (string | null)[] = [];
        let _ii = 0;
        while (_ii < items.length) {
          const item = items[_ii] as any;
          // ^type 힌트 심볼은 스킵 (타입 힌트는 런타임에서 무시)
          if (item.kind === "literal" && item.type === "symbol"
              && String(item.value).startsWith("^")) { _ii++; continue; }
          // Map 구조분해: {:keys [name age]} 패턴 — AST 노드 그대로 저장
          if (item.kind === "block" && item.type === "Map") {
            params.push(item); paramDefaults.push(undefined); _pAnns.push(null);
            _ii++; continue;
          }
          // 기본값: [$var defaultExpr] → 중첩 Array 블록
          if (item.kind === "block" && item.type === "Array") {
            const inner = item.fields?.get("items") ?? [];
            if (inner.length >= 2) {
              const nameNode = inner[0] as any;
              const n = nameNode.kind === "variable" ? nameNode.name
                : nameNode.kind === "literal" ? String(nameNode.value) : "";
              params.push(n.startsWith("$") ? n.slice(1) : n);
              paramDefaults.push(inner[1]);
              _pAnns.push(null);
            }
            _ii++; continue;
          }
          // v11.1: variable ($x) 또는 bare symbol (x) 모두 허용
          let _pname: string | null = null;
          if (item.kind === "variable") {
            const n = (item as Variable).name;
            _pname = n.startsWith("$") ? n.slice(1) : n;
          } else if (item.kind === "literal" && item.type === "symbol") {
            const v = item.value as string;
            _pname = v.startsWith("$") ? v.slice(1) : v;
          }
          if (_pname !== null) {
            params.push(_pname); paramDefaults.push(undefined);
            // 타입 어노테이션: [name :type ...] — keyword 또는 string literal(:type → "type")
            const _nx = items[_ii + 1] as any;
            const _nxType = _nx?.kind === "keyword" ? _nx.name
              : (_nx?.kind === "literal" && _nx?.type === "string") ? String(_nx.value)
              : (_nx?.kind === "literal" && _nx?.type === "symbol") ? String(_nx.value)
              : null;
            if (_nxType && /^(int|float|number|string|bool|boolean|any|list|array|map|fn|function|nil)$/.test(_nxType)) {
              _pAnns.push(_nxType); _ii += 2; continue;
            }
            _pAnns.push(null);
          }
          _ii++;
        }
        if (_pAnns.some((a: string | null) => a !== null)) {
          (paramsNode as any).__pAnns = _pAnns;
        }
      }
    } else if ((paramsNode as any).kind === "sexpr") {
      throwInvalidForm(
        "fn",
        `파라미터 목록은 대괄호 [ ]를 사용하세요.\n  잘못된 예: (fn (x y) ...)\n  올바른 예: (fn [$x $y] ...)`,
        expr
      );
    } else {
      throwInvalidForm(
        "fn",
        `파라미터는 [변수1 변수2 ...] 형태여야 합니다.`,
        expr
      );
    }
    const body = expr.args.length === 2
      ? expr.args[1]
      : { kind: "sexpr" as const, op: "do", args: expr.args.slice(1) };
    const hasDefaults = paramDefaults.some((d) => d !== undefined);
    const _fnPAnns = (paramsNode as any).__pAnns as (string | null)[] | undefined;
    return {
      kind: "function-value",
      params,
      ...(hasDefaults && { paramDefaults }),
      ...(_fnPAnns && { paramAnnotations: _fnPAnns }),
      body,
      capturedEnv: ctx.variables.snapshot(),
      name: undefined,
    };
  }

  // ── defn (v11.1: Clojure 스타일 sugar) ───────────────────────────
  // (defn name [params...] body) → (define name (fn [params...] body))
  if (op === "defn" || op === "defun") {
    if (expr.args.length < 3) throwArgCount("defn", ">=3", expr.args.length, expr.line);
    // ^return-type 또는 ^pure 힌트가 첫 arg로 올 수 있음
    let argIdx = 0;
    let isPureHint = false;
    if (expr.args[argIdx]?.kind === "literal" && String((expr.args[argIdx] as any).value).startsWith("^")) {
      const hint = String((expr.args[argIdx] as any).value);
      if (hint === "^pure") isPureHint = true;
      argIdx++;
    }
    const nameNode = expr.args[argIdx++] as any;
    let name: string;
    if (nameNode.kind === "variable") name = nameNode.name;
    else if (nameNode.kind === "literal" && nameNode.type === "symbol") name = nameNode.value as string;
    else throwInvalidForm("defn", "first argument must be a symbol (function name)", expr.line);

    const paramsNode = expr.args[argIdx];
    let bodyArgs = expr.args.slice(argIdx + 1);

    // 타입 어노테이션: -> returnType 패턴 감지
    let _defnRetAnn: string | null = null;
    if (bodyArgs.length >= 2) {
      const _arrow = bodyArgs[0] as any;
      if (_arrow?.kind === "literal" && _arrow?.type === "symbol" && _arrow?.value === "->") {
        const _rt = bodyArgs[1] as any;
        const _rtn = _rt?.kind === "keyword" ? _rt.name
          : _rt?.kind === "literal" && (_rt?.type === "symbol" || _rt?.type === "string") ? String(_rt.value) : null;
        if (_rtn) { _defnRetAnn = _rtn; bodyArgs = bodyArgs.slice(2); }
      }
    }

    // AI-Native Phase 1+2: 첫 body 표현식이 메타 맵이면 분리 + effects 검사
    let registeredMeta: FnMeta | null = null;
    if (bodyArgs.length > 1) {
      const meta = extractMapMeta(bodyArgs[0]);
      if (meta) {
        meta.line = expr.line;
        fnMetaRegistry.set(name!, meta);
        registeredMeta = meta;
        bodyArgs = bodyArgs.slice(1);
      }
    }

    const body = bodyArgs.length === 1
      ? bodyArgs[0]
      : ({ kind: "sexpr" as const, op: "do", args: bodyArgs } as any);

    // AI-Native Phase 2+3: effects 검사 + ^pure 강제
    if (isPureHint) {
      // ^pure 힌트: :effects []와 동일 — effect 발견 시 에러
      checkEffects(name!, [], body, expr.line, true);
      // 메타에도 기록
      if (!registeredMeta) {
        registeredMeta = { line: expr.line, effects: [] };
        fnMetaRegistry.set(name!, registeredMeta);
      } else if (!registeredMeta.effects) {
        registeredMeta.effects = [];
      }
    } else if (registeredMeta?.effects !== undefined) {
      checkEffects(name!, registeredMeta.effects, body, expr.line);
    }

    // (fn [params] body) 를 synth → 현재 scope에서 eval하여 function-value 획득
    const fnExpr: any = { kind: "sexpr", op: "fn", args: [paramsNode, body] };
    const fnValue = (interp as any).evalSExpr(fnExpr);
    fnValue.name = name;
    if (_defnRetAnn) fnValue.returnAnnotation = _defnRetAnn;

    // Phase 3-E: VM 함수 컴파일 및 등록
    try {
      const funcChunk = _vmCompiler.compileFunctionBody(fnValue.params, fnValue.body, name);
      const vmFuncObj = {
        _isVMFunc: true,
        _chunk: funcChunk,
        _params: fnValue.params,
        _closure: fnValue.capturedEnv ? [...fnValue.capturedEnv.entries()] : []
      };
      registerVMFunction(name, vmFuncObj);
    } catch {
      // 컴파일 실패 시 이름만 등록 (fallback)
      registerVMFunction(name);
    }

    // functions에도 등록 (callUserFunction 경로 지원)
    const funcDef: any = {
      name,
      params: fnValue.params,
      body: fnValue.body,
      capturedEnv: fnValue.capturedEnv,
    };
    if (fnValue.paramDefaults) funcDef.paramDefaults = fnValue.paramDefaults;
    if (fnValue.paramAnnotations) funcDef.paramAnnotations = fnValue.paramAnnotations;
    if (fnValue.returnAnnotation) funcDef.returnAnnotation = fnValue.returnAnnotation;
    ctx.functions.set(name, funcDef);

    // AI-Native Phase 4: :property 인라인 → defprop 자동 등록
    if (registeredMeta?.property) {
      try {
        const propNode = registeredMeta.property as any;
        // :property 맵에서 :args, :check, :samples 추출
        if (propNode?.kind === "block" && propNode?.type === "Map") {
          const pf: Map<string, any> = propNode.fields;
          const argsNode = pf.get("args") as any;
          let argTypes: string[] = [];
          if (argsNode?.kind === "block" && argsNode?.type === "Array") {
            const items = argsNode.fields?.get("items") as any[];
            if (Array.isArray(items)) argTypes = items.map((it: any) =>
              it?.kind === "literal" ? String(it.value).replace(/^:/, "") : "any");
          }
          const checkNode = pf.get("check") as any;
          const checkFn = checkNode ? ev(checkNode) : null;
          const samplesNode = pf.get("samples") as any;
          const samples = samplesNode?.kind === "literal" && typeof samplesNode.value === "number"
            ? samplesNode.value : 100;
          propRegistry.set(`prop-${name}`, {
            name: `prop-${name}`, fn: name!, args: argTypes,
            check: checkFn, samples, line: expr.line,
          });
        }
      } catch { /* property 등록 실패 시 무시 */ }
    }

    // name을 set → bare symbol/variable 둘 다로 접근 가능하게 저장
    ctx.variables.set("$" + name, fnValue);
    ctx.variables.set(name, fnValue);
    return fnValue;
  }

  // ── defprop (AI-Native Phase 4) ──────────────────────────────────
  // (defprop name {:fn "add" :args [:int :int] :check (fn [$a $b] ...) :samples 100})
  if (op === "defprop") {
    if (expr.args.length < 2) throwArgCount("defprop", ">=2", expr.args.length, expr.line);
    const nameNode = expr.args[0] as any;
    const propName: string = nameNode?.kind === "variable" ? nameNode.name
      : nameNode?.kind === "literal" ? String(nameNode.value) : "prop-" + Date.now();

    const specNode = expr.args[1] as any;
    if (specNode?.kind !== "block" || specNode?.type !== "Map") {
      throw new FLRuntimeError(ErrorCodes.INVALID_FORM,
        `defprop: 두 번째 인자는 맵이어야 합니다 {:fn :args :check}`, {}, undefined, expr.line);
    }
    const fields: Map<string, any> = specNode.fields;

    // :fn — 대상 함수명
    const fnNode = fields.get("fn") as any;
    const fnName: string = fnNode?.kind === "literal" ? String(fnNode.value) : "";

    // :args — 타입 배열 [:int :int]
    const argsNode = fields.get("args") as any;
    let argTypes: string[] = [];
    if (argsNode?.kind === "block" && argsNode?.type === "Array") {
      const items = argsNode.fields?.get("items") as any[];
      if (Array.isArray(items)) {
        argTypes = items.map((it: any) =>
          it?.kind === "literal" ? String(it.value).replace(/^:/, "") : "any");
      }
    }

    // :check — FL 함수 (evaluate now)
    const checkNode = fields.get("check") as any;
    const checkFn = checkNode ? ev(checkNode) : null;

    // :samples — 횟수 (기본 100)
    const samplesNode = fields.get("samples") as any;
    const samples = samplesNode?.kind === "literal" && typeof samplesNode.value === "number"
      ? samplesNode.value : 100;

    const prop: PropDef = {
      name: propName, fn: fnName, args: argTypes,
      check: checkFn, samples, line: expr.line,
    };
    propRegistry.set(propName, prop);
    return prop;
  }

  // ── async ─────────────────────────────────────────────────────────
  if (op === "async") {
    if (expr.args.length < 3) throwArgCount("async", ">=3", expr.args.length, expr.line);
    const nameNode = expr.args[0];
    const name = (nameNode as Variable).name || "async-fn";
    const paramsNode = expr.args[1];
    const params: string[] = [];
    if ((paramsNode as any).kind === "block" && (paramsNode as any).type === "Array") {
      const items = (paramsNode as any).fields.get("items");
      if (Array.isArray(items)) {
        for (const item of items) {
          if ((item as any).kind === "variable") params.push((item as Variable).name);
        }
      }
    } else if ((paramsNode as any).kind === "sexpr") {
      throwInvalidForm(
        "async",
        `파라미터 목록은 대괄호 [ ]를 사용하세요.\n  잘못된 예: (async myFn (x) ...)\n  올바른 예: (async myFn [$x] ...)`,
        expr
      );
    } else {
      throwInvalidForm(
        "async",
        `파라미터는 [변수1 변수2 ...] 형태여야 합니다.`,
        expr
      );
    }
    return {
      kind: "async-function-value",
      name,
      params,
      body: expr.args[2],
      capturedEnv: ctx.variables.snapshot(),
    };
  }

  // ── set! ──────────────────────────────────────────────────────────
  if (op === "set!") {
    if (expr.args.length < 2) throwArgCount("set!", ">=2", expr.args.length, expr.line);
    // #17/#18: v12에서 set! 완전 제거 (FL_V12=1 시 에러, 기본은 경고)
    const varHint = (expr.args[0] as any)?.name ?? (expr.args[0] as any)?.value ?? "x";
    if (process.env.FL_V12 === "1") {
      throw new FLRuntimeError(
        ErrorCodes.INVALID_FORM,
        `[v12] set!은 제거됐습니다 (line ${expr.line ?? "?"}). atom을 사용하세요:\n  (define ${varHint} (atom 초기값)) → (swap! ${varHint} (fn [v] 새값)) 또는 (reset! ${varHint} 새값)`,
        { fn: "set!" },
        undefined, expr.line
      );
    }
    console.warn(`⚠️  [FreeLang] set! is deprecated (line ${expr.line ?? "?"}). 전역 변수 수정은 클로저에 전파되지 않습니다. atom 권장: (define x (atom 0)) (swap! x + 1)`);
    const nameNode = expr.args[0];

    // (set! (get $obj "key") value) — map/array 프로퍼티 뮤테이션
    if ((nameNode as any).kind === "sexpr" && (nameNode as any).op === "get") {
      const getArgs = (nameNode as any).args;
      const obj = ev(getArgs[0]);
      const key = ev(getArgs[1]);
      const value = ev(expr.args[1]);
      if (obj !== null && typeof obj === "object") {
        const k = typeof key === "string" && key.startsWith(":") ? key.slice(1) : String(key);
        obj[k] = value;
      }
      return ev(expr.args[1]);
    }

    let name: string;
    if ((nameNode as any).kind === "variable") {
      name = "$" + (nameNode as any).name;
    } else if ((nameNode as any).kind === "literal") {
      name = "$" + (nameNode as any).value;
    } else {
      throwInvalidForm("set!", "first argument must be a symbol", expr.line);
    }
    const value = ev(expr.args[1]);
    if (!ctx.variables.mutate(name, value)) ctx.variables.set(name, value);
    return value;
  }

  // ── define ────────────────────────────────────────────────────────
  if (op === "define") {
    if (expr.args.length < 2) throwArgCount("define", ">=2", expr.args.length, expr.line);
    const nameNode = expr.args[0];
    let name: string;
    if ((nameNode as any).kind === "literal") {
      name = (nameNode as Literal).value as string;
    } else if ((nameNode as any).kind === "variable") {
      name = (nameNode as Variable).name;
    } else {
      throwInvalidForm("define", "first argument must be a symbol or string", expr.line);
    }

    // 3-arg form: (define name [params] body) → define function
    if (expr.args.length >= 3) {
      const paramsNode = expr.args[1];
      const bodyNode = expr.args.length === 3
        ? expr.args[2]
        : { kind: "sexpr" as const, op: "do", args: expr.args.slice(2) };
      const items = (paramsNode as any).kind === "block" && (paramsNode as any).type === "Array"
        ? (paramsNode as any).fields.get("items") || []
        : (paramsNode as any).kind === "array"
          ? (paramsNode as any).items || []
          : [];
      const params = (items as any[]).map((item: any) => {
        if (item.kind === "variable") return item.name.startsWith("$") ? item.name : "$" + item.name;
        if (item.kind === "literal") return "$" + item.value;
        return "$" + (item.name || item.value || "?");
      });
      ctx.functions.set(name, { name, params, body: bodyNode });
      return null;
    }

    const value = ev(expr.args[1]);
    if (value !== null && value !== undefined && (value as any).kind === "function-value") {
      const funcDef: any = {
        name,
        params: (value as any).params,
        body: (value as any).body,
        capturedEnv: (value as any).capturedEnv,
      };
      if ((value as any)._call) funcDef._call = (value as any)._call;
      ctx.functions.set(name, funcDef);
      if (ctx.typeChecker) {
        const paramTypes = (value as any).params.map(() => ({ kind: "type" as const, name: "any" }));
        ctx.typeChecker.registerFunction(name, paramTypes, { kind: "type" as const, name: "any" });
      }
      return value;
    } else {
      // Phase Y-1: 타입 추론 및 메타정보 저장
      const meta: Partial<ScopeVarMeta> = {
        file: (expr as any).file,
        line: expr.line || (nameNode as any).line,
        col: (nameNode as any).col,
        type: inferType(value),
      };

      // #16: 재정의 감지 — FL_V12=1 시 에러, 기본은 경고
      if (ctx.variables.has("$" + name)) {
        if (process.env.FL_V12 === "1") {
          throw new FLRuntimeError(
            ErrorCodes.INVALID_FORM,
            `[v12] '${name}'은(는) 이미 정의됐습니다 (line ${expr.line ?? "?"}). 가변 값은 atom을 사용하세요:\n  (define ${name} (atom 초기값)) → (swap! ${name} (fn [v] 새값))`,
            { fn: "define", varName: name },
            undefined, expr.line
          );
        }
        console.warn(`⚠️  [FreeLang] '${name}'은(는) 이미 정의됐습니다 (line ${expr.line ?? "?"}). 가변 값은 atom을 사용하세요: (define ${name} (atom ${JSON.stringify(value)})) → (swap! ${name} (fn [v] 새값))`);
      }
      ctx.variables.set("$" + name, value, meta);
      return value;
    }
  }

  // ── func-ref ──────────────────────────────────────────────────────
  if (op === "func-ref") {
    if (expr.args.length < 1) throwArgCount("func-ref", ">=1", expr.args.length, expr.line);
    const funcName = (expr.args[0] as any).name || String(expr.args[0]);
    const func = ctx.functions.get(funcName);
    if (!func) throwFnNotFound(funcName, expr.line);
    return {
      kind: "function-value",
      params: func.params,
      body: func.body,
      capturedEnv: ctx.variables.snapshot(),
      name: funcName,
    };
  }

  // ── call ──────────────────────────────────────────────────────────
  if (op === "call") {
    if (expr.args.length < 1) throwArgCount("call", ">=1", expr.args.length, expr.line);
    const fn = ev(expr.args[0]);
    const evaluatedArgs = expr.args.slice(1).map((a) => ev(a));
    if ((fn as any).kind === "builtin-function") return (fn as any).fn(evaluatedArgs);
    if ((fn as any).kind === "function-value") return callFnVal(fn, evaluatedArgs);
    if ((fn as any).kind === "async-function-value") return callAsyncFnVal(fn, evaluatedArgs);
    if (typeof fn === "string") return callUser(fn, evaluatedArgs);
    throw new Error(`call expects function-value, got ${(fn as any).kind || typeof fn}`);
  }

  // ── compose / comp ───────────────────────────────────────────────
  // (comp f g h) → (fn [x] (f (g (h x)))) — 오른쪽부터 적용
  // 유저 함수·function-value·빌트인 모두 지원
  if (op === "compose" || op === "comp") {
    if (expr.args.length < 1) throw new Error(`${op} requires at least 1 function`);

    // 각 인자를 핸들로 변환: 심볼은 name으로, 나머지는 즉시 평가
    const handles = expr.args.map((arg: any) => {
      const fk = arg.kind;
      if (fk === "variable") return { type: "name", name: arg.name };
      if (fk === "literal" && arg.type === "symbol") return { type: "name", name: String(arg.value) };
      return { type: "val", val: ev(arg) };
    });

    // _call: 호출 시점의 interp.context 사용
    const compFn = { kind: "function-value", name: `(${op})`, params: ["__x__"], body: null, env: null };
    (compFn as any)._call = (x: any) => {
      let result = x;
      for (let i = handles.length - 1; i >= 0; i--) {
        const handle = handles[i];
        if (handle.type === "val") {
          result = interp.callFunctionValue(handle.val, [result]);
        } else {
          // functions 맵에 있으면 callUserFunction (모듈 함수 포함)
          result = interp.callUserFunction(handle.name, [result]);
        }
      }
      return result;
    };
    return compFn;
  }

  // ── pipe ──────────────────────────────────────────────────────────
  if (op === "pipe") {
    if (expr.args.length < 2) throw new Error(`pipe requires at least a value and one function`);
    let pipeValue = ev(expr.args[0]);
    for (let i = 1; i < expr.args.length; i++) {
      const fnArg = expr.args[i];
      let pipeResult: any;
      if ((fnArg as any).kind === "literal" && (fnArg as any).type === "symbol") {
        const fnName = (fnArg as Literal).value as string;
        if (ctx.functions.has(fnName)) pipeResult = callUser(fnName, [pipeValue]);
        else throw new Error(`Unknown function: ${fnName}`);
      } else if ((fnArg as any).kind === "variable") {
        const fnName = (fnArg as Variable).name;
        if (ctx.functions.has(fnName)) pipeResult = callUser(fnName, [pipeValue]);
        else if (ctx.variables.has(fnName)) pipeResult = callFn(ctx.variables.get(fnName), [pipeValue]);
        else throw new Error(`Unknown function or variable: ${fnName}`);
      } else {
        const fn = ev(fnArg);
        pipeResult = callFn(fn, [pipeValue]);
      }
      pipeValue = pipeResult;
    }
    return pipeValue;
  }

  // ── -> (thread-first) ────────────────────────────────────────────
  // (-> val (f1 extra) f2 (f3 a b))
  // => (f3 (f2 (f1 val extra)) a b)
  // val이 각 form의 첫 번째 인자 위치에 삽입됨
  if (op === "->") {
    if (expr.args.length < 2) throw new Error(`-> requires at least a value and one step`);
    const TMP_VAR = "__thread_first_tmp__";
    let val = ev(expr.args[0]);
    for (let i = 1; i < expr.args.length; i++) {
      const form = expr.args[i];
      const fk = (form as any).kind;
      if (fk === "sexpr") {
        // (f extra-args...) → (f val extra-args...)
        const sform = form as SExpr;
        ctx.variables.set(TMP_VAR, val);
        const tmpVar: Variable = { kind: "variable", name: TMP_VAR };
        const newSexpr: SExpr = { kind: "sexpr", op: sform.op, args: [tmpVar, ...sform.args] };
        val = ev(newSexpr);
        ctx.variables.delete(TMP_VAR);
      } else if (fk === "variable") {
        const fnName = (form as Variable).name;
        if (ctx.functions.has(fnName)) val = callUser(fnName, [val]);
        else if (ctx.variables.has(fnName)) val = callFn(ctx.variables.get(fnName), [val]);
        else throw new Error(`->: unknown function or variable: ${fnName}`);
      } else if (fk === "literal" && (form as Literal).type === "symbol") {
        const fnName = (form as Literal).value as string;
        if (ctx.functions.has(fnName)) val = callUser(fnName, [val]);
        else throw new Error(`->: unknown function: ${fnName}`);
      } else {
        const fn = ev(form);
        val = callFn(fn, [val]);
      }
    }
    return val;
  }

  // ── ->> (thread-last) ────────────────────────────────────────────
  // (->> val (f1 extra) f2 (f3 a b))
  // => (f3 a b (f2 (f1 val extra)))
  // val이 각 form의 마지막 인자 위치에 삽입됨
  if (op === "->>") {
    if (expr.args.length < 2) throw new Error(`->> requires at least a value and one step`);
    const TMP_VAR = "__thread_last_tmp__";
    let val = ev(expr.args[0]);
    for (let i = 1; i < expr.args.length; i++) {
      const form = expr.args[i];
      const fk = (form as any).kind;
      if (fk === "sexpr") {
        // (f existing-args...) → (f existing-args... val)
        const sform = form as SExpr;
        ctx.variables.set(TMP_VAR, val);
        const tmpVar: Variable = { kind: "variable", name: TMP_VAR };
        const newSexpr: SExpr = { kind: "sexpr", op: sform.op, args: [...sform.args, tmpVar] };
        val = ev(newSexpr);
        ctx.variables.delete(TMP_VAR);
      } else if (fk === "variable") {
        const fnName = (form as Variable).name;
        if (ctx.functions.has(fnName)) val = callUser(fnName, [val]);
        else if (ctx.variables.has(fnName)) val = callFn(ctx.variables.get(fnName), [val]);
        else throw new Error(`->>: unknown function or variable: ${fnName}`);
      } else if (fk === "literal" && (form as Literal).type === "symbol") {
        const fnName = (form as Literal).value as string;
        if (ctx.functions.has(fnName)) val = callUser(fnName, [val]);
        else throw new Error(`->>: unknown function: ${fnName}`);
      } else {
        const fn = ev(form);
        val = callFn(fn, [val]);
      }
    }
    return val;
  }

  // ── ?. (nil-safe deep access) ────────────────────────────────────
  // (?. $obj :key1 :key2 ...) → nil이 나오면 즉시 nil 반환
  // get-in과 유사하지만 키 배열 대신 variadic 인자
  if (op === "?.") {
    if (expr.args.length < 1) return null;
    let val = ev(expr.args[0]);
    for (let i = 1; i < expr.args.length; i++) {
      if (val === null || val === undefined) return null;
      const keyArg = expr.args[i];
      let key: any;
      if ((keyArg as any).kind === "literal") {
        key = (keyArg as Literal).value;
      } else {
        key = ev(keyArg);
      }
      if (typeof key === "string" && key.startsWith(":")) key = key.slice(1);
      val = val instanceof Map
        ? (val.get(key) ?? val.get(":" + key) ?? null)
        : (val?.[String(key)] ?? null);
    }
    return val ?? null;
  }

  // ── as-> (thread with named binding) ────────────────────────────
  // (as-> val $name form1 form2 ...)
  // 각 form 안에서 $name 이 이전 결과를 가리킴 → 임의 위치에 삽입 가능
  if (op === "as->") {
    if (expr.args.length < 3) throw new Error(`as-> requires: (as-> val $name form ...)`);
    const bindArg = expr.args[1];
    let bindName: string;
    if ((bindArg as any).kind === "variable") {
      bindName = (bindArg as Variable).name;            // "$v" 형태
    } else if ((bindArg as any).kind === "literal") {
      bindName = "$" + String((bindArg as Literal).value); // "v" → "$v"
    } else {
      throw new Error(`as->: second arg must be a binding name like $v`);
    }
    let val = ev(expr.args[0]);
    ctx.variables.push();
    try {
      for (let i = 2; i < expr.args.length; i++) {
        ctx.variables.set(bindName, val);
        val = ev(expr.args[i]);
      }
    } finally {
      ctx.variables.pop();
    }
    return val;
  }

  // ── ?? (nil 병합) ────────────────────────────────────────────────
  // (?? expr default) → expr이 nil이면 default, 아니면 expr
  // (?? a b c) → 왼쪽부터 첫 번째 non-nil 값 반환
  if (op === "??") {
    if (expr.args.length < 2) throw new Error(`?? requires at least 2 arguments`);
    for (let i = 0; i < expr.args.length; i++) {
      const val = ev(expr.args[i]);
      if (val !== null && val !== undefined) return val;
    }
    return null;
  }

  // ── |> (thread-last pipe) ────────────────────────────────────────
  // (|> val (f arg...) ...) → pipeVal을 각 단계의 마지막 인자로 주입
  // (|> [1 2 3] (filter even?) (map inc)) → (map inc (filter even? [1 2 3]))
  if (op === "|>") {
    if (expr.args.length < 2) throw new Error(`|> requires at least a value and one function`);
    let pipeVal = ev(expr.args[0]);
    for (let i = 1; i < expr.args.length; i++) {
      const step = expr.args[i];
      const fk = (step as any).kind;
      if (fk === "sexpr") {
        // (f arg1 arg2 ...) → 임시 변수에 pipeVal 바인딩 후 마지막 인자로 주입
        const s = step as SExpr;
        const tmpVar = `__pipe_${i}__`;
        ctx.variables.set(tmpVar, pipeVal);
        const injectedArg: Variable = { kind: "variable", name: tmpVar };
        const newSExpr: SExpr = { kind: "sexpr", op: s.op, args: [...s.args, injectedArg], line: s.line };
        try {
          pipeVal = ev(newSExpr);
        } finally {
          ctx.variables.delete(tmpVar);
        }
      } else if (fk === "variable") {
        const fnName = (step as Variable).name;
        if (ctx.functions.has(fnName)) pipeVal = callUser(fnName, [pipeVal]);
        else if (ctx.variables.has(fnName)) pipeVal = callFn(ctx.variables.get(fnName), [pipeVal]);
      } else if (fk === "literal" && (step as Literal).type === "symbol") {
        const fnName = String((step as Literal).value);
        if (ctx.functions.has(fnName)) pipeVal = callUser(fnName, [pipeVal]);
        else if (ctx.variables.has(fnName)) pipeVal = callFn(ctx.variables.get(fnName), [pipeVal]);
      } else {
        const fn = ev(step);
        pipeVal = callFn(fn, [pipeVal]);
      }
    }
    return pipeVal;
  }

  // ── let ───────────────────────────────────────────────────────────
  if (op === "let") {
    return evalLet(interp, expr.args);
  }

  // ── if-let / when-let / when / unless (P3, 2026-04-25) ──────────────
  // (if-let [[x expr]] then else?) — expr 평가해서 truthy면 x 바인딩 + then, 아니면 else
  // (when-let [[x expr]] body...) — truthy면 x 바인딩 + body, 아니면 nil
  // (when cond body...) — cond truthy면 body 실행, 아니면 nil
  // (unless cond body...) — cond falsy면 body 실행
  if (op === "if-let" || op === "when-let") {
    if (expr.args.length < 2) throwArgCount(op, ">=2", expr.args.length, expr.line);
    const bindingsNode = expr.args[0] as any;
    const outerItems: any[] =
      bindingsNode.kind === "block" && bindingsNode.type === "Array"
        ? bindingsNode.fields?.get("items") ?? []
        : [];
    if (outerItems.length < 1) throwInvalidForm(op, "binding 형태가 [$x expr] 이어야 함", expr.line);

    // 평탄형: [$x expr] — outerItems[0]이 variable이면 flat
    // 이중 괄호형: [[x expr]] — outerItems[0]이 Array 블록
    let pairItems: any[];
    const firstItem = outerItems[0] as any;
    if (firstItem.kind === "variable" || firstItem.kind === "literal") {
      // flat form: [$x expr] → pairItems = outerItems
      pairItems = outerItems;
    } else {
      // double-bracket form: [[x expr]] → pairItems = firstItem.items
      pairItems = firstItem.kind === "block" && firstItem.type === "Array"
        ? firstItem.fields?.get("items") ?? []
        : [];
    }
    if (pairItems.length < 2) throwInvalidForm(op, "[$x expr] 형태가 잘못됨", expr.line);
    const varName = pairItems[0].kind === "variable" ? pairItems[0].name
      : pairItems[0].kind === "literal" ? String(pairItems[0].value) : "";
    const value = ev(pairItems[1]);
    const truthy = value !== null && value !== undefined && value !== false;
    if (truthy) {
      interp.context.variables.push();
      try {
        // Phase Y-1: 메타정보 저장
        const meta: Partial<ScopeVarMeta> = {
          line: (pairItems[0] as any).line,
          col: (pairItems[0] as any).col,
          type: inferType(value),
        };
        interp.context.variables.set(varName, value, meta);
        if (op === "if-let") {
          // (if-let [[x expr]] then else?)
          return ev(expr.args[1]);
        } else {
          // (when-let [[x expr]] body...) — body는 args[1..]
          let result: any = null;
          for (let i = 1; i < expr.args.length; i++) result = ev(expr.args[i]);
          return result;
        }
      } finally {
        interp.context.variables.pop();
      }
    } else {
      if (op === "if-let" && expr.args.length >= 3) return ev(expr.args[2]);
      return null;
    }
  }
  if (op === "when") {
    if (expr.args.length < 2) throwArgCount("when", ">=2", expr.args.length, expr.line);
    const c = ev(expr.args[0]);
    if (c !== null && c !== undefined && c !== false) {
      let result: any = null;
      for (let i = 1; i < expr.args.length; i++) result = ev(expr.args[i]);
      return result;
    }
    return null;
  }
  if (op === "unless") {
    if (expr.args.length < 2) throwArgCount("unless", ">=2", expr.args.length, expr.line);
    const c = ev(expr.args[0]);
    if (c === null || c === undefined || c === false) {
      let result: any = null;
      for (let i = 1; i < expr.args.length; i++) result = ev(expr.args[i]);
      return result;
    }
    return null;
  }

  // ── set ───────────────────────────────────────────────────────────
  if (op === "set") {
    if (expr.args.length !== 2) throwArgCount("set", "exactly 2", expr.args.length, expr.line);
    const varNode = expr.args[0] as any;
    let varName: string;
    if (varNode.kind === "variable") varName = varNode.name;
    else if (varNode.kind === "literal" && varNode.type === "symbol") varName = "$" + varNode.value;
    else throwInvalidForm("set", "first argument must be a variable", expr.line);
    const newValue = ev(expr.args[1]);
    if (!ctx.variables.mutate(varName, newValue)) throw new Error(`set: variable ${varName} not found in scope`);
    return newValue;
  }

  // ── if ────────────────────────────────────────────────────────────
  if (op === "if") {
    const condition = ev(expr.args[0]);
    const branch = condition ? expr.args[1] : (expr.args[2] || null);
    if (branch === null) return null;
    // Phase 61: TCO 모드 — 꼬리 위치의 사용자 함수 호출을 TailCall 토큰으로 반환
    if ((interp as any).tcoMode && branch !== null) {
      const b = branch as any;
      if (b.kind === "sexpr") {
        const bop = b.op;
        // 사용자 정의 함수이거나 아직 알 수 없는 함수 호출 — 일단 eval해서 확인
        // (builtin이면 그냥 실행, user-func이면 TailCall)
        const ctx = interp.context;
        if (typeof bop === "string" && ctx.functions.has(bop)) {
          // 꼬리 위치 user-function 호출 → TailCall 토큰 반환 (스택 없이)
          const tailArgs = b.args.map((a: any) => ev(a));
          return tailCall(bop, tailArgs);
        }
      }
    }
    return ev(branch);
  }

  // ── cond ──────────────────────────────────────────────────────────
  if (op === "cond") {
    return evalCond(interp, expr.args);
  }

  // ── do / begin / progn ───────────────────────────────────────────
  if (op === "do" || op === "begin" || op === "progn") {
    // IIFE: ((fn-expr) arg1 arg2 ...) — parser creates do-block; detect and call
    if (expr.args.length >= 2) {
      const first = ev(expr.args[0]);
      const isCallable = typeof first === "function"
        || first?.kind === "function-value"
        || first?.kind === "async-function-value"
        || first?.kind === "closure";
      if (isCallable) {
        const callArgs = expr.args.slice(1).map((a) => ev(a));
        if (typeof first === "function") return first(...callArgs);
        if (first?.kind === "function-value" || first?.kind === "async-function-value") return (interp as any).callFunctionValue(first, callArgs);
        if (first?.kind === "closure") {
          const params: string[] = first.params || [];
          ctx.variables.push();
          try {
            if (first["closure-env"]) {
              for (const [k, v] of Object.entries((first["closure-env"] as any).vars || {})) ctx.variables.set(k, v);
            }
            for (let i = 0; i < params.length; i++) ctx.variables.set(params[i], callArgs[i] ?? null);
            let result: any = null;
            for (const node of (first.body || [])) result = ev(node);
            return result;
          } finally { ctx.variables.pop(); }
        }
      }
      // not callable: args[0] already evaluated as `first`, evaluate remaining args
      let result: any = first;
      for (const arg of expr.args.slice(1)) {
        if (isBlock(arg) && isControlBlock(arg as any)) {
          (interp as any).evalBlock(arg);
          result = null;
          continue;
        }
        result = ev(arg);
      }
      return result;
    }
    let result: any = null;
    for (const arg of expr.args) {
      if (isBlock(arg) && isControlBlock(arg as any)) {
        (interp as any).evalBlock(arg);
        result = null;
        continue;
      }
      result = ev(arg);
    }
    return result;
  }

  // ── loop ──────────────────────────────────────────────────────────
  // Phase B-1: Two syntax variants supported:
  // 1. Classic: (loop [var1 val1 var2 val2...] body...) with (recur new-vals...)
  // 2. Modern: (loop [($var init) condition update] body...)
  if (op === "loop") {
    const bindingsNode = expr.args[0];
    const bodyNodes = expr.args.slice(1);

    // Get array items
    const bindingItems: any[] =
      (bindingsNode as any).kind === "array"
        ? (bindingsNode as any).items || []
        : (bindingsNode as any).kind === "block" && (bindingsNode as any).type === "Array"
          ? (bindingsNode as any).fields?.get?.("items") || []
          : [];

    // Detect modern syntax: [($var init) condition update]
    const isModernSyntax = bindingItems.length === 3 &&
      (bindingItems[0] as any).kind === "sexpr";

    if (isModernSyntax) {
      // Modern syntax: (loop [($var init) condition update] body)
      const initExpr = bindingItems[0];
      const condExpr = bindingItems[1];
      const updateExpr = bindingItems[2];

      // Extract variable name from ($var init)
      const varName = (initExpr as any).op || "$i";
      const initVal = ev((initExpr as any).args[0]);

      ctx.variables.push();
      ctx.variables.set(varName, initVal);

      let result: any = null;
      try {
        while (true) {
          const condVal = ev(condExpr);
          const isTruthy = condVal !== null && condVal !== undefined && condVal !== false;
          if (!isTruthy) break;

          for (const bodyNode of bodyNodes) {
            result = ev(bodyNode);
          }
          const newVal = ev(updateExpr);
          ctx.variables.set(varName, newVal);
        }
        return result;
      } finally {
        ctx.variables.pop();
      }
    }

    // Classic syntax: (loop [var1 val1 var2 val2...] body...) with (recur...)
    const loopVars: string[] = [];
    const loopInits: any[] = [];
    for (let i = 0; i < bindingItems.length; i += 2) {
      const varNode = bindingItems[i];
      const valNode = bindingItems[i + 1];
      const varName = varNode.kind === "variable" ? varNode.name
        : varNode.kind === "literal" ? String(varNode.value)
        : String(varNode.name || varNode.value);
      loopVars.push(varName);
      loopInits.push(ev(valNode));
    }

    ctx.variables.push();
    for (let i = 0; i < loopVars.length; i++) {
      ctx.variables.set(loopVars[i], loopInits[i]);
    }

    let result: any = null;
    const maxIter = 100000;
    let iter = 0;
    try {
      while (iter++ < maxIter) {
        // budget max-ms 체크 (1000회마다)
        if (iter % 1000 === 0) checkBudgetInLoop();
        let recurred = false;
        for (const bodyNode of bodyNodes) {
          result = ev(bodyNode);
          if (result && typeof result === "object" && result.__FL_RECUR__) {
            const newVals = result.__args as any[];
            for (let i = 0; i < loopVars.length && i < newVals.length; i++) {
              ctx.variables.set(loopVars[i], newVals[i]);
            }
            recurred = true;
            break;
          }
        }
        if (!recurred) break;
      }
    } finally {
      ctx.variables.pop();
    }
    return result;
  }

  // ── recur ─────────────────────────────────────────────────────────
  if (op === "recur") {
    const newVals = expr.args.map((a) => ev(a));
    return { __FL_RECUR__: true, __args: newVals };
  }

  // ── while ─────────────────────────────────────────────────────────
  if (op === "while") {
    let result: any = null;
    while (ev(expr.args[0])) {
      for (let i = 1; i < expr.args.length; i++) result = ev(expr.args[i]);
    }
    return result;
  }

  // ── when-not — (when-not cond body...) ───────────────────────────
  if (op === "when-not") {
    if (expr.args.length < 2) return null;
    const c = ev(expr.args[0]);
    if (c === null || c === undefined || c === false) {
      let result: any = null;
      for (let i = 1; i < expr.args.length; i++) result = ev(expr.args[i]);
      return result;
    }
    return null;
  }

  // ── dotimes — (dotimes [i n] body...) iterate 0..n-1 ────────────
  if (op === "dotimes") {
    const bindingNode = expr.args[0] as any;
    const items: any[] = bindingNode?.kind === "array"
      ? bindingNode.items || []
      : bindingNode?.fields?.get?.("items") || [];
    if (items.length < 2) return null;
    const bindName = (items[0] as any)?.name || (items[0] as any)?.value || "";
    const n = Number(ev(items[1]));
    for (let i = 0; i < n; i++) {
      interp.context.variables.push();
      try {
        interp.context.variables.set(bindName, i);
        for (let j = 1; j < expr.args.length; j++) ev(expr.args[j]);
      } finally {
        interp.context.variables.pop();
      }
    }
    return null;
  }

  // ── doseq — (doseq [x coll] body...) side-effect iteration ───────
  if (op === "doseq") {
    const bindingNode = expr.args[0] as any;
    const items: any[] = bindingNode?.kind === "array"
      ? bindingNode.items || []
      : bindingNode?.fields?.get?.("items") || [];
    if (items.length < 2) return null;
    const bindName = (items[0] as any)?.name || (items[0] as any)?.value || String((items[0] as any)?.value ?? "");
    const coll = ev(items[1]);
    if (!Array.isArray(coll)) return null;
    for (const item of coll) {
      interp.context.variables.push();
      try {
        interp.context.variables.set(bindName, item);
        for (let i = 1; i < expr.args.length; i++) ev(expr.args[i]);
      } finally {
        interp.context.variables.pop();
      }
    }
    return null;
  }

  // ── case — (case expr val1 res1 val2 res2 ... default) ───────────
  if (op === "case") {
    if (expr.args.length === 0) return null;
    const testVal = ev(expr.args[0]);
    let i = 1;
    while (i < expr.args.length - 1) {
      const matchVal = ev(expr.args[i]);
      if (testVal === matchVal) return ev(expr.args[i + 1]);
      i += 2;
    }
    // 홀수개 남으면 기본값
    if (i === expr.args.length - 1) return ev(expr.args[i]);
    return null;
  }

  // ── for — (for [x coll :when pred] body) → array ─────────────────
  if (op === "for") {
    const bindingNode = expr.args[0] as any;
    const items: any[] = bindingNode?.kind === "array"
      ? bindingNode.items || []
      : bindingNode?.fields?.get?.("items") || [];
    if (items.length < 2) return [];
    const bindName = (items[0] as any)?.name || (items[0] as any)?.value || "";
    const coll = ev(items[1]);
    if (!Array.isArray(coll)) return [];

    // :when 필터 추출 (선택적)
    let whenFn: any = null;
    for (let wi = 2; wi < items.length - 1; wi++) {
      const kw = (items[wi] as any)?.value || (items[wi] as any)?.name || "";
      if (kw === ":when" || kw === "when") {
        whenFn = items[wi + 1];
        break;
      }
    }

    const result: any[] = [];
    for (const item of coll) {
      interp.context.variables.push();
      try {
        interp.context.variables.set(bindName, item);
        if (whenFn) {
          const pass = ev(whenFn);
          if (!pass && pass !== 0) { continue; }
        }
        let val: any = null;
        for (let bi = 1; bi < expr.args.length; bi++) val = ev(expr.args[bi]);
        result.push(val);
      } finally {
        interp.context.variables.pop();
      }
    }
    return result;
  }

  // ── and (short-circuit) ───────────────────────────────────────────
  if (op === "and") {
    let result: any = true;
    for (const arg of expr.args) {
      result = ev(arg);
      if (!result) return result;
    }
    return result;
  }

  // ── or (short-circuit) ────────────────────────────────────────────
  // Lisp 표준: nil/false만 falsy. 0/""/[]/{} 는 truthy
  if (op === "or") {
    let last: any = null;
    for (const arg of expr.args) {
      last = ev(arg);
      if (last !== null && last !== undefined && last !== false) return last;
    }
    return last;
  }

  // ── map (inline comprehension, 3-arg form) ────────────────────────
  if (op === "map" && expr.args.length === 3) {
    const arr = ev(expr.args[0]);
    const paramNode = expr.args[1];
    const bodyNode = expr.args[2];
    const items: any[] =
      (paramNode as any).kind === "block" && (paramNode as any).type === "Array"
        ? (paramNode as any).fields.get?.("items") || []
        : (paramNode as any).kind === "array"
          ? (paramNode as any).items || []
          : [];
    const paramNames = items.map((item: any) => {
      if (item.kind === "variable") return item.name;
      if (item.kind === "literal") return "$" + item.value;
      return "$" + (item.name || item.value || "_");
    });
    if (Array.isArray(arr) && paramNames.length > 0) {
      return arr.map((elem: any) => {
        ctx.variables.push();
        ctx.variables.set(paramNames[0], elem);
        try {
          return ev(bodyNode);
        } finally {
          ctx.variables.pop();
        }
      });
    }
    // Fall through: return undefined (caller will evaluate args and try builtins)
    return undefined;
  }

  // ── 테스트 프레임워크 ─────────────────────────────────────────────
  // (deftest "name" body...)  — 테스트 등록 + 즉시 실행
  // (describe "suite" body...) — 동일 (별칭)
  // (it "name" body...)        — describe 내부용 (동일)
  if (op === "deftest" || op === "describe" || op === "it") {
    const ctx = interp.context as any;
    if (!ctx._testResults) ctx._testResults = { passed: 0, failed: 0, errors: [] as string[] };
    const name = expr.args.length > 0 ? String(ev(expr.args[0])) : "(anonymous)";
    const bodies = expr.args.slice(1);
    try {
      for (const b of bodies) ev(b);
      ctx._testResults.passed++;
      process.stdout.write(`  ✓ ${name}\n`);
    } catch (e: any) {
      ctx._testResults.failed++;
      const msg = e?.message ?? String(e);
      ctx._testResults.errors.push(`  ✗ ${name}: ${msg}`);
      process.stdout.write(`  ✗ ${name}: ${msg}\n`);
    }
    return null;
  }

  // (is expr)          — truthy assertion
  // (is= expected got) — equality assertion
  if (op === "is") {
    const val = expr.args.length > 0 ? ev(expr.args[0]) : false;
    const msg = expr.args.length > 1 ? String(ev(expr.args[1])) : `Expected truthy, got: ${JSON.stringify(val)}`;
    if (!val) throw new Error(msg);
    return val;
  }
  if (op === "is=") {
    if (expr.args.length < 2) throwArgCount("is=", "2", expr.args.length, expr.line);
    const expected = ev(expr.args[0]);
    const actual   = ev(expr.args[1]);
    const eq = JSON.stringify(expected) === JSON.stringify(actual);
    if (!eq) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return actual;
  }

  // (run-tests)  — 테스트 결과 출력 + 통계 반환
  if (op === "run-tests") {
    const ctx = interp.context as any;
    const r = ctx._testResults ?? { passed: 0, failed: 0, errors: [] };
    const total = r.passed + r.failed;
    process.stdout.write(`\nTest Results: ${r.passed}/${total} passed`);
    if (r.failed > 0) process.stdout.write(` (${r.failed} FAILED)`);
    process.stdout.write("\n");
    ctx._testResults = { passed: 0, failed: 0, errors: [] };
    return { passed: r.passed, failed: r.failed, total };
  }
  // (test-summary) — 결과를 Map으로 반환 (출력 없음)
  if (op === "test-summary") {
    const ctx = interp.context as any;
    const r = ctx._testResults ?? { passed: 0, failed: 0, errors: [] };
    return new Map([["passed", r.passed], ["failed", r.failed], ["total", r.passed + r.failed], ["errors", r.errors]]);
  }

  // ── import (use 별칭) ─────────────────────────────────────────────
  // (import "file.fl") — use와 동일하게 파일 로드
  if (op === "import") {
    if (expr.args.length < 1) throwArgCount("import", "1", expr.args.length, expr.line);
    const filePath = String(ev(expr.args[0]));
    // use 핸들러를 재활용
    const useExpr = { ...expr, op: "use", args: expr.args };
    return interp.evalSpecialForm("use", useExpr);
  }

  // ── migrate — 버전 관리 DB 마이그레이션 ──────────────────────────
  // (migrate db [["v1" "CREATE TABLE ..."] ["v2" "ALTER TABLE ..."]])
  // db: string(mariadb DB name) or number(pool-id) or nil(in-memory 테스트)
  if (op === "migrate") {
    if (expr.args.length < 2) throwArgCount("migrate", "2", expr.args.length, expr.line);
    const db    = ev(expr.args[0]);
    const steps = ev(expr.args[1]);
    if (!Array.isArray(steps)) throw new Error("migrate: second arg must be [[version sql] ...] array");

    const ctx = interp.context as any;

    // in-memory 모드 (db = null/nil): 실제 SQL 없이 버전 추적만
    if (db === null || db === undefined) {
      if (!ctx._migrate_applied) ctx._migrate_applied = new Set<string>();
      const applied: Set<string> = ctx._migrate_applied;
      let count = 0;
      for (const step of steps) {
        const pair = Array.isArray(step) ? step : [step];
        const version = String(pair[0]);
        if (applied.has(version)) continue;
        applied.add(version);
        count++;
        process.stdout.write(`  [migrate] applied: ${version}\n`);
      }
      if (count === 0) process.stdout.write("  [migrate] up to date\n");
      return { applied: count, total: steps.length };
    }

    // mariadb-exec 함수 참조
    const execFn = interp.context.functions.get("mariadb_exec") ??
                   interp.context.functions.get("mariadb-exec");
    const queryFn = interp.context.functions.get("mariadb_query") ??
                    interp.context.functions.get("mariadb-query");
    if (!execFn || !queryFn) throw new Error("migrate: mariadb functions not loaded");
    const exec  = (sql: string, params: any[] = []) => callFn(execFn.body ?? execFn, [db, sql, params]);
    const query = (sql: string, params: any[] = []) => callFn(queryFn.body ?? queryFn, [db, sql, params]);

    // _migrations 테이블 생성
    exec(`CREATE TABLE IF NOT EXISTS _migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at BIGINT NOT NULL
    )`);

    // 적용된 버전 조회
    const rows   = query("SELECT version FROM _migrations") as any[];
    const applied = new Set((rows ?? []).map((r: any) => String(r.version ?? r[0] ?? "")));

    let count = 0;
    for (const step of steps) {
      const pair = Array.isArray(step) ? step : [step];
      const version = String(pair[0]);
      const sql     = String(pair[1] ?? "");
      if (applied.has(version)) continue;
      exec(sql);
      exec("INSERT INTO _migrations (version, applied_at) VALUES (?, ?)", [version, Date.now()]);
      count++;
      process.stdout.write(`  [migrate] applied: ${version}\n`);
    }
    if (count === 0) process.stdout.write("  [migrate] up to date\n");
    return { applied: count, total: steps.length };
  }

  // ── memoize ──────────────────────────────────────────────────────
  // (memoize fn) → memoized version that caches by JSON(args)
  if (op === "memoize") {
    if (expr.args.length < 1) throwArgCount("memoize", "1", expr.args.length, expr.line);
    const fn = ev(expr.args[0]);
    const cache = new Map<string, any>();
    return (...args: any[]) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) return cache.get(key);
      const result = callFn(fn, args);
      cache.set(key, result);
      return result;
    };
  }

  // ── partial ───────────────────────────────────────────────────────
  // (partial f arg1 arg2 ...) → fn that prepends partialArgs to call
  if (op === "partial") {
    if (expr.args.length < 1) throwArgCount("partial", ">=1", expr.args.length, expr.line);
    const fn = ev(expr.args[0]);
    const partialArgs = expr.args.slice(1).map(ev);
    return (...rest: any[]) => {
      const allArgs = [...partialArgs, ...rest];
      if (typeof fn === "function") return fn(...allArgs);
      return callFn(fn, allArgs);
    };
  }

  // ── group-by ─────────────────────────────────────────────────────
  // (group-by key-fn coll) → {:key [items...]} map
  // key-fn: keyword string (:status) or FL function
  if (op === "group-by" || op === "group_by") {
    if (expr.args.length < 2) throwArgCount("group-by", "2", expr.args.length, expr.line);
    const keyFn = ev(expr.args[0]);
    const coll   = ev(expr.args[1]);
    if (!Array.isArray(coll)) return new Map();
    const getKey = (item: any): any => {
      if (typeof keyFn === "string") {
        const k = keyFn.startsWith(":") ? keyFn.slice(1) : keyFn;
        if (item instanceof Map) return item.get(keyFn) ?? item.get(k) ?? null;
        return item?.[k] ?? item?.[keyFn] ?? null;
      }
      if (typeof keyFn === "function") return keyFn(item);
      return callFn(keyFn, [item]);
    };
    const result = new Map<any, any[]>();
    for (const item of coll) {
      const key = getKey(item);
      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push(item);
    }
    return result;
  }

  // ── return ───────────────────────────────────────────────────────
  // (return expr) — fn 본체 내 early exit. try/catch를 통과해 함수 경계에서 캐치됨
  if (op === "return") {
    const val = expr.args.length > 0 ? ev(expr.args[0]) : null;
    throw new ReturnSignal(val);
  }

  // ── map-vals / map-keys ───────────────────────────────────────────
  // (map-vals m)   → values array  (alias for values)
  // (map-keys m)   → keys array    (alias for keys)
  // (map-vals f m) → new map with f applied to each value
  // (map-keys f m) → new map with f applied to each key
  if (op === "map-vals" || op === "map_vals" || op === "map-keys" || op === "map_keys") {
    const isKey = op === "map-keys" || op === "map_keys";

    // 1-arg: (map-keys m) / (map-vals m) → keys or values array
    if (expr.args.length === 1) {
      const m = ev(expr.args[0]);
      if (m instanceof Map) return isKey ? [...(m as Map<any,any>).keys()] : [...(m as Map<any,any>).values()];
      if (m && typeof m === "object" && !Array.isArray(m)) return isKey ? Object.keys(m) : Object.values(m);
      return [];
    }

    // 2-arg: (map-keys f m) / (map-vals f m) → transformed map
    if (expr.args.length === 2) {
      const fn = ev(expr.args[0]);
      const m  = ev(expr.args[1]);
      const applyFn = (fn: any, arg: any): any => callFn(fn, [arg]);
      if (m instanceof Map) {
        const out = new Map();
        for (const [k, v] of (m as Map<any,any>).entries())
          out.set(isKey ? applyFn(fn, k) : k, isKey ? v : applyFn(fn, v));
        return out;
      }
      if (m && typeof m === "object" && !Array.isArray(m)) {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(m))
          out[isKey ? String(applyFn(fn, k)) : k] = isKey ? v : applyFn(fn, v);
        return out;
      }
      return m;
    }
  }

  // ── defstruct ─────────────────────────────────────────────────────
  // (defstruct Point [:x :float :y :float])
  // 자동 생성:
  //   (Point 1.0 2.0)       → {:x 1.0 :y 2.0 :__type "Point"}
  //   (Point? v)            → true/false
  //   (Point.x v)           → v.x
  if (op === "defstruct") {
    if (expr.args.length < 2) {
      throw new Error(`defstruct requires a name and a field vector`);
    }

    // 1. 이름 추출
    const nameNode = expr.args[0] as any;
    const structName: string =
      nameNode.kind === "literal"  ? String(nameNode.value)
      : nameNode.kind === "variable" ? nameNode.name
      : String(nameNode.value ?? nameNode.name ?? "");

    if (!structName) throw new Error(`defstruct: struct name is required`);

    // 2. 필드 벡터 파싱 [:x :float :y :float]
    const fieldsNode = expr.args[1] as any;
    const fields: Array<{ name: string; type: string }> = [];

    if (fieldsNode.kind === "block" && fieldsNode.type === "Array") {
      const items = fieldsNode.fields.get("items");
      if (Array.isArray(items)) {
        // Phase E 후속: 두 형태 모두 지원
        // 1) 명시적 타입: [:x :int :y :int]  — 짝수 개수, item[i]=name, item[i+1]=type
        // 2) 단순 형태:   [x y z] 또는 [:x :y :z] — type 모두 "any"
        // 자동 감지: 모든 item이 keyword/variable이고 한 칸 건너 type일 가능성 없으면 단순 형태
        const isSimpleForm = (() => {
          // 짝수가 아니거나, item 사이에 type-like가 없으면 단순 형태
          if (items.length % 2 !== 0) return true;
          // type-keyword pattern check: item[i+1]이 :int :float :string :any 같은 type symbol이면 명시 형태
          const TYPE_KW = new Set(["int","float","number","string","bool","boolean","any","list","array","map","fn","function"]);
          for (let i = 1; i < items.length; i += 2) {
            const it = items[i] as any;
            const v = it?.kind === "keyword" ? it.name : it?.kind === "variable" ? it.name : it?.value;
            if (TYPE_KW.has(String(v))) return false; // 명시 형태 확정
          }
          return true; // type-keyword 없으면 단순 형태
        })();

        if (isSimpleForm) {
          // 단순: 모든 item이 field name (type=any)
          for (const item of items) {
            const it = item as any;
            const fieldName =
              it.kind === "keyword" ? it.name
              : it.kind === "variable" ? it.name
              : it.kind === "literal"  ? String(it.value)
              : "";
            if (fieldName) fields.push({ name: fieldName, type: "any" });
          }
        } else {
          // 명시: name + type 페어
          for (let i = 0; i < items.length; i += 2) {
            const nameItem = items[i] as any;
            const typeItem = items[i + 1] as any;
            const fieldName =
              nameItem.kind === "keyword" ? nameItem.name
              : nameItem.kind === "variable" ? nameItem.name
              : nameItem.kind === "literal"  ? String(nameItem.value)
              : "";
            const fieldType =
              typeItem === undefined            ? "any"
              : typeItem.kind === "keyword"    ? typeItem.name
              : typeItem.kind === "variable"   ? typeItem.name
              : typeItem.kind === "literal"    ? String(typeItem.value)
              : "any";
            if (fieldName) fields.push({ name: fieldName, type: fieldType });
          }
        }
      }
    }

    // 3. StructRegistry에 등록
    const registry: StructRegistry = ctx.structs;
    registry.define({ name: structName, fields });

    // 4. constructor 등록 — (Point 1.0 2.0)
    const ctor = registry.makeConstructor(structName);
    ctx.functions.set(structName, {
      name: structName,
      params: fields.map((f) => f.name),
      body: { kind: "literal", type: "null", value: null } as any,
      capturedEnv: new Map([["__struct_ctor__", ctor]]),
    });
    // native 함수로도 등록 (eval-builtins fallback이 아닌 직접 호출)
    (ctx as any)[`__native_${structName}`] = ctor;

    // 5. predicate 등록 — (Point? v)
    const pred = registry.makePredicate(structName);
    (ctx as any)[`__native_${structName}?`] = pred;

    // 6. field accessor 등록 — (Point.x v), (Point.y v) ...
    for (const field of fields) {
      const accessorName = `${structName}.${field.name}`;
      const acc = registry.makeAccessor(structName, field.name);
      (ctx as any)[`__native_${accessorName}`] = acc;
    }

    return null;
  }

  // ── defmacro ──────────────────────────────────────────────────────
  // (defmacro name [$cond $body] (if $cond $body nil))
  if (op === "defmacro") {
    if (expr.args.length < 3) throw new Error(`defmacro requires name, params, and body`);
    const nameNode = expr.args[0] as any;
    const macroName: string = nameNode.kind === "literal" ? String(nameNode.value)
      : nameNode.kind === "variable" ? nameNode.name
      : String(nameNode.value ?? nameNode.name ?? "");

    const paramsNode = expr.args[1] as any;
    const params: string[] = [];
    if (paramsNode.kind === "block" && paramsNode.type === "Array") {
      const items = paramsNode.fields.get("items");
      if (Array.isArray(items)) {
        for (const item of items as any[]) {
          if (item.kind === "variable") params.push(item.name.startsWith("$") ? item.name : "$" + item.name);
          else if (item.kind === "literal") params.push("$" + item.value);
        }
      }
    }
    const body = expr.args[2];
    ctx.macroExpander.define(macroName, params, body);
    return null;
  }

  // ── macroexpand ───────────────────────────────────────────────────
  // (macroexpand '(when true (println "yes"))) → 확장된 AST 출력 (디버깅용)
  if (op === "macroexpand") {
    if (expr.args.length < 1) throw new Error(`macroexpand requires 1 argument`);
    const form = expr.args[0];
    const expanded = ctx.macroExpander.expand(form);
    return ctx.macroExpander.astToString(expanded);
  }

  // ── defprotocol ───────────────────────────────────────────────────
  // (defprotocol Serializable
  //   [serialize [$self] :string]
  //   [deserialize [$data] :any])
  if (op === "defprotocol") {
    if (expr.args.length < 1) throw new Error(`defprotocol requires a name`);
    const nameNode = expr.args[0] as any;
    const protoName: string =
      nameNode.kind === "variable" ? nameNode.name
      : nameNode.kind === "literal" ? String(nameNode.value)
      : String(nameNode.name ?? nameNode.value ?? "");

    const methods: Array<{ name: string; params: string[]; returnType?: string }> = [];

    for (let i = 1; i < expr.args.length; i++) {
      const sigNode = expr.args[i] as any;
      if (sigNode.kind !== "block" || sigNode.type !== "Array") continue;
      const items = sigNode.fields.get("items");
      if (!Array.isArray(items) || items.length < 1) continue;

      const methodNameNode = items[0] as any;
      const methodName: string =
        methodNameNode.kind === "variable" ? methodNameNode.name
        : methodNameNode.kind === "literal" ? String(methodNameNode.value)
        : String(methodNameNode.name ?? methodNameNode.value ?? "");

      const params: string[] = [];
      if (items.length > 1) {
        const paramsNode = items[1] as any;
        if (paramsNode.kind === "block" && paramsNode.type === "Array") {
          const pItems = paramsNode.fields.get("items");
          if (Array.isArray(pItems)) {
            for (const p of pItems as any[]) {
              if (p.kind === "variable") params.push(p.name);
              else if (p.kind === "literal") params.push("$" + p.value);
            }
          }
        }
      }

      let returnType: string | undefined;
      if (items.length > 2) {
        const rtNode = items[2] as any;
        if (rtNode.kind === "keyword") returnType = rtNode.name;
        else if (rtNode.kind === "literal") returnType = String(rtNode.value);
      }

      methods.push({ name: methodName, params, returnType });
    }

    ctx.protocols.defineProtocol({ name: protoName, methods });
    return null;
  }

  // ── impl ──────────────────────────────────────────────────────────
  // (impl Serializable Point
  //   [serialize [$self] (str "(" $self.x "," $self.y ")")]
  //   [deserialize [$data] {:x 0.0 :y 0.0}])
  if (op === "impl") {
    if (expr.args.length < 3) throw new Error(`impl requires protocol name, type name, and at least one method`);

    const protoNameNode = expr.args[0] as any;
    const protoName: string =
      protoNameNode.kind === "variable" ? protoNameNode.name
      : protoNameNode.kind === "literal" ? String(protoNameNode.value)
      : String(protoNameNode.name ?? protoNameNode.value ?? "");

    const typeNameNode = expr.args[1] as any;
    const typeName: string =
      typeNameNode.kind === "variable" ? typeNameNode.name
      : typeNameNode.kind === "literal" ? String(typeNameNode.value)
      : String(typeNameNode.name ?? typeNameNode.value ?? "");

    const implMethods = new Map<string, { params: string[]; body: any }>();

    for (let i = 2; i < expr.args.length; i++) {
      const implNode = expr.args[i] as any;
      if (implNode.kind !== "block" || implNode.type !== "Array") continue;
      const items = implNode.fields.get("items");
      if (!Array.isArray(items) || items.length < 3) continue;

      const methodNameNode = items[0] as any;
      const methodName: string =
        methodNameNode.kind === "variable" ? methodNameNode.name
        : methodNameNode.kind === "literal" ? String(methodNameNode.value)
        : String(methodNameNode.name ?? methodNameNode.value ?? "");

      const params: string[] = [];
      const paramsNode = items[1] as any;
      if (paramsNode.kind === "block" && paramsNode.type === "Array") {
        const pItems = paramsNode.fields.get("items");
        if (Array.isArray(pItems)) {
          for (const p of pItems as any[]) {
            if (p.kind === "variable") params.push(p.name);
            else if (p.kind === "literal") params.push("$" + p.value);
          }
        }
      }

      const body = items[2];
      implMethods.set(methodName, { params, body });
    }

    ctx.protocols.defineImpl({ protocolName: protoName, typeName, methods: implMethods });
    return null;
  }

  // ── parallel ──────────────────────────────────────────────────────
  // (parallel expr1 expr2 ...) → [result1, result2, ...]
  // 동기 버전: 순차 실행 후 배열 반환 (FreeLangPromise는 resolve 후 반환)
  if (op === "parallel") {
    if (expr.args.length === 0) return [];
    const results: any[] = [];
    for (const arg of expr.args) {
      let val = ev(arg);
      // FreeLangPromise면 resolved 값 추출 시도
      if (val && typeof val === "object" && typeof val.getValue === "function") {
        try { val = val.getValue(); } catch { val = null; }
      }
      results.push(val);
    }
    return results;
  }

  // ── race ──────────────────────────────────────────────────────────
  // (race expr1 expr2 ...) → 첫 번째로 완료된 결과 (동기 버전: 첫 번째 non-null 반환)
  if (op === "race") {
    if (expr.args.length === 0) return null;
    let firstResult: any = undefined;
    for (const arg of expr.args) {
      let val = ev(arg);
      if (val && typeof val === "object" && typeof val.getValue === "function") {
        try { val = val.getValue(); } catch { val = null; }
      }
      if (firstResult === undefined) firstResult = val;
      if (val !== null && val !== undefined) return val;
    }
    return firstResult ?? null;
  }

  // ── with-timeout ──────────────────────────────────────────────────
  // (with-timeout ms expr) → result or null
  // 동기 버전: ms는 무시하고 즉시 실행 (비동기 환경 없으므로)
  if (op === "with-timeout") {
    if (expr.args.length < 2) return null;
    // expr.args[0] = ms (무시), expr.args[1] = expression
    try {
      let val = ev(expr.args[1]);
      if (val && typeof val === "object" && typeof val.getValue === "function") {
        try { val = val.getValue(); } catch { val = null; }
      }
      return val;
    } catch {
      return null;
    }
  }

  // ── Phase 96: fl-try ─────────────────────────────────────────────────
  // (fl-try expr)
  // (fl-try expr :on-err fn)
  // (fl-try expr :on-type-error fn :on-not-found fn :on-io fn :default fn)
  if (op === "fl-try") {
    if (expr.args.length < 1) throw new Error(`fl-try requires at least 1 argument`);
    const bodyNode = expr.args[0];

    // 나머지 인자에서 키워드-핸들러 쌍 추출
    // 파서: :on-err → {kind:"literal", type:"string", value:"on-err"} (콜론 제거)
    //       또는 {kind:"keyword", name:"on-err"} 또는 {kind:"keyword", value:"on-err"}
    const FL_TRY_KEYS = new Set([
      "on-err", "on-type-error", "on-not-found", "on-io", "on-arity",
      "on-ai", "on-timeout", "on-runtime", "default",
    ]);
    const handlers = new Map<string, any>();
    let i = 1;
    while (i < expr.args.length) {
      const keyNode = expr.args[i] as any;
      let key: string | null = null;
      if (keyNode.kind === "keyword") {
        const v = String(keyNode.name ?? keyNode.value ?? "");
        if (FL_TRY_KEYS.has(v)) key = v;
      } else if (keyNode.kind === "literal" && keyNode.type === "string") {
        // :on-err → "on-err" (파서가 콜론 제거), 또는 ":on-err" (콜론 포함)
        const v = keyNode.value.startsWith(":") ? keyNode.value.slice(1) : keyNode.value;
        if (FL_TRY_KEYS.has(v)) key = v;
      }
      if (key !== null && i + 1 < expr.args.length) {
        handlers.set(key, ev(expr.args[i + 1]));
        i += 2;
      } else {
        i++;
      }
    }

    // 본문 실행 — Result로 래핑
    let result: any;
    try {
      const val = ev(bodyNode);
      // 이미 Result 타입이면 그대로, 아니면 ok로 래핑
      if (val && typeof val === "object" && (val._tag === "Ok" || val._tag === "Err")) {
        result = val;
      } else {
        result = ok(val);
      }
    } catch (e: unknown) {
      const flErr = fromThrown(e);
      result = flErr;
    }

    // 핸들러 처리
    if (isErr(result)) {
      const e = result;
      // 카테고리별 핸들러
      const categoryHandlerMap: Record<string, ErrorCategory> = {
        "on-type-error": ErrorCategory.TYPE_ERROR,
        "on-not-found": ErrorCategory.NOT_FOUND,
        "on-io": ErrorCategory.IO,
        "on-arity": ErrorCategory.ARITY,
        "on-ai": ErrorCategory.AI,
        "on-timeout": ErrorCategory.TIMEOUT,
      };

      // 카테고리 매칭 핸들러 우선
      let handled = false;
      for (const [handlerKey, category] of Object.entries(categoryHandlerMap)) {
        if (handlers.has(handlerKey) && e.category === category) {
          const fn = handlers.get(handlerKey);
          const handlerResult = callFnVal(fn, [e]);
          return handlerResult;
        }
      }

      // :on-err — 모든 에러
      if (!handled && handlers.has("on-err")) {
        const fn = handlers.get("on-err");
        return callFnVal(fn, [e]);
      }

      // :default — 나머지
      if (!handled && handlers.has("default")) {
        const fn = handlers.get("default");
        return callFnVal(fn, [e]);
      }

      // 핸들러 없으면 err 값 그대로 반환
      return result;
    }

    return result;
  }

  throw new Error(`evalSpecialForm: unknown op "${op}"`);
}

// ── Helper: evalLet (v11.1: 1차원/2차원 대괄호 + bare symbol 모두 지원) ───
function evalLet(interp: Interpreter, args: ASTNode[]): any {
  if (args.length < 2) throw new Error(`let requires at least 2 arguments`);
  const bindings = args[0];
  const ctx = interp.context;
  const ev = (node: any) => (interp as any).eval(node);

  const toVarName = (node: any): string => {
    if (node?.kind === "variable") {
      const n = node.name as string;
      return n.startsWith("$") ? n : "$" + n;
    }
    if (node?.kind === "literal" && node.type === "symbol") {
      const v = node.value as string;
      return v.startsWith("$") ? v : "$" + v;
    }
    throw new Error(`Invalid binding variable: expected symbol or variable, got ${node?.kind}`);
  };

  ctx.variables.push();

  if ((bindings as any).kind === "block" && (bindings as any).type === "Array") {
    const items = (bindings as any).fields.get("items");
    if (Array.isArray(items) && items.length > 0) {
      // 감지: 첫 원소가 Array block 이면 2차원 ([[$x expr] [$y expr]])
      //       그렇지 않으면 1차원 ([$x expr $y expr] or [x expr y expr])
      const isNested = items[0]?.kind === "block" && items[0]?.type === "Array";

      // v11.10: 혼합 감지 개선
      // 2차원: 모든 짝수 위치 (0,2,4...) 원소가 Array block
      // 1차원: 변수-값 쌍이 평탄하게 배열됨 (첫 원소가 Array block이 아니면 1차원)
      if (isNested) {
        // 2차원이면 모든 짝수 위치가 Array block이어야 함
        for (let i = 0; i < items.length; i += 2) {
          if (!(items[i]?.kind === "block" && items[i]?.type === "Array")) {
            ctx.variables.pop();
            throw new Error(`let: 2차원 바인딩에서 원소 ${i}가 배열이 아님`);
          }
        }
      } else {
        // 1차원이면 짝수 개여야 함 (변수-값 쌍)
        // 이미 위에서 확인함
      }

      if (isNested) {
        // 기존 2차원 경로 (v11 호환)
        for (const item of items) {
          if ((item as any).kind === "block" && (item as any).type === "Array") {
            const bindingItems = (item as any).fields.get("items");
            if (Array.isArray(bindingItems) && bindingItems.length >= 2) {
              const varName = toVarName(bindingItems[0]);
              const value = ev(bindingItems[1]);
              // Phase Y-1: 메타정보 저장
              const meta: Partial<ScopeVarMeta> = {
                line: (bindingItems[0] as any).line,
                col: (bindingItems[0] as any).col,
                type: inferType(value),
              };
              ctx.variables.set(varName, value, meta);
            }
          }
        }
      } else {
        // v11.1 신규: 1차원 평탄 문법
        if (items.length % 2 !== 0) {
          ctx.variables.pop();
          throw new Error(`let: expected even number of binding items, got ${items.length}`);
        }
        for (let i = 0; i < items.length; i += 2) {
          const pattern = items[i];

          // Map 구조분해: {:keys [name age]} sourceMap
          if ((pattern as any)?.kind === "block" && (pattern as any)?.type === "Map") {
            const mapFields = (pattern as any).fields as Map<string, any>;
            const keysField = mapFields?.get("keys");
            if (keysField?.kind === "block" && keysField?.type === "Array") {
              const sourceMap = ev(items[i + 1]);
              const keyItems: any[] = keysField.fields.get("items") ?? [];
              for (const keyNode of keyItems) {
                const rawName: string | null =
                  keyNode?.kind === "literal" && keyNode?.type === "symbol" ? keyNode.value as string
                  : keyNode?.kind === "variable" ? (keyNode.name as string).replace(/^\$/, "")
                  : null;
                if (rawName !== null) {
                  const varName = rawName.startsWith("$") ? rawName : "$" + rawName;
                  const value = (sourceMap !== null && typeof sourceMap === "object")
                    ? (sourceMap[rawName] ?? null)
                    : null;
                  ctx.variables.set(varName, value, {
                    line: (keyNode as any).line,
                    col: (keyNode as any).col,
                    type: inferType(value),
                  } as Partial<ScopeVarMeta>);
                }
              }
            }
            continue;
          }

          const varName = toVarName(pattern);
          const value = ev(items[i + 1]);
          // Phase Y-1: 메타정보 저장
          const meta: Partial<ScopeVarMeta> = {
            line: (items[i] as any).line,
            col: (items[i] as any).col,
            type: inferType(value),
          };
          ctx.variables.set(varName, value, meta);
        }
      }
    }
  }

  let result: any = null;
  try {
    for (let bodyIdx = 1; bodyIdx < args.length; bodyIdx++) {
      result = ev(args[bodyIdx]);
    }
  } finally {
    ctx.variables.pop();
  }
  return result;
}

// ── Helper: evalCond ──────────────────────────────────────────────
function evalCond(interp: Interpreter, args: ASTNode[]): any {
  const ev = (node: any) => (interp as any).eval(node);

  // P1-1 (2026-04-25): flat-pair 자동 감지
  // (cond test1 result1 test2 result2 default)  ← Common Lisp 스타일
  // 분류 규칙: 첫 인자가 block(Array) 또는 sexpr op="do"이면 기존 bracketed
  //          그 외는 flat-pair (test/result 2개씩)
  const firstArg = args[0] as any;
  const isBracketed =
    (firstArg?.kind === "block" && firstArg?.type === "Array") ||
    (firstArg?.kind === "sexpr" && firstArg?.op === "do");
  if (args.length >= 2 && !isBracketed) {
    // flat-pair 모드: 2개씩 (test, result), 마지막 홀수면 default
    let i = 0;
    while (i < args.length - 1) {
      const testArg = args[i] as any;
      const isElse = testArg?.kind === "variable" &&
        (testArg?.name === "else" || testArg?.name === ":else" || testArg?.name === "$else");
      const test = isElse ? true : ev(testArg);
      if (test !== null && test !== undefined && test !== false) {
        return ev(args[i + 1]);
      }
      i += 2;
    }
    // 홀수개 남았으면 마지막을 default로
    if (i < args.length) return ev(args[i]);
    return null;
  }

  // 기존 로직: bracketed pair [test result] 형식
  for (const arg of args) {
    let testNode: any = null;
    let bodyNodes: any[] = [];

    // [test result...] Array block 형식
    if ((arg as any).kind === "block" && (arg as any).type === "Array") {
      const items = (arg as any).fields.get("items");
      if (Array.isArray(items) && items.length >= 2) {
        const firstItem = items[0] as any;
        const isElse = firstItem?.kind === "variable" &&
          (firstItem?.name === "else" || firstItem?.name === ":else" || firstItem?.name === "$else");
        testNode = isElse ? { kind: "literal", type: "boolean", value: true } : firstItem;
        bodyNodes = items.slice(1);
      }
    }
    // ((test-expr) body...) → parser creates SExpr{op:"do", args:[test, body...]}
    else if ((arg as any).kind === "sexpr" && (arg as any).op === "do" && (arg as any).args.length >= 2) {
      testNode = (arg as any).args[0];
      bodyNodes = (arg as any).args.slice(1);
    }
    // (test body) → SExpr where op is test symbol and args is rest
    // e.g. (true result) → SExpr{op:"true", args:[result]}
    else if ((arg as any).kind === "sexpr" && (arg as any).args.length >= 1) {
      const s = arg as any;
      testNode = { kind: "literal", type: "boolean", value: s.op === "true" ? true : s.op === "false" ? false : s.op === "else" ? true : undefined };
      if (testNode.value === undefined) {
        // op is a symbol test — reconstruct as variable lookup or literal
        testNode = { kind: "variable", name: s.op.startsWith("$") ? s.op : "$" + s.op };
      }
      bodyNodes = s.args;
    }

    if (testNode && bodyNodes.length >= 1) {
      const test = ev(testNode);
      if (test) {
        let result: any = null;
        for (const b of bodyNodes) result = ev(b);
        return result;
      }
    }
  }
  return null;
}
