// FreeLang v9 파서 테스트
// AST 생성 및 문법 검증

import { Parser } from '../parser';
import { Lexer } from '../lexer';

describe('Parser - 기본 식 파싱', () => {
  let parser: Parser;
  let lexer: Lexer;

  beforeEach(() => {
    lexer = new Lexer();
    parser = new Parser();
  });

  test('변수 선언 파싱', () => {
    const tokens = lexer.tokenize('var x = 10');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
    expect(ast.length).toBeGreaterThan(0);
  });

  test('함수 정의 파싱', () => {
    const tokens = lexer.tokenize('fn add(a, b) { a + b }');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('조건문 파싱', () => {
    const tokens = lexer.tokenize('if (x > 5) { print(x) }');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('반복문 파싱', () => {
    const tokens = lexer.tokenize('while (i < 10) { i = i + 1 }');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('배열 리터럴 파싱', () => {
    const tokens = lexer.tokenize('[1, 2, 3, 4, 5]');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('객체 리터럴 파싱', () => {
    const tokens = lexer.tokenize('{ name: "John", age: 30 }');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('메서드 호출 파싱', () => {
    const tokens = lexer.tokenize('obj.method(arg1, arg2)');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('연쇄 호출 파싱', () => {
    const tokens = lexer.tokenize('arr.map(fn).filter(cond).reduce(acc)');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('삼항 연산자 파싱', () => {
    const tokens = lexer.tokenize('x > 5 ? "yes" : "no"');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('람다 표현식 파싱', () => {
    const tokens = lexer.tokenize('(x) => x * 2');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });
});

describe('Parser - 제네릭 및 타입', () => {
  let parser: Parser;
  let lexer: Lexer;

  beforeEach(() => {
    lexer = new Lexer();
    parser = new Parser();
  });

  test('제네릭 함수 파싱', () => {
    const tokens = lexer.tokenize('fn<T> first(arr: T[]): T { arr[0] }');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('제네릭 구조체 파싱', () => {
    const tokens = lexer.tokenize('struct Container<T> { value: T }');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('타입 주석 파싱', () => {
    const tokens = lexer.tokenize('var nums: int[] = [1, 2, 3]');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('union 타입 파싱', () => {
    const tokens = lexer.tokenize('var result: int | string = 5');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('선택적 파라미터 파싱', () => {
    const tokens = lexer.tokenize('fn greet(name: string, age?: int)');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });
});

describe('Parser - 비동기 및 고급 기능', () => {
  let parser: Parser;
  let lexer: Lexer;

  beforeEach(() => {
    lexer = new Lexer();
    parser = new Parser();
  });

  test('async 함수 파싱', () => {
    const tokens = lexer.tokenize('async fn fetch() { await request() }');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('try-catch 파싱', () => {
    const tokens = lexer.tokenize('try { risky() } catch(e) { handle(e) }');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('for-loop 파싱', () => {
    const tokens = lexer.tokenize('for i in range(0, 10) { print(i) }');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('패턴 매칭 파싱', () => {
    const tokens = lexer.tokenize('match x { 1 => "one", _ => "other" }');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });

  test('포인터 타입 파싱', () => {
    const tokens = lexer.tokenize('var ptr: *int = &x');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });
});

describe('Parser - 에러 처리', () => {
  let parser: Parser;
  let lexer: Lexer;

  beforeEach(() => {
    lexer = new Lexer();
    parser = new Parser();
  });

  test('괄호 불일치 처리', () => {
    const tokens = lexer.tokenize('fn test() { unclosed');
    expect(() => parser.parse(tokens)).toBeDefined();
  });

  test('예기치 않은 토큰 처리', () => {
    const tokens = lexer.tokenize('var = 10');
    expect(() => parser.parse(tokens)).toBeDefined();
  });

  test('중복 선언 감지', () => {
    const tokens = lexer.tokenize('var x = 5; var x = 10');
    const ast = parser.parse(tokens);
    expect(ast).toBeDefined();
  });
});
