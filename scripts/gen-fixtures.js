#!/usr/bin/env node
// P00/10: self-diff 검증용 fixture 100+ 생성.
// lex / parse / eval 3 범주, 각 40 개. 실측 가능한 소규모 FL 스니펫.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LEX  = path.join(ROOT, "self/fixtures/lex");
const PARSE= path.join(ROOT, "self/fixtures/parse");
const EVAL = path.join(ROOT, "self/fixtures/eval");
for (const d of [LEX, PARSE, EVAL]) fs.mkdirSync(d, { recursive: true });

// ── LEX fixtures (토큰 단위) ──────────────────────────
const lex = [
  // 1-10: 기본 원자
  ['empty',        ''],
  ['single-num',   '42'],
  ['float',        '3.14'],
  ['negative',     '-7'],
  ['string',       '"hello"'],
  ['string-esc',   '"line1\\nline2"'],
  ['symbol',       'foo'],
  ['kebab-sym',    'hello-world?'],
  ['keyword',      ':name'],
  ['variable',     '$x'],
  // 11-20: 괄호/S-expression
  ['empty-list',   '()'],
  ['small-sexpr',  '(+ 1 2)'],
  ['nested',       '(+ (* 2 3) 4)'],
  ['array',        '[1 2 3]'],
  ['map',          '{:a 1 :b 2}'],
  ['deep-nest',    '(((1)))'],
  ['mixed',        '[(a) {:k 1}]'],
  ['spaces',       '  (  +   1   2  )  '],
  ['tabs-nl',      '(+\n\t1\n\t2)'],
  ['comment',      '; this is a comment\n(+ 1 2)'],
  // 21-30: 문자열 케이스
  ['empty-str',    '""'],
  ['str-quote',    '"he said \\"hi\\""'],
  ['str-tab',      '"a\\tb"'],
  ['unicode',      '"한글😀"'],
  ['long-num',     '1234567890'],
  ['zero',         '0'],
  ['leading-zero', '007'],
  ['neg-float',    '-3.14'],
  ['scientific',   '1.5e10'],
  ['hex',          '0xFF'],
  // 31-40: 특수 문법
  ['block',        '[FUNC add :params [$a $b] :body (+ $a $b)]'],
  ['route-like',   '[ROUTE :path "/users" :handler "h"]'],
  ['dollar-dot',   '$env.vars'],
  ['at-atom',      '@today'],
  ['true-false',   '(if true 1 false)'],
  ['null',         'null'],
  ['deep-array',   '[[[[1]]]]'],
  ['deep-map',     '{:a {:b {:c 1}}}'],
  ['many-args',    '(+ 1 2 3 4 5 6 7 8 9 10)'],
  ['pipe-op',      '(-> 1 inc double)'],
].filter(x => Array.isArray(x));

// ── PARSE fixtures (AST 구조) ─────────────────────────
const parse = [
  ['literal-num',  '42'],
  ['literal-str',  '"hello"'],
  ['sym',          'foo'],
  ['var',          '$x'],
  ['kw',           ':name'],
  ['sexpr',        '(+ 1 2)'],
  ['nested',       '(if (> $x 0) $x (- 0 $x))'],
  ['let-1d',       '(let [$x 5] $x)'],
  ['let-2d',       '(let [[$x 5] [$y 6]] (+ $x $y))'],
  ['let-bare',     '(let [x 5 y 6] (+ x y))'],
  ['fn',           '(fn [$x] (* $x 2))'],
  ['defn',         '(defn sq [$x] (* $x $x))'],
  ['define-val',   '(define $pi 3.14)'],
  ['define-fn',    '(define sq [$x] (* $x $x))'],
  ['cond',         '(cond [(< $x 0) "neg"] [true "pos"])'],
  ['do-begin',     '(do 1 2 3)'],
  ['quote',        '(quote (a b c))'],
  ['set-bang',     '(set! $x 10)'],
  ['array-lit',    '[1 2 3 4]'],
  ['map-lit',      '{:name "alice" :age 30}'],
  ['block-func',   '[FUNC add :params [$a $b] :body (+ $a $b)]'],
  ['nested-block', '[FUNC outer :body [FUNC inner :body 1]]'],
  ['str-interp',   '"count: {$n}"'],
  ['and-or',       '(or (and true false) true)'],
  ['try-catch',    '(try (risky) (catch $e (log $e)))'],
  ['loop-recur',   '(loop [[$i 0]] (if (< $i 10) (recur (+ $i 1)) $i))'],
  ['compose',      '(compose inc double)'],
  ['pipe',         '(|> 5 inc double)'],
  ['thread-first', '(-> 5 (+ 1) (* 2))'],
  ['thread-last',  '(->> [1 2 3] (map inc) (reduce +))'],
  ['match-simple', '(match $x [0 "zero"] [_ "other"])'],
  ['keyword-arg',  '(fn-call :a 1 :b 2)'],
  ['multi-body',   '(fn [$x] (println "hi") (* $x 2))'],
  ['nested-arr',   '[[1 2] [3 4]]'],
  ['nested-map',   '{:outer {:inner 1}}'],
  ['empty-fn',     '(fn [] 42)'],
  ['empty-list',   '()'],
  ['dotted',       '$ctx.user.id'],
  ['if-only',      '(if true 1)'],
  ['if-else',      '(if false 0 1)'],
];

