// FreeLang v9: Phase 27 — 표준 라이브러리 Codegen 완성도
// TS 인터프리터가 지원하는 모든 builtin → JS 컴파일 검증
// 목표: 컴파일된 JS가 TS 런타임 없이 standalone 실행 가능

import * as vm from "vm";
import * as fs from "fs";
import * as path from "path";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

const flSrcDir = path.join(__dirname, "..", "src");
const lexerSrc   = fs.readFileSync(path.join(flSrcDir, "freelang-lexer.fl"),  "utf-8");
const parserSrc  = fs.readFileSync(path.join(flSrcDir, "freelang-parser.fl"), "utf-8");
const codegenSrc = fs.readFileSync(path.join(flSrcDir, "freelang-codegen.fl"), "utf-8");

function compileAndRun(flSrc: string): any {
  const interp = new Interpreter();
  for (const src of [lexerSrc, parserSrc, codegenSrc]) {
    interp.interpret(parse(lex(src)));
  }
  interp.interpret(parse(lex(`(gen-js (parse (lex ${JSON.stringify(flSrc)})))`)));
  const jsCode = interp.context.lastValue as string;
  if (typeof jsCode !== "string") throw new Error(`codegen returned ${typeof jsCode}`);
  const sandbox: Record<string, any> = { module: { exports: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox);
  return sandbox.module.exports;
}

// ─── [15] 배열 조작 builtins ──────────────────────────────────────
console.log("\n[15] 배열 조작 builtins");

test("first: 첫 번째 원소", () => {
  const exp = compileAndRun(`
[FUNC head :params [$lst] :body ((first $lst))]
(export head)
  `.trim());
  if (exp.head([10, 20, 30]) !== 10) throw new Error(`got ${exp.head([10,20,30])}`);
});

test("rest: 나머지 원소", () => {
  const exp = compileAndRun(`
[FUNC tail :params [$lst] :body ((rest $lst))]
(export tail)
  `.trim());
  const r = exp.tail([1, 2, 3, 4]);
  if (r.join(",") !== "2,3,4") throw new Error(`got ${r}`);
});

test("last: 마지막 원소", () => {
  const exp = compileAndRun(`
[FUNC final :params [$lst] :body ((last $lst))]
(export final)
  `.trim());
  if (exp.final([1, 2, 3, 99]) !== 99) throw new Error(`got ${exp.final([1,2,3,99])}`);
});

test("reverse: 배열 뒤집기", () => {
  const exp = compileAndRun(`
[FUNC flip :params [$lst] :body ((reverse $lst))]
(export flip)
  `.trim());
  const r = exp.flip([1, 2, 3]);
  if (r.join(",") !== "3,2,1") throw new Error(`got ${r}`);
});

test("find: 조건 만족 첫 원소", () => {
  const exp = compileAndRun(`
[FUNC find-positive :params [$lst]
  :body ((find $lst [x] (> $x 0)))
]
(export find-positive)
  `.trim());
  if (exp["find-positive"]([-3, -1, 4, 6]) !== 4) throw new Error(`got ${exp["find-positive"]([-3,-1,4,6])}`);
});

test("sort: 문자열 정렬", () => {
  const exp = compileAndRun(`
[FUNC alpha-sort :params [$lst] :body ((sort $lst))]
(export alpha-sort)
  `.trim());
  const r = exp["alpha-sort"](["banana", "apple", "cherry"]);
  if (r.join(",") !== "apple,banana,cherry") throw new Error(`got ${r}`);
});

test("unique: 중복 제거", () => {
  const exp = compileAndRun(`
[FUNC dedup :params [$lst] :body ((unique $lst))]
(export dedup)
  `.trim());
  const r = exp.dedup([1, 2, 2, 3, 1, 4]);
  if (r.length !== 4) throw new Error(`got ${r}`);
});

test("flatten: 중첩 배열 평탄화", () => {
  const exp = compileAndRun(`
[FUNC flat1 :params [$lst] :body ((flatten $lst))]
(export flat1)
  `.trim());
  const r = exp.flat1([[1, 2], [3, 4], [5]]);
  if (r.join(",") !== "1,2,3,4,5") throw new Error(`got ${r}`);
});

test("push: 원소 추가 (불변)", () => {
  const exp = compileAndRun(`
[FUNC add-item :params [$lst $item] :body ((push $lst $item))]
(export add-item)
  `.trim());
  const r = exp["add-item"]([1, 2, 3], 4);
  if (r.join(",") !== "1,2,3,4") throw new Error(`got ${r}`);
});

// ─── [16] 문자열 builtins ─────────────────────────────────────────
console.log("\n[16] 문자열 builtins");

test("char-at: 특정 인덱스 문자", () => {
  const exp = compileAndRun(`
[FUNC nth-char :params [$s $n] :body ((char-at $s $n))]
(export nth-char)
  `.trim());
  if (exp["nth-char"]("hello", 1) !== "e") throw new Error(`got ${exp["nth-char"]("hello",1)}`);
});

test("substring: 부분 문자열", () => {
  const exp = compileAndRun(`
[FUNC sub :params [$s $a $b] :body ((substring $s $a $b))]
(export sub)
  `.trim());
  if (exp.sub("hello world", 6, 11) !== "world") throw new Error(`got ${exp.sub("hello world",6,11)}`);
});

test("starts-with?: 접두사 확인", () => {
  const exp = compileAndRun(`
[FUNC starts? :params [$s $p] :body ((starts-with? $s $p))]
(export starts?)
  `.trim());
  if (exp["starts?"]("hello", "hel") !== true) throw new Error("starts-with? failed");
  if (exp["starts?"]("hello", "xyz") !== false) throw new Error("starts-with? false failed");
});

test("ends-with?: 접미사 확인", () => {
  const exp = compileAndRun(`
[FUNC ends? :params [$s $p] :body ((ends-with? $s $p))]
(export ends?)
  `.trim());
  if (exp["ends?"]("hello", "llo") !== true) throw new Error("ends-with? failed");
});

test("index-of: 첫 번째 위치", () => {
  const exp = compileAndRun(`
[FUNC find-idx :params [$s $sub] :body ((index-of $s $sub))]
(export find-idx)
  `.trim());
  if (exp["find-idx"]("hello world", "world") !== 6) throw new Error(`got ${exp["find-idx"]("hello world","world")}`);
  if (exp["find-idx"]("hello", "xyz") !== -1) throw new Error("not found case failed");
});

test("split: 구분자로 분리", () => {
  const exp = compileAndRun(`
[FUNC tokenize :params [$s $sep] :body ((split $s $sep))]
(export tokenize)
  `.trim());
  const r = exp.tokenize("a,b,c,d", ",");
  if (r.join("|") !== "a|b|c|d") throw new Error(`got ${r}`);
});

// ─── [17] 수학 builtins ───────────────────────────────────────────
console.log("\n[17] 수학 builtins");

test("sqrt: 제곱근", () => {
  const exp = compileAndRun(`
[FUNC sq :params [$n] :body ((sqrt $n))]
(export sq)
  `.trim());
  if (Math.abs(exp.sq(9) - 3) > 0.001) throw new Error(`got ${exp.sq(9)}`);
  if (Math.abs(exp.sq(2) - 1.414) > 0.001) throw new Error(`got ${exp.sq(2)}`);
});

test("pow: 거듭제곱", () => {
  const exp = compileAndRun(`
[FUNC power :params [$base $exp] :body ((pow $base $exp))]
(export power)
  `.trim());
  if (exp.power(2, 10) !== 1024) throw new Error(`got ${exp.power(2,10)}`);
  if (exp.power(3, 3) !== 27) throw new Error(`got ${exp.power(3,3)}`);
});

// ─── [18] 타입 조건자 ─────────────────────────────────────────────
console.log("\n[18] 타입 조건자");

test("string?: 문자열 판별", () => {
  const exp = compileAndRun(`
[FUNC str? :params [$x] :body ((string? $x))]
(export str?)
  `.trim());
  if (exp["str?"]("hello") !== true) throw new Error("string? true failed");
  if (exp["str?"](42) !== false) throw new Error("string? false failed");
});

test("number?: 숫자 판별", () => {
  const exp = compileAndRun(`
[FUNC num? :params [$x] :body ((number? $x))]
(export num?)
  `.trim());
  if (exp["num?"](42) !== true) throw new Error("number? true failed");
  if (exp["num?"]("42") !== false) throw new Error("number? false failed");
});

test("array?: 배열 판별", () => {
  const exp = compileAndRun(`
[FUNC arr? :params [$x] :body ((array? $x))]
(export arr?)
  `.trim());
  if (exp["arr?"]([1, 2, 3]) !== true) throw new Error("array? true failed");
  if (exp["arr?"]("hello") !== false) throw new Error("array? false failed");
});

test("map?: 맵 판별", () => {
  const exp = compileAndRun(`
[FUNC obj? :params [$x] :body ((map? $x))]
(export obj?)
  `.trim());
  if (exp["obj?"]({ a: 1 }) !== true) throw new Error("map? true failed");
  if (exp["obj?"]([1, 2]) !== false) throw new Error("map? false (array) failed");
});

// ─── [19] 복합 실용 예제 ─────────────────────────────────────────
console.log("\n[19] 복합 실용 예제");

test("숫자 정렬 (sort + map)", () => {
  const exp = compileAndRun(`
[FUNC sort-nums :params [$lst]
  :body (
    (sort $lst (fn [$a $b] (- $a $b)))
  )
]
(export sort-nums)
  `.trim());
  const r = exp["sort-nums"]([5, 3, 1, 4, 2]);
  if (r.join(",") !== "1,2,3,4,5") throw new Error(`got ${r}`);
});

test("팰린드롬 검사", () => {
  const exp = compileAndRun(`
[FUNC palindrome? :params [$s]
  :body (
    (let [[rev (str-join (reverse (split $s "")) "")]]
      (= $s $rev)
    )
  )
]
(export palindrome?)
  `.trim());
  if (exp["palindrome?"]("racecar") !== true) throw new Error("racecar not palindrome");
  if (exp["palindrome?"]("hello") !== false) throw new Error("hello palindrome?");
});

test("단어 빈도 계산", () => {
  const exp = compileAndRun(`
[FUNC word-freq :params [$words]
  :body (
    (reduce $words {} [acc word]
      (assoc $acc $word
        (if (null? (get $acc $word))
          1
          (+ (get $acc $word) 1)
        )
      )
    )
  )
]
(export word-freq)
  `.trim());
  const freq = exp["word-freq"](["a", "b", "a", "c", "b", "a"]);
  if (freq.a !== 3 || freq.b !== 2 || freq.c !== 1) throw new Error(`got ${JSON.stringify(freq)}`);
});

test("깊이 우선 탐색 (트리)", () => {
  const exp = compileAndRun(`
[FUNC tree-sum :params [$node]
  :body (
    (if (null? $node)
      0
      (+ (get $node :val)
         (+ (tree-sum (get $node :left))
            (tree-sum (get $node :right))))
    )
  )
]
(export tree-sum)
  `.trim());
  // tree: {val:1, left:{val:2, left:null, right:null}, right:{val:3, left:null, right:null}}
  const tree = { val: 1, left: { val: 2, left: null, right: null }, right: { val: 3, left: null, right: null } };
  if (exp["tree-sum"](tree) !== 6) throw new Error(`got ${exp["tree-sum"](tree)}`);
});

test("json_keys: 객체 키 순회", () => {
  const exp = compileAndRun(`
[FUNC obj-keys :params [$m] :body ((sort (json_keys $m)))]
(export obj-keys)
  `.trim());
  const keys = exp["obj-keys"]({ c: 3, a: 1, b: 2 });
  if (keys.join(",") !== "a,b,c") throw new Error(`got ${keys}`);
});

// ─── 결과 ─────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 27 stdlib codegen: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
