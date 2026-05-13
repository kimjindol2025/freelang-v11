#!/usr/bin/env node
// FreeLang → WASM 컴파일러 백엔드 (v11.7.3)
// Usage:
//   node wasm-backend.js compile /tmp/ast.json       → {ok,wasm_b64}
//   node wasm-backend.js run /tmp/ast.json add 3 4   → {ok,value}
//   node wasm-backend.js eval /tmp/expr.json          → {ok,value}

'use strict';

// ── WASM 바이너리 인코딩 유틸 ────────────────────────────────────────────────

function uleb128(n) {
  n = n >>> 0;
  const bytes = [];
  do {
    let byte = n & 0x7F;
    n >>>= 7;
    if (n !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (n !== 0);
  return bytes;
}

function sleb128(n) {
  const bytes = [];
  let more = true;
  while (more) {
    let byte = n & 0x7F;
    n >>= 7;
    if ((n === 0 && (byte & 0x40) === 0) || (n === -1 && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    bytes.push(byte);
  }
  return bytes;
}

function f64bytes(v) {
  const buf = Buffer.allocUnsafe(8);
  buf.writeDoubleLe(v, 0);
  return [...buf];
}

function encStr(s) {
  const raw = [...Buffer.from(s, 'utf8')];
  return [...uleb128(raw.length), ...raw];
}

function flat(...arrays) {
  return arrays.flat(Infinity);
}

function section(id, content) {
  const bytes = flat(content);
  return [id, ...uleb128(bytes.length), ...bytes];
}

function vecOf(items, encode) {
  const encoded = items.flatMap(encode);
  return [...uleb128(items.length), ...encoded];
}

// ── 타입 ──────────────────────────────────────────────────────────────────────
// valtype: i32=0x7F, i64=0x7E, f32=0x7D, f64=0x7C

const I32 = 0x7F;
const F64 = 0x7C;

// ── 표현식 컴파일 ─────────────────────────────────────────────────────────────
// AST: number | string | [op, ...args]
// 지원 연산: +, -, *, /, %, ==, !=, <, >, <=, >=, and, or, not
//           if, let, do (sequence), call (local fn call)

function compileExpr(expr, params, locals, fns) {
  // 정수 상수
  if (typeof expr === 'number') {
    if (Number.isInteger(expr) && expr >= -2147483648 && expr <= 2147483647) {
      return { bytes: [0x41, ...sleb128(expr)], type: I32 };
    } else {
      return { bytes: [0x44, ...f64bytes(expr)], type: F64 };
    }
  }

  // 변수 참조
  if (typeof expr === 'string') {
    // 먼저 로컬에서 찾기
    const locIdx = locals.findIndex(l => l.name === expr);
    if (locIdx >= 0) {
      return { bytes: [0x20, ...uleb128(params.length + locIdx)], type: locals[locIdx].type };
    }
    // 파라미터에서 찾기
    const pIdx = params.findIndex(p => p === expr);
    if (pIdx >= 0) {
      return { bytes: [0x20, ...uleb128(pIdx)], type: I32 };
    }
    throw new Error(`Unknown variable: ${expr}`);
  }

  if (!Array.isArray(expr)) throw new Error(`Invalid expr: ${JSON.stringify(expr)}`);

  const [op, ...args] = expr;

  // ── 특수 폼 ────────────────────────────────────────────────────────────────

  // (if cond then else)
  if (op === 'if') {
    const [cond, thenExpr, elseExpr] = args;
    const condC = compileExpr(cond, params, locals, fns);
    const thenC = compileExpr(thenExpr, params, locals, fns);
    const elseC = elseExpr !== undefined
      ? compileExpr(elseExpr, params, locals, fns)
      : { bytes: [0x41, 0x00], type: I32 };
    return {
      bytes: [...condC.bytes, 0x04, thenC.type, ...thenC.bytes, 0x05, ...elseC.bytes, 0x0B],
      type: thenC.type
    };
  }

  // (do expr1 expr2 ... exprN) — sequence, return last
  if (op === 'do') {
    const compiled = args.map(a => compileExpr(a, params, locals, fns));
    const allBytes = [];
    for (let i = 0; i < compiled.length - 1; i++) {
      allBytes.push(...compiled[i].bytes, 0x1A); // drop
    }
    allBytes.push(...compiled[compiled.length - 1].bytes);
    return { bytes: allBytes, type: compiled[compiled.length - 1].type };
  }

  // (let [[name val] ...] body)  — local variable binding
  if (op === 'let') {
    const [bindings, body] = args;
    const newLocals = [...locals];
    const allBytes = [];
    for (const [name, valExpr] of bindings) {
      const valC = compileExpr(valExpr, params, newLocals, fns);
      const idx = params.length + newLocals.length;
      newLocals.push({ name, type: valC.type });
      allBytes.push(...valC.bytes, 0x21, ...uleb128(idx)); // local.set
    }
    const bodyC = compileExpr(body, params, newLocals, fns);
    // Merge new locals back (for caller to know about them)
    locals.push(...newLocals.slice(locals.length));
    return { bytes: [...allBytes, ...bodyC.bytes], type: bodyC.type };
  }

  // (call fn-name args...) — call another function in module
  if (op === 'call') {
    const [fnName, ...callArgs] = args;
    const fnIdx = fns.findIndex(f => f.name === fnName);
    if (fnIdx < 0) throw new Error(`Unknown function: ${fnName}`);
    const compiledArgs = callArgs.map(a => compileExpr(a, params, locals, fns));
    const argBytes = compiledArgs.flatMap(c => c.bytes);
    return {
      bytes: [...argBytes, 0x10, ...uleb128(fnIdx)], // call
      type: fns[fnIdx].returnType === 'f64' ? F64 : I32
    };
  }

  // ── 이항 연산 ──────────────────────────────────────────────────────────────

  const i32ops = {
    '+':   0x6A, '-':  0x6B, '*':  0x6C, '/':  0x6D, '%':  0x6F,
    '==':  0x46, '!=': 0x47, '<':  0x48, '>':  0x4A, '<=': 0x4C, '>=': 0x4E,
    'and': 0x71, 'or': 0x72, 'xor': 0x73, '<<': 0x74, '>>': 0x75
  };

  if (op in i32ops) {
    const compiled = args.map(a => compileExpr(a, params, locals, fns));
    const bytes = [...compiled.flatMap(c => c.bytes), i32ops[op]];
    const isCompare = ['==','!=','<','>','<=','>='].includes(op);
    return { bytes, type: I32 };
  }

  // (not x) → eqz
  if (op === 'not') {
    const c = compileExpr(args[0], params, locals, fns);
    return { bytes: [...c.bytes, 0x45], type: I32 }; // i32.eqz
  }

  // (neg x) → 0 - x
  if (op === 'neg') {
    const c = compileExpr(args[0], params, locals, fns);
    return { bytes: [0x41, 0x00, ...c.bytes, 0x6B], type: I32 };
  }

  // (abs x) → x >= 0 ? x : 0-x  (i32 버전)
  if (op === 'abs') {
    const c = compileExpr(args[0], params, locals, fns);
    // (if (>= x 0) x (neg x))
    return compileExpr(['if', ['>=', args[0], 0], args[0], ['neg', args[0]]], params, locals, fns);
  }

  // (min a b) / (max a b)
  if (op === 'min') {
    return compileExpr(['if', ['<=', args[0], args[1]], args[0], args[1]], params, locals, fns);
  }
  if (op === 'max') {
    return compileExpr(['if', ['>=', args[0], args[1]], args[0], args[1]], params, locals, fns);
  }

  throw new Error(`Unknown operator: ${op}`);
}

// ── 함수 컴파일 ───────────────────────────────────────────────────────────────

function compileFn(fn, allFns) {
  const params = fn.params || [];
  const locals = [];

  const bodyC = compileExpr(fn.body, params, locals, allFns);
  const instrs = [...bodyC.bytes, 0x0B]; // end

  // Local declarations (after params)
  const localDecls = locals.map(l => [...uleb128(1), l.type]);
  const localVec = [...uleb128(locals.length), ...localDecls.flat()];

  const codeBody = [...localVec, ...instrs];
  const codeEntry = [...uleb128(codeBody.length), ...codeBody];

  const returnType = fn.returnType === 'f64' ? F64 : I32;
  const typeEntry = [
    0x60,
    ...uleb128(params.length),
    ...Array(params.length).fill(I32),
    0x01, returnType
  ];

  return { name: fn.name, typeEntry, codeEntry };
}

// ── WASM 모듈 빌드 ────────────────────────────────────────────────────────────

function buildModule(fns) {
  const compiled = fns.map(f => compileFn(f, fns));

  const magic = [0x00, 0x61, 0x73, 0x6D];
  const version = [0x01, 0x00, 0x00, 0x00];

  // Type section
  const typeContent = [
    ...uleb128(compiled.length),
    ...compiled.flatMap(f => f.typeEntry)
  ];
  const typeSec = section(0x01, typeContent);

  // Function section
  const fnContent = [
    ...uleb128(compiled.length),
    ...compiled.flatMap((_, i) => uleb128(i))
  ];
  const fnSec = section(0x03, fnContent);

  // Export section
  const exportContent = [
    ...uleb128(compiled.length),
    ...compiled.flatMap((f, i) => [...encStr(f.name), 0x00, ...uleb128(i)])
  ];
  const exportSec = section(0x07, exportContent);

  // Code section
  const codeContent = [
    ...uleb128(compiled.length),
    ...compiled.flatMap(f => f.codeEntry)
  ];
  const codeSec = section(0x0A, codeContent);

  return Buffer.from([...magic, ...version, ...typeSec, ...fnSec, ...exportSec, ...codeSec]);
}

// ── 실행 진입점 ────────────────────────────────────────────────────────────────

const [,, mode, astFile, ...rest] = process.argv;

function out(obj) {
  process.stdout.write(JSON.stringify(obj));
}

try {
  const fs = require('fs');
  const ast = JSON.parse(fs.readFileSync(astFile, 'utf8'));
  const fns = ast.fns || [];

  if (mode === 'compile') {
    const bytes = buildModule(fns);
    out({ ok: true, wasm: bytes.toString('base64'), size: bytes.length });

  } else if (mode === 'run') {
    const fnName = rest[0];
    const args = rest.slice(1).map(Number);
    const bytes = buildModule(fns);
    const wasmModule = new WebAssembly.Module(bytes);
    const instance = new WebAssembly.Instance(wasmModule);
    const fn = instance.exports[fnName];
    if (!fn) throw new Error(`No export: ${fnName}`);
    out({ ok: true, value: fn(...args) });

  } else if (mode === 'eval') {
    // ast = {expr, params, args}
    const expr = ast.expr;
    const params = ast.params || [];
    const args = (ast.args || []).map(Number);
    const wrapper = { name: '__eval__', params, body: expr };
    const bytes = buildModule([wrapper]);
    const wasmModule = new WebAssembly.Module(bytes);
    const instance = new WebAssembly.Instance(wasmModule);
    out({ ok: true, value: instance.exports.__eval__(...args) });

  } else {
    out({ ok: false, error: `Unknown mode: ${mode}` });
  }
} catch (e) {
  out({ ok: false, error: e.message });
}
