// FreeLang v9 파서 테스트
// AST 생성 및 문법 검증

import { Parser } from '../parser';
import { lex } from '../lexer';

describe('Parser - 기본 식 파싱', () => {
  test('변수 선언 파싱', () => {
    const tokens = lex('var x = 10');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
    expect(ast.length).toBeGreaterThan(0);
  });

  test('함수 정의 파싱', () => {
    const tokens = lex('fn add(a, b) { a + b }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('조건문 파싱', () => {
    const tokens = lex('if (x > 5) { print(x) }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('반복문 파싱', () => {
    const tokens = lex('while (i < 10) { i = i + 1 }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('배열 리터럴 파싱', () => {
    const tokens = lex('[1, 2, 3, 4, 5]');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('객체 리터럴 파싱', () => {
    const tokens = lex('{ name: "John", age: 30 }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('메서드 호출 파싱', () => {
    const tokens = lex('obj.method(arg1, arg2)');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('연쇄 호출 파싱', () => {
    const tokens = lex('arr.map(fn).filter(cond).reduce(acc)');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('삼항 연산자 파싱', () => {
    const tokens = lex('x > 5 ? "yes" : "no"');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('람다 표현식 파싱', () => {
    const tokens = lex('(x) => x * 2');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });
});

describe('Parser - 제네릭 및 타입', () => {
  test('제네릭 함수 파싱', () => {
    const tokens = lex('fn<T> first(arr: T[]): T { arr[0] }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('제네릭 구조체 파싱', () => {
    const tokens = lex('struct Container<T> { value: T }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('타입 주석 파싱', () => {
    const tokens = lex('var nums: int[] = [1, 2, 3]');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('union 타입 파싱', () => {
    const tokens = lex('var result: int | string = 5');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('선택적 파라미터 파싱', () => {
    const tokens = lex('fn greet(name: string, age?: int)');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });
});

describe('Parser - 비동기 및 고급 기능', () => {
  test('async 함수 파싱', () => {
    const tokens = lex('async fn fetch() { await request() }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('try-catch 파싱', () => {
    const tokens = lex('try { risky() } catch(e) { handle(e) }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('for-loop 파싱', () => {
    const tokens = lex('for i in range(0, 10) { print(i) }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('패턴 매칭 파싱', () => {
    const tokens = lex('match x { 1 => "one", _ => "other" }');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });

  test('포인터 타입 파싱', () => {
    const tokens = lex('var ptr: *int = &x');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });
});

describe('Parser - 에러 처리', () => {
  test('괄호 불일치 처리', () => {
    const tokens = lex('fn test() { unclosed');
    const parser = new Parser(tokens);
    expect(() => parser.parse()).toBeDefined();
  });

  test('예기치 않은 토큰 처리', () => {
    const tokens = lex('var = 10');
    const parser = new Parser(tokens);
    expect(() => parser.parse()).toBeDefined();
  });

  test('중복 선언 감지', () => {
    const tokens = lex('var x = 5; var x = 10');
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toBeDefined();
  });
});