// ── EVAL fixtures (실행 결과) ─────────────────────────
const evalFx = [
  ['add',          '(+ 1 2)'],
  ['mul-nested',   '(+ (* 2 3) 4)'],
  ['sub',          '(- 10 3)'],
  ['div',          '(/ 20 4)'],
  ['mod',          '(% 10 3)'],
  ['bool-true',    '(if true 1 2)'],
  ['bool-false',   '(if false 1 2)'],
  ['cmp-lt',       '(if (< 3 5) "yes" "no")'],
  ['cmp-eq',       '(if (= 5 5) 1 0)'],
  ['and-sc',       '(and true false true)'],
  ['or-sc',        '(or false true false)'],
  ['not',          '(not false)'],
  ['null-p',       '(null? null)'],
  ['let-use',      '(let [$x 5] (+ $x 10))'],
  ['let-flat',     '(let [$x 2 $y 3] (* $x $y))'],
  ['let-bare',     '(let [x 4 y 5] (+ x y))'],
  ['fn-apply',     '((fn [$x] (* $x 2)) 21)'],
  ['defn-call',    '(defn sq [$x] (* $x $x)) (sq 7)'],
  ['defn-bare',    '(defn double [x] (* x 2)) (double 9)'],
  ['define-var',   '(define $pi 3) (+ $pi 0)'],
  ['define-fn3',   '(define tri [$x] (* $x 3)) (tri 4)'],
  ['recursion',    '(defn fact [$n] (if (<= $n 1) 1 (* $n (fact (- $n 1))))) (fact 5)'],
  ['cond-first',   '(cond [(> 1 2) "a"] [(> 5 3) "b"] [true "c"])'],
  ['str-concat',   '(str "hello " "world")'],
  ['str-num',      '(str "count: " 5)'],
  ['list-first',   '(first (list 10 20 30))'],
  ['list-last',    '(last (list 10 20 30))'],
  ['list-len',     '(length (list 1 2 3 4 5))'],
  ['get-idx',      '(get (list 10 20 30) 1)'],
  ['get-key',      '(get {:a 1 :b 2} :a)'],
  ['map-hof',      '(map (fn [$x] (* $x 2)) (list 1 2 3))'],
  ['filter-hof',   '(filter (fn [$x] (> $x 2)) (list 1 2 3 4))'],
  ['reduce-hof',   '(reduce (fn [$a $b] (+ $a $b)) 0 (list 1 2 3 4))'],
  ['substring',    '(substring "hello" 1 4)'],
  ['replace',      '(replace "a-b-c" "-" "_")'],
  ['sqrt',         '(sqrt 16)'],
  ['pow',          '(pow 2 10)'],
  ['floor',        '(floor 3.7)'],
  ['closure',      '(define make-add (fn [$n] (fn [$x] (+ $x $n)))) ((make-add 10) 5)'],
  ['higher-order', '(define add1 (fn [$x] (+ $x 1))) (define mul2 (fn [$x] (* $x 2))) (mul2 (add1 3))'],
];

function write(dir, items) {
  let count = 0;
  for (const [name, code] of items) {
    const file = path.join(dir, `${name}.fl`);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, code + "\n", "utf8");
      count++;
    }
  }
  return count;
}

const lexN   = write(LEX, lex);
const parseN = write(PARSE, parse);
const evalN  = write(EVAL, evalFx);

console.log(`fixtures=generated lex=${lexN} parse=${parseN} eval=${evalN} total=${lexN + parseN + evalN}`);
