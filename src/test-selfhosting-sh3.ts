import { Interpreter } from './interpreter';
import { lex } from './lexer';
import { parse } from './parser';
import * as fs from 'fs';
import * as path from 'path';

const interp = new Interpreter();
interp.run(fs.readFileSync('./src/freelang-stdlib.fl', 'utf-8'));
interp.run(fs.readFileSync('./src/freelang-interpreter.fl', 'utf-8'));

let passed = 0, total = 0;

function t(desc: string, fn: () => { result: any; expected: any } | boolean) {
  total++;
  try {
    const r = fn();
    const ok = typeof r === 'boolean' ? r : JSON.stringify(r.result) === JSON.stringify(r.expected);
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${desc}`);
    if (!ok && typeof r !== 'boolean') console.log(`  expected: ${JSON.stringify(r.expected)}, got: ${JSON.stringify(r.result)}`);
    if (ok) passed++;
  } catch (e: any) {
    console.log(`FAIL: ${desc}\n  error: ${e.message?.slice(0,100)}`);
  }
}

// fl-parse 테스트
t("fl-parse: 소스 → AST 배열", () => {
  const ast = interp.run('(fl-parse "(+ 1 2)")').lastValue;
  return { result: Array.isArray(ast) && ast.length > 0, expected: true };
});

t("fl-parse + interpret: (+ 1 2) = 3", () => {
  interp.run('(set! $__r__ (interpret (fl-parse "(+ 1 2)")))');
  return { result: interp.context.variables.get('$__r__'), expected: 3 };
});

t("fl-parse + interpret: 재귀 fib(6)", () => {
  const code = `[FUNC fib :params [$n]
  :body (if (<= $n 1) $n (+ (fib (- $n 1)) (fib (- $n 2))))]
(fib 6)`;
  interp.run(`(set! $__r__ (interpret (fl-parse ${JSON.stringify(code)})))`);
  return { result: interp.context.variables.get('$__r__'), expected: 8 };
});

// interpret-file 테스트
t("interpret-file: simple-test.fl 읽기", () => {
  const exists = fs.existsSync('./examples/simple-test.fl');
  return { result: exists, expected: true };
});

t("interpret-file: simple-test.fl 실행", () => {
  interp.run('(interpret-file "examples/simple-test.fl")');
  return true; // println으로 출력, 에러 없으면 통과
});

t("file_read 직접 사용", () => {
  const src = interp.run('(file_read "examples/simple-test.fl")').lastValue;
  return { result: typeof src === 'string' && src.includes('[FUNC double'), expected: true };
});

console.log(`\n결과: ${passed} / ${total} PASS`);
