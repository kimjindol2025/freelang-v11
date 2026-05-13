#!/usr/bin/env node
// FreeLang → WASM 컴파일러 백엔드 v2 (W-2)
// mode: compile <ast.json> | run <ast.json> <fn> <args...> | eval <ast.json>
'use strict';

// ── 인코딩 유틸 ───────────────────────────────────────────────────────────────

function uleb128(n) {
  n = n >>> 0;
  const b = [];
  do { let byte = n & 0x7F; n >>>= 7; if (n) byte |= 0x80; b.push(byte); } while (n);
  return b;
}

function sleb128(n) {
  const b = [];
  let more = true;
  while (more) {
    let byte = n & 0x7F; n >>= 7;
    if ((n === 0 && !(byte & 0x40)) || (n === -1 && (byte & 0x40))) more = false;
    else byte |= 0x80;
    b.push(byte);
  }
  return b;
}

function f64le(v) { const b = Buffer.allocUnsafe(8); b.writeDoubleLE(v, 0); return [...b]; }
function i32le(v) { const b = Buffer.allocUnsafe(4); b.writeInt32LE(v, 0); return [...b]; }
function encStr(s) { const r = [...Buffer.from(s, 'utf8')]; return [...uleb128(r.length), ...r]; }
function section(id, content) { const b = content.flat(Infinity); return [id, ...uleb128(b.length), ...b]; }

// ── 타입 상수 ─────────────────────────────────────────────────────────────────
const I32 = 0x7F, F64 = 0x7C, VOID = 0x40;

// ── 내장 함수 (메모리 모드 시 자동 주입) ─────────────────────────────────────
// idx: __alloc=0 __arr_len=1 __arr_get=2 __arr_set=3 __arr_new=4
const BUILTIN_COUNT = 5;
const ALLOC_IDX = 0, ARR_LEN_IDX = 1, ARR_GET_IDX = 2, ARR_SET_IDX = 3, ARR_NEW_IDX = 4;

// (i32)->i32, (i32,i32)->i32, (i32,i32,i32)->i32
const BT_1I_I = [0x60, 0x01, I32, 0x01, I32];
const BT_2I_I = [0x60, 0x02, I32, I32, 0x01, I32];
const BT_3I_I = [0x60, 0x03, I32, I32, I32, 0x01, I32];

const BUILTIN_TYPES = [BT_1I_I, BT_1I_I, BT_2I_I, BT_3I_I, BT_2I_I];

// 각 내장 함수 코드 바이트 (locals 선언 포함)
const BUILTIN_CODE = [
  // __alloc(size)->i32: ptr=*mem[0]; *mem[0]=ptr+size; return ptr
  [0x01,0x01,I32, 0x41,0x00, 0x28,0x02,0x00, 0x21,0x01,
   0x41,0x00, 0x20,0x01, 0x20,0x00, 0x6A, 0x36,0x02,0x00, 0x20,0x01, 0x0B],
  // __arr_len(ptr)->i32: *ptr
  [0x00, 0x20,0x00, 0x28,0x02,0x00, 0x0B],
  // __arr_get(ptr,i)->i32: *(ptr+i*4+4)
  [0x00, 0x20,0x00, 0x20,0x01, 0x41,0x04, 0x6C, 0x6A, 0x28,0x02,0x04, 0x0B],
  // __arr_set(ptr,i,val)->i32: *(ptr+i*4+4)=val; return val
  [0x00, 0x20,0x00, 0x20,0x01, 0x41,0x04, 0x6C, 0x6A, 0x20,0x02, 0x36,0x02,0x04, 0x20,0x02, 0x0B],
  // __arr_new(len,init)->i32: alloc+fill
  [0x01,0x02,I32,
   0x20,0x00, 0x41,0x04, 0x6C, 0x41,0x04, 0x6A, 0x10,0x00, 0x21,0x02,  // ptr=alloc(4+len*4)
   0x20,0x02, 0x20,0x00, 0x36,0x02,0x00,                                 // *ptr=len
   0x41,0x00, 0x21,0x03,                                                  // i=0
   0x02,0x40, 0x03,0x40,                                                  // block loop
   0x20,0x03, 0x20,0x00, 0x4E, 0x0D,0x01,                               // if i>=len break
   0x20,0x02, 0x20,0x03, 0x41,0x04, 0x6C, 0x6A, 0x20,0x01, 0x36,0x02,0x04, // arr[i]=init
   0x20,0x03, 0x41,0x01, 0x6A, 0x21,0x03, 0x0C,0x00,                    // i++; continue
   0x0B, 0x0B,                                                            // end loop/block
   0x20,0x02, 0x0B]                                                        // return ptr
];

