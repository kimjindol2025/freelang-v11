import { Interpreter } from './interpreter';
import { lex } from './lexer';
import { parse } from './parser';
import * as fs from 'fs';

const interp = new Interpreter();

interp.run(fs.readFileSync('./src/freelang-stdlib.fl', 'utf-8'));
interp.run(fs.readFileSync('./src/freelang-interpreter.fl', 'utf-8'));

function testFL(desc: string, flCode: string, expected: any) {
  try {
    const ast = parse(lex(flCode));
    interp.context.variables.set('$__ast__', ast);
    interp.run('(interpret $__ast__)');
    const result = interp.context.lastValue;
    const pass = JSON.stringify(result) === JSON.stringify(expected);
    console.log(`${pass ? 'PASS' : 'FAIL'}: ${desc}`);
    if (!pass) console.log(`  expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(result)}`);
    return pass;
  } catch (e: any) {
    console.log(`FAIL: ${desc}`);
    console.log(`  error: ${e.message}`);
    return false;
  }
}

let passed = 0, total = 0;
function t(desc: string, code: string, expected: any) {
  total++;
  if (testFL(desc, code, expected)) passed++;
}

// Phase SH-2: 클로저 + 재귀
t("익명함수 즉시호출(call 형식)", "(call (fn [$x] (* $x $x)) 5)", 25);
t("FUNC 팩토리얼", `
[FUNC fact :params [$n]
  :body (
    (if (<= $n 1) 1 (* $n (fact (- $n 1))))
  )
]
(fact 5)`, 120);
t("FUNC 피보나치 fib(10)", `
[FUNC fib :params [$n]
  :body (
    (if (<= $n 1) $n (+ (fib (- $n 1)) (fib (- $n 2))))
  )
]
(fib 10)`, 55);
t("FUNC 상호재귀 even?/odd?", `
[FUNC even? :params [$n]
  :body (
    (if (= $n 0) true (odd? (- $n 1)))
  )
]
[FUNC odd? :params [$n]
  :body (
    (if (= $n 0) false (even? (- $n 1)))
  )
]
(even? 10)`, true);
t("fn 클로저 캡처", `
[FUNC make-adder :params [$x]
  :body (
    (fn [$y] (+ $x $y))
  )
]
(let [[$add5 (make-adder 5)]]
  (call $add5 3)
)`, 8);
t("고차함수 map", `
[FUNC my-map :params [$f $lst $i $acc]
  :body (
    (if (>= $i (length $lst))
      $acc
      (my-map $f $lst (+ $i 1)
        (append $acc [(call $f [(get $lst $i)])]))
    )
  )
]
[FUNC sq :params [$n] :body ((* $n $n))]
(my-map sq [1 2 3 4 5] 0 [])`, [1, 4, 9, 16, 25]);

console.log(`\n결과: ${passed} / ${total} PASS`);
