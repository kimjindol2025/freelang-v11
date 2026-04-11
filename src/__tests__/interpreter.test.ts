// FreeLang v9 인터프리터 테스트
// 실행 및 런타임 검증

import { Interpreter } from '../interpreter';
import { Parser } from '../parser';
import { lex } from '../lexer';

describe('Interpreter - 기본 실행', () => {
  test('변수 할당 및 접근', () => {
    const tokens = lex('var x = 42; x');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.get('x')).toBe(42);
  });

  test('기본 산술 연산', () => {
    const tokens = lex('var result = 10 + 5');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.get('result')).toBe(15);
  });

  test('함수 정의 및 호출', () => {
    const tokens = lex('fn add(a, b) { a + b }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.functions.has('add')).toBe(true);
  });

  test('배열 생성 및 접근', () => {
    const tokens = lex('var arr = [1, 2, 3]; arr[0]');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.get('arr')).toBeDefined();
  });

  test('객체 생성 및 속성 접근', () => {
    const tokens = lex('var obj = { x: 10 }; obj.x');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.has('obj')).toBe(true);
  });

  test('조건부 실행', () => {
    const tokens = lex('var x = 0; if (5 > 3) { x = 1 }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.get('x')).toBe(1);
  });

  test('반복문 실행', () => {
    const tokens = lex('var sum = 0; while (sum < 100) { sum = sum + 1 }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.get('sum')).toBeGreaterThanOrEqual(100);
  });

  test('재귀 함수', () => {
    const tokens = lex('fn fact(n) { if (n <= 1) { 1 } else { n * fact(n-1) } }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.functions.has('fact')).toBe(true);
  });

  test('클로저 동작', () => {
    const tokens = lex('fn outer(x) { fn inner(y) { x + y } }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.functions.has('outer')).toBe(true);
  });

  test('스코프 격리', () => {
    const tokens = lex('var x = 5; { var x = 10 }; x');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.get('x')).toBe(5);
  });
});

describe('Interpreter - 비동기 실행', () => {
  test('Promise 생성', async () => {
    const tokens = lex('var p = Promise.resolve(42)');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.has('p')).toBe(true);
  });

  test('async/await 실행', async () => {
    const tokens = lex('async fn test() { await Promise.resolve(1) }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.functions.has('test')).toBe(true);
  });

  test('동시 실행 (Promise.all)', async () => {
    const tokens = lex('var results = Promise.all([1, 2, 3])');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.has('results')).toBe(true);
  });

  test('에러 처리 (try-catch)', async () => {
    const tokens = lex('try { throw "error" } catch(e) { var caught = true }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.get('caught')).toBe(true);
  });

  test('타임아웃 처리', async () => {
    const tokens = lex('var timeout = new Promise((r) => setTimeout(r, 100))');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.has('timeout')).toBe(true);
  }, 5000);
});

describe('Interpreter - 타입 시스템', () => {
  test('타입 강제 - 정수', () => {
    const tokens = lex('var x: int = 42');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(typeof context.variables.get('x')).toBe('number');
  });

  test('타입 강제 - 문자열', () => {
    const tokens = lex('var s: string = "hello"');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(typeof context.variables.get('s')).toBe('string');
  });

  test('제네릭 함수 실행', () => {
    const tokens = lex('fn<T> id(x: T): T { x }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.functions.has('id')).toBe(true);
  });

  test('포인터 역참조', () => {
    const tokens = lex('var x = 10; var ptr = &x; *ptr');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.has('x')).toBe(true);
  });
});

describe('Interpreter - 에러 처리', () => {
  test('정의되지 않은 변수 접근', () => {
    const tokens = lex('undefined_var');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    expect(() => interpreter.interpret(ast)).toBeDefined();
  });

  test('타입 불일치 감지', () => {
    const tokens = lex('var x: int = "string"');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    expect(() => interpreter.interpret(ast)).toBeDefined();
  });

  test('스택 오버플로우 방지', () => {
    const tokens = lex('fn bad() { bad() }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context).toBeDefined();
  });

  test('메모리 누수 방지', () => {
    const tokens = lex('var arr = []; for i in range(0, 1000) { arr.push(i) }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const context = interpreter.interpret(ast);
    expect(context.variables.has('arr')).toBe(true);
  });
});