// ── 표현식 컴파일러 ───────────────────────────────────────────────────────────

function promoteToF64(c) {
  if (c.type === F64) return c;
  return { bytes: [...c.bytes, 0xB7], type: F64 }; // f64.convert_i32_s
}

function compileExpr(expr, params, pTypes, locals, fns, bofs) {
  const CE = e => compileExpr(e, params, pTypes, locals, fns, bofs);

  if (typeof expr === 'number') {
    if (Number.isInteger(expr) && expr >= -2147483648 && expr <= 2147483647)
      return { bytes: [0x41, ...sleb128(expr)], type: I32 };
    return { bytes: [0x44, ...f64le(expr)], type: F64 };
  }

  if (typeof expr === 'string') {
    for (let i = locals.length - 1; i >= 0; i--) {
      if (locals[i].name === expr)
        return { bytes: [0x20, ...uleb128(params.length + i)], type: locals[i].type };
    }
    const pi = params.indexOf(expr);
    if (pi >= 0) return { bytes: [0x20, ...uleb128(pi)], type: pTypes[pi] === 'f64' ? F64 : I32 };
    throw new Error(`Unknown variable: ${expr}`);
  }

  if (!Array.isArray(expr)) throw new Error(`Bad AST: ${JSON.stringify(expr)}`);
  const [op, ...args] = expr;

  // ── 특수 폼 ───────────────────────────────────────────────────────────────
  if (op === 'if') {
    const cC = CE(args[0]), tC = CE(args[1]);
    const eC = args[2] !== undefined ? CE(args[2]) : { bytes: [0x41, 0x00], type: I32 };
    let tB = tC.bytes, eB = eC.bytes, rt = tC.type;
    if (tC.type !== eC.type) {
      const tp = promoteToF64(tC), ep = promoteToF64(eC);
      tB = tp.bytes; eB = ep.bytes; rt = F64;
    }
    return { bytes: [...cC.bytes, 0x04, rt, ...tB, 0x05, ...eB, 0x0B], type: rt };
  }

  if (op === 'do') {
    if (!args.length) return { bytes: [0x41, 0x00], type: I32 };
    const b = [];
    for (let i = 0; i < args.length - 1; i++) {
      const c = CE(args[i]);
      b.push(...c.bytes);
      if (c.type !== 'void') b.push(0x1A); // drop
    }
    const last = CE(args[args.length - 1]);
    b.push(...last.bytes);
    return { bytes: b, type: last.type };
  }

  if (op === 'let') {
    const [bindings, body] = args;
    const b = [];
    for (const [name, val] of bindings) {
      const vC = CE(val);
      b.push(...vC.bytes, 0x21, ...uleb128(params.length + locals.length)); // local.set
      locals.push({ name, type: vC.type });
    }
    const bC = CE(body);
    b.push(...bC.bytes);
    return { bytes: b, type: bC.type };
  }

  if (op === 'set!') {
    const [name, val] = args;
    for (let i = locals.length - 1; i >= 0; i--) {
      if (locals[i].name === name) {
        const vC = CE(val);
        return { bytes: [...vC.bytes, 0x22, ...uleb128(params.length + i)], type: vC.type }; // local.tee
      }
    }
    throw new Error(`set! not found: ${name}`);
  }

  if (op === 'while') {
    const [cond, body] = args;
    const cC = CE(cond), bC = CE(body);
    const bBytes = bC.type !== 'void' ? [...bC.bytes, 0x1A] : bC.bytes;
    return {
      bytes: [0x02,VOID, 0x03,VOID,
              ...cC.bytes, 0x45, 0x0D,0x01,  // eqz + br_if break
              ...bBytes, 0x0C,0x00,           // body + br loop
              0x0B, 0x0B,                     // end loop/block
              0x41, 0x00],                    // return 0
      type: I32
    };
  }

  if (op === 'call') {
    const [name, ...cArgs] = args;
    const fi = fns.findIndex(f => f.name === name);
    if (fi < 0) throw new Error(`Unknown fn: ${name}`);
    const rt = fns[fi].returnType === 'f64' ? F64 : I32;
    return { bytes: [...cArgs.flatMap(a => CE(a).bytes), 0x10, ...uleb128(fi + bofs)], type: rt };
  }

  // ── 배열 (메모리) 연산 ────────────────────────────────────────────────────
  if (op === 'arr-new') {
    const [l, ini] = args;
    return { bytes: [...CE(l).bytes, ...CE(ini).bytes, 0x10, ARR_NEW_IDX], type: I32 };
  }
  if (op === 'arr-get') {
    const [p, i] = args;
    return { bytes: [...CE(p).bytes, ...CE(i).bytes, 0x10, ARR_GET_IDX], type: I32 };
  }
  if (op === 'arr-set') {
    const [p, i, v] = args;
    return { bytes: [...CE(p).bytes, ...CE(i).bytes, ...CE(v).bytes, 0x10, ARR_SET_IDX], type: I32 };
  }
  if (op === 'arr-len') {
    return { bytes: [...CE(args[0]).bytes, 0x10, ARR_LEN_IDX], type: I32 };
  }

  // ── 산술 / 비교 ──────────────────────────────────────────────────────────
  const i32map = {
    '+':0x6A,'-':0x6B,'*':0x6C,'/':0x6D,'%':0x6F,
    '==':0x46,'!=':0x47,'<':0x48,'>':0x4A,'<=':0x4C,'>=':0x4E,
    'and':0x71,'or':0x72,'xor':0x73,'<<':0x74,'>>':0x75
  };
  const f64map = { '+':0xA0,'-':0xA1,'*':0xA2,'/':0xA3 };
  const f64cmp = { '==':0x61,'!=':0x62,'<':0x63,'>':0x64,'<=':0x65,'>=':0x66 };
  const isCmp = s => ['==','!=','<','>','<=','>='].includes(s);

  if (op in i32map || op in f64map || op in f64cmp) {
    const cs = args.map(a => CE(a));
    if (cs.some(c => c.type === F64)) {
      const ps = cs.map(promoteToF64);
      const opc = f64map[op] ?? f64cmp[op];
      if (!opc) throw new Error(`f64 unsupported: ${op}`);
      return { bytes: [...ps.flatMap(c => c.bytes), opc], type: isCmp(op) ? I32 : F64 };
    }
    return { bytes: [...cs.flatMap(c => c.bytes), i32map[op]], type: I32 };
  }

  if (op === 'not')  return { bytes: [...CE(args[0]).bytes, 0x45], type: I32 };
  if (op === 'neg') {
    const c = CE(args[0]);
    return c.type === F64
      ? { bytes: [...c.bytes, 0x9A], type: F64 }
      : { bytes: [0x41,0x00,...c.bytes,0x6B], type: I32 };
  }
  if (op === 'abs') {
    const c = CE(args[0]);
    return c.type === F64
      ? { bytes: [...c.bytes, 0x99], type: F64 }
      : CE(['if',['>=',args[0],0],args[0],['neg',args[0]]]);
  }
  if (op === 'sqrt')  return { bytes: [...promoteToF64(CE(args[0])).bytes, 0x9F], type: F64 };
  if (op === 'floor') return { bytes: [...promoteToF64(CE(args[0])).bytes, 0x9C], type: F64 };
  if (op === 'ceil')  return { bytes: [...promoteToF64(CE(args[0])).bytes, 0x9D], type: F64 };
  if (op === 'min')   return CE(['if',['<=',args[0],args[1]],args[0],args[1]]);
  if (op === 'max')   return CE(['if',['>=',args[0],args[1]],args[0],args[1]]);
  if (op === 'to-int') {
    const c = CE(args[0]);
    return c.type === I32 ? c : { bytes: [...c.bytes, 0xAA], type: I32 }; // i32.trunc_f64_s
  }
  if (op === 'to-f64') return promoteToF64(CE(args[0]));

  throw new Error(`Unknown op: ${op}`);
}

