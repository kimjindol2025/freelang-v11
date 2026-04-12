/**
 * FreeLang-LLM Runtime
 * FL v9 → JS 컴파일 + 네이티브 텐서 연산
 *
 * 네이티브 함수 (FL에서 호출 가능):
 *   (native-matmul A-flat B-flat M K N) → flat
 *   (native-softmax v-flat) → flat
 *   (native-exp v-flat) → flat
 *   (native-log v-flat) → flat
 *   (native-sqrt x) → number
 *   (native-randn n scale) → flat Float32Array as array
 *   (native-zeros n) → flat
 */

import * as vm from "vm";
import * as fs from "fs";
import * as path from "path";
import { Interpreter } from "./src/interpreter";
import { lex } from "./src/lexer";
import { parse } from "./src/parser";

const srcDir  = path.join(__dirname, "src");
const rootDir = __dirname;

// ─── FL 소스 로드 ───────────────────────────────────────────
function loadFL(filename: string): string {
  return fs.readFileSync(path.join(rootDir, filename), "utf-8");
}

const entryFile = process.argv[2] || "fl-train.fl";
console.log(`\n🔨 FreeLang-LLM: ${entryFile} 컴파일 중...`);

// v9 컴파일러 부트스트랩
const lexerSrc   = fs.readFileSync(path.join(srcDir, "freelang-lexer.fl"),   "utf-8");
const parserSrc  = fs.readFileSync(path.join(srcDir, "freelang-parser.fl"),  "utf-8");
const codegenSrc = fs.readFileSync(path.join(srcDir, "freelang-codegen.fl"), "utf-8");

const interp = new Interpreter();
for (const src of [lexerSrc, parserSrc, codegenSrc]) {
  interp.interpret(parse(lex(src)));
}

// LLM 라이브러리 파일 + 엔트리 합산 컴파일
const llmLibFiles = ["fl-tensor.fl", "fl-nn.fl", "fl-llm.fl"];
const allLibSrc = llmLibFiles.map(f => loadFL(f)).join("\n");
const entrySrc  = loadFL(entryFile);
const combined  = allLibSrc + "\n" + entrySrc;

const escaped = JSON.stringify(combined);
interp.interpret(parse(lex(`(gen-js (parse (lex ${escaped})))`)));
const jsCode = interp.context.lastValue as string;

if (typeof jsCode !== "string") {
  console.error("❌ 컴파일 실패");
  process.exit(1);
}
console.log(`✅ JS 컴파일 완료 (${jsCode.length} chars)\n`);
// 디버그용 JS 저장
fs.writeFileSync("/tmp/fl-llm-debug.js", jsCode, "utf-8");

// ─── 네이티브 텐서 함수 ─────────────────────────────────────

/** flat array 행렬곱: A[M×K] × B[K×N] = C[M×N] */
function nativeMatmul(A: number[], B: number[], M: number, K: number, N: number): number[] {
  const C = new Array(M * N).fill(0);
  for (let i = 0; i < M; i++) {
    for (let k = 0; k < K; k++) {
      const a = A[i * K + k];
      if (a === 0) continue;
      for (let j = 0; j < N; j++) {
        C[i * N + j] += a * B[k * N + j];
      }
    }
  }
  return C;
}