// ── 함수 컴파일 ───────────────────────────────────────────────────────────────

function compileFn(fn, allFns, bofs) {
  const params = fn.params || [];
  const pTypes = fn.paramTypes || [];
  const locals = [];

  const bodyC = compileExpr(fn.body, params, pTypes, locals, allFns, bofs);

  // 선언 리턴 타입과 실제 타입 맞춤
  let retType = fn.returnType === 'f64' ? F64 : I32;
  let finalBytes = bodyC.bytes;
  if (retType === F64 && bodyC.type !== F64) finalBytes = [...promoteToF64(bodyC).bytes];
  else if (retType === I32 && bodyC.type === F64) finalBytes = [...bodyC.bytes, 0xAA]; // trunc

  const instrs = [...finalBytes, 0x0B]; // end

  // locals: 1개씩 선언 (순서 보장)
  const localVec = [...uleb128(locals.length), ...locals.flatMap(l => [0x01, l.type])];
  const codeBody = [...localVec, ...instrs];
  const codeEntry = [...uleb128(codeBody.length), ...codeBody];

  const typeEntry = [0x60,
    ...uleb128(params.length),
    ...pTypes.map(t => t === 'f64' ? F64 : I32).concat(Array(params.length - pTypes.length).fill(I32)),
    0x01, retType];

  return { name: fn.name, typeEntry, codeEntry };
}