/** softmax over flat vector */
function nativeSoftmax(v: number[]): number[] {
  const max = Math.max(...v);
  const exp = v.map(x => Math.exp(x - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map(x => x / sum);
}

/** softmax over rows of matrix [M×N] → [M×N] */
function nativeSoftmaxRows(v: number[], M: number, N: number): number[] {
  const out = new Array(M * N);
  for (let i = 0; i < M; i++) {
    const row = v.slice(i * N, (i + 1) * N);
    const sm  = nativeSoftmax(row);
    for (let j = 0; j < N; j++) out[i * N + j] = sm[j];
  }
  return out;
}

/** element-wise exp */
function nativeExp(v: number[]): number[] {
  return v.map(x => Math.exp(x));
}

/** element-wise log */
function nativeLog(v: number[]): number[] {
  return v.map(x => Math.log(Math.max(x, 1e-10)));
}

/** randn: 정규분포 난수 (Box-Muller) */
function nativeRandn(n: number, scale: number): number[] {
  const out = [];
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.random() || 1e-10;
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
    out.push(z0 * scale);
    if (i + 1 < n) out.push(z1 * scale);
  }
  return out;
}

/** gradient of matmul: dA = dC @ B^T, dB = A^T @ dC — returns [dA, dB] */
function nativeMatmulGrad(
  A: number[], B: number[], dC: number[],
  M: number, K: number, N: number
): [number[], number[]] {
  // dA[M×K] = dC[M×N] @ B^T[N×K]
  const dA = nativeMatmul(dC, transposeFlat(B, K, N), M, N, K);
  // dB[K×N] = A^T[K×M] @ dC[M×N]
  const dB = nativeMatmul(transposeFlat(A, M, K), dC, K, M, N);
  return [dA, dB];
}

function transposeFlat(A: number[], rows: number, cols: number): number[] {
  const out = new Array(rows * cols);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      out[j * rows + i] = A[i * cols + j];
  return out;
}

/** cross-entropy loss + gradient — returns [loss, dlogits] array for FL */
function nativeCrossEntropy(
  logits: number[], targets: number[], B: number, V: number
): [number, number[]] {
  const dlogits = new Array(B * V).fill(0);
  let loss = 0;
  for (let b = 0; b < B; b++) {
    const row = logits.slice(b * V, (b + 1) * V);
    const probs = nativeSoftmax(row);
    const t = targets[b];
    loss -= Math.log(Math.max(probs[t], 1e-10));
    for (let v = 0; v < V; v++) {
      dlogits[b * V + v] = probs[v] - (v === t ? 1 : 0);
    }
  }
  loss /= B;
  for (let i = 0; i < dlogits.length; i++) dlogits[i] /= B;
  return [loss, dlogits];
}

// ─── JS 실행 샌드박스 ────────────────────────────────────────
const sandbox: Record<string, any> = {
  console,
  Math,
  Date,
  JSON,
  process,
  setTimeout,
  clearTimeout,
  module: { exports: {} },
  require: (m: string) => {
    if (m === "fs") return fs;
    if (m === "path") return path;
    return {};
  },

  // FreeLang 기본 런타임
  list:    (...args: any[]) => [...args],
  str:     (...args: any[]) => args.map(String).join(""),
  println: (...args: any[]) => console.log(...args),
  print:   (...args: any[]) => process.stdout.write(args.map(String).join("")),
  append:  (arr: any, ...rest: any[]) => {
    if (Array.isArray(arr)) {
      return rest.length === 1 && Array.isArray(rest[0])
        ? [...arr, ...rest[0]] : [...arr, ...rest];
    }
    return [arr, ...rest];
  },
  length:  (a: any) => Array.isArray(a) ? a.length : String(a).length,
  get:     (arr: any[], i: number) => arr[i],
  set:     (arr: any[], i: number, v: any) => { const a = [...arr]; a[i] = v; return a; },
  slice:   (arr: any[], s: number, e?: number) => arr.slice(s, e),
  concat:  (...arrs: any[][]) => ([] as any[]).concat(...arrs),
  map:     (arr: any[], fn: Function) => arr.map((x: any, i: number) => fn(x, i)),
  filter:  (arr: any[], fn: Function) => arr.filter((x: any) => fn(x)),
  reduce:  (arr: any[], fn: Function, init: any) => arr.reduce((a, b) => fn(a, b), init),
  range:   (n: number) => Array.from({ length: n }, (_, i) => i),
  zip:     (a: any[], b: any[]) => a.map((x, i) => [x, b[i]]),

  // 네이티브 텐서 연산 (하이픈 및 언더스코어 모두 지원)
  "native-matmul":       nativeMatmul,
  "native-softmax":      nativeSoftmax,
  "native-softmax-rows": nativeSoftmaxRows,
  "native-exp":          nativeExp,
  "native-log":          nativeLog,
  "native-randn":        nativeRandn,
  "native-zeros":        (n: number) => new Array(n).fill(0),
  "native-ones":         (n: number) => new Array(n).fill(1),
  "native-transpose":    transposeFlat,
  "native-matmul-grad":  nativeMatmulGrad,
  "native-cross-entropy": nativeCrossEntropy,
  "native-sqrt":         Math.sqrt,
  "native-abs":          Math.abs,

  // 문자열 유틸
  "char-code": (s: string, i: number) => s.charCodeAt(i),
  "random":    () => Math.random(),

  // 파일 I/O
  "read-file":  (p: string) => fs.readFileSync(p, "utf-8"),
  "write-file": (p: string, d: string) => fs.writeFileSync(p, d, "utf-8"),
  "file-exists": (p: string) => fs.existsSync(p),
};

// JS 언더스코어 버전 (codegen 변환 후) — Object.assign으로 추가
Object.assign(sandbox, {
  // recur2: 중첩 루프 TCO 마커
  recur2: (x: any) => ({ __FL_TCO__: true, __args: [x] }),
  native_matmul:       nativeMatmul,
  native_softmax:      nativeSoftmax,
  native_softmax_rows: nativeSoftmaxRows,
  native_exp:          nativeExp,
  native_log:          nativeLog,
  native_randn:        nativeRandn,
  native_zeros:        (n: number) => new Array(n).fill(0),
  native_ones:         (n: number) => new Array(n).fill(1),
  native_transpose:    transposeFlat,
  native_matmul_grad:  nativeMatmulGrad,
  native_cross_entropy: nativeCrossEntropy,
  native_sqrt:         Math.sqrt,
  native_abs:          Math.abs,
  char_code:           (s: string, i: number) => s.charCodeAt(i),
  random:              () => Math.random(),
  read_file:           (p: string) => fs.readFileSync(p, "utf-8"),
  write_file:          (p: string, d: string) => fs.writeFileSync(p, d, "utf-8"),
  file_exists:         (p: string) => fs.existsSync(p),
});

vm.createContext(sandbox);

// 디버그: strict mode 예약어 오류 위치 찾기
function findReservedWordError(code: string): void {
  const lines = code.split("\n");
  const reserved = ["let", "const", "class", "static", "implements", "interface", "package", "private", "protected", "public", "yield", "delete", "import", "export"];
  for (let i = 0; i < lines.length; i++) {
    for (const kw of reserved) {
      const re = new RegExp(`\\b${kw}\\s*=`, "g");
      if (re.test(lines[i])) {
        console.error(`  L${i+1}: ${lines[i].trim()}`);
      }
    }
  }
}

try {
  vm.runInContext(jsCode, sandbox, { timeout: 3600000 }); // 1시간
} catch (e: any) {
  console.error("\n❌ 실행 오류:", e.message);
  if (e.message?.includes("strict mode")) {
    console.error("예약어 변수 후보:");
    findReservedWordError(jsCode);
    // 처음 500자 출력
    console.error("\nJS 코드 시작:\n" + jsCode.slice(0, 500));
  }
  process.exit(1);
}