// ── 모듈 빌드 ─────────────────────────────────────────────────────────────────

function buildModule(ast) {
  const fns = ast.fns || [];
  const mem = !!ast.memory;
  const bofs = mem ? BUILTIN_COUNT : 0;

  const magic = [0x00,0x61,0x73,0x6D,0x01,0x00,0x00,0x00];

  const compiled = fns.map(f => compileFn(f, fns, bofs));

  let types, fnIdx, codes, exps;

  if (mem) {
    types = [...BUILTIN_TYPES, ...compiled.map(f => f.typeEntry)];
    fnIdx = [...BUILTIN_TYPES.map((_,i)=>i), ...compiled.map((_,i)=>i+BUILTIN_COUNT)];
    codes = [...BUILTIN_CODE.map(b=>[...uleb128(b.length),...b]), ...compiled.map(f=>f.codeEntry)];
    // 함수 exports + memory export
    exps  = [
      ...compiled.map((f,i)=>[...encStr(f.name), 0x00, ...uleb128(i+BUILTIN_COUNT)]),
      [...encStr("memory"), 0x02, 0x00]  // memory export (kind=2, idx=0)
    ];
  } else {
    types = compiled.map(f => f.typeEntry);
    fnIdx = compiled.map((_,i)=>[i]);
    codes = compiled.map(f => f.codeEntry);
    exps  = compiled.map((f,i)=>[...encStr(f.name), 0x00, ...uleb128(i)]);
  }

  const typeSec   = section(0x01, [...uleb128(types.length), ...types.flat()]);
  const fnSec     = section(0x03, [...uleb128(fnIdx.length), ...fnIdx.flat().flatMap(i=>uleb128(i))]);
  const memSec    = mem ? section(0x05,[0x01,0x00,0x01]) : [];
  const exportSec = section(0x07, [...uleb128(exps.length), ...exps.flat()]);
  const codeSec   = section(0x0A, [...uleb128(codes.length), ...codes.flat()]);
  // data 섹션(0x0B)은 반드시 code 섹션(0x0A) 이후에 위치해야 함
  const dataSec   = mem ? section(0x0B,[0x01, 0x00, 0x41,0x00,0x0B, 0x04,...i32le(0x1000)]) : [];

  return Buffer.from([...magic,...typeSec,...fnSec,...memSec,...exportSec,...codeSec,...dataSec]);
}

// ── AST 변수 치환 (arr-reduce/arr-map 생성용) ──────────────────────────────────
function substVar(expr, from, to) {
  if (typeof expr === 'string') return expr === from ? to : expr;
  if (Array.isArray(expr)) return expr.map(e => substVar(e, from, to));
  return expr;
}

// ── FreeLang 배열 → WASM 메모리에 기록 후 포인터 반환 ─────────────────────────
function writeArr(mem32, arr, heapPtr) {
  const ptr = heapPtr;
  mem32[ptr >> 2] = arr.length;
  for (let i = 0; i < arr.length; i++) mem32[(ptr >> 2) + 1 + i] = arr[i];
  return { ptr, next: ptr + (1 + arr.length) * 4 };
}

// ── WASM 메모리에서 배열 읽기 ─────────────────────────────────────────────────
function readArr(mem32, ptr) {
  const len = mem32[ptr >> 2];
  const r = [];
  for (let i = 0; i < len; i++) r.push(mem32[(ptr >> 2) + 1 + i]);
  return r;
}

// ── 진입점 ────────────────────────────────────────────────────────────────────
const [,,mode,astFile,...rest] = process.argv;
function out(o) { process.stdout.write(JSON.stringify(o)); }

try {
  const fs = require('fs');
  const ast = JSON.parse(fs.readFileSync(astFile,'utf8'));

  if (mode === 'compile') {
    const b = buildModule(ast);
    out({ ok:true, wasm:b.toString('base64'), size:b.length });

  } else if (mode === 'run') {
    const b = buildModule(ast);
    const inst = new WebAssembly.Instance(new WebAssembly.Module(b));
    const fn = inst.exports[rest[0]];
    if (!fn) throw new Error(`No export: ${rest[0]}`);
    out({ ok:true, value: fn(...rest.slice(1).map(Number)) });

  } else if (mode === 'eval') {
    const { expr, params, paramTypes, args, memory } = ast;
    const w = { name:'__eval__', params:params||[], paramTypes, body:expr };
    const b = buildModule({ fns:[w], memory });
    const inst = new WebAssembly.Instance(new WebAssembly.Module(b));
    out({ ok:true, value: inst.exports.__eval__(...(args||[]).map(Number)) });

  } else if (mode === 'arr-reduce') {
    // {input_array, init, expr}  — expr uses "acc"(누적값) + "x"(현재원소)
    const { input_array, init = 0, expr } = ast;
    const xExpr = ['arr-get', 'arr_ptr', 'i'];
    const bodyExpr = substVar(expr, 'x', xExpr);
    const fn = {
      name: '__reduce__',
      params: ['init', 'arr_ptr'],
      body: ['let',
        [['acc', 'init'], ['i', 0], ['n', ['arr-len', 'arr_ptr']]],
        ['do',
          ['while', ['<', 'i', 'n'],
            ['do',
              ['set!', 'acc', bodyExpr],
              ['set!', 'i', ['+', 'i', 1]]]],
          'acc']]
    };
    const b = buildModule({ fns: [fn], memory: true });
    const inst = new WebAssembly.Instance(new WebAssembly.Module(b));
    const mem32 = new Int32Array(inst.exports.memory.buffer);
    const { ptr, next } = writeArr(mem32, input_array, 0x1000);
    mem32[0] = next; // heap ptr 갱신
    out({ ok: true, value: inst.exports.__reduce__(init, ptr) });

  } else if (mode === 'arr-map') {
    // {input_array, expr}  — expr uses "x"(원소) → 변환된 값
    const { input_array, expr } = ast;
    const xExpr = ['arr-get', 'in_ptr', 'i'];
    const bodyExpr = substVar(expr, 'x', xExpr);
    const fn = {
      name: '__map__',
      params: ['in_ptr'],
      body: ['let',
        [['n', ['arr-len', 'in_ptr']],
         ['out', ['arr-new', 'n', 0]],
         ['i', 0]],
        ['do',
          ['while', ['<', 'i', 'n'],
            ['do',
              ['arr-set', 'out', 'i', bodyExpr],
              ['set!', 'i', ['+', 'i', 1]]]],
          'out']]
    };
    const b = buildModule({ fns: [fn], memory: true });
    const inst = new WebAssembly.Instance(new WebAssembly.Module(b));
    const mem32 = new Int32Array(inst.exports.memory.buffer);
    const { ptr, next } = writeArr(mem32, input_array, 0x1000);
    mem32[0] = next;
    const outPtr = inst.exports.__map__(ptr);
    out({ ok: true, value: readArr(mem32, outPtr) });

  } else if (mode === 'arr-zip-map') {
    // {arr_a, arr_b, expr}  — expr uses "a" + "b" → 변환된 값
    const { arr_a, arr_b, expr } = ast;
    const aExpr = ['arr-get', 'ptr_a', 'i'];
    const bExpr = ['arr-get', 'ptr_b', 'i'];
    const bodyExpr = substVar(substVar(expr, 'a', aExpr), 'b', bExpr);
    const fn = {
      name: '__zipmap__',
      params: ['ptr_a', 'ptr_b'],
      body: ['let',
        [['n', ['arr-len', 'ptr_a']],
         ['out', ['arr-new', 'n', 0]],
         ['i', 0]],
        ['do',
          ['while', ['<', 'i', 'n'],
            ['do',
              ['arr-set', 'out', 'i', bodyExpr],
              ['set!', 'i', ['+', 'i', 1]]]],
          'out']]
    };
    const b = buildModule({ fns: [fn], memory: true });
    const inst = new WebAssembly.Instance(new WebAssembly.Module(b));
    const mem32 = new Int32Array(inst.exports.memory.buffer);
    const { ptr: pA, next: nA } = writeArr(mem32, arr_a, 0x1000);
    const { ptr: pB, next: nB } = writeArr(mem32, arr_b, nA);
    mem32[0] = nB;
    const outPtr = inst.exports.__zipmap__(pA, pB);
    out({ ok: true, value: readArr(mem32, outPtr) });
  }
} catch(e) {
  out({ ok:false, error:e.message });
}
