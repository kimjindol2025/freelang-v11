// FreeLang v9 렉서 테스트
// lex(source) → Token[] 검증

import { lex } from '../lexer';
import { Token, TokenType } from '../token';

describe('Lexer - 기본 토큰화', () => {
  test('식별자 인식', () => {
    const tokens = lex('hello world');
    expect(tokens.find(t => t.value === 'hello')).toBeDefined();
    expect(tokens.find(t => t.value === 'world')).toBeDefined();
  });

  test('숫자 리터럴', () => {
    const tokens = lex('123 45.67');
    expect(tokens.some(t => t.type === TokenType.Number && t.value === '123')).toBe(true);
    expect(tokens.some(t => t.type === TokenType.Number && t.value === '45.67')).toBe(true);
  });

  test('문자열 리터럴 (큰따옴표)', () => {
    const tokens = lex('"hello"');
    expect(tokens.some(t => t.type === TokenType.String)).toBe(true);
  });

  test('$변수 식별자', () => {
    const tokens = lex('$name $age');
    // 렉서는 $를 제거하고 Variable 타입으로 저장
    expect(tokens.some(t => t.type === TokenType.Variable && t.value === 'name')).toBe(true);
    expect(tokens.some(t => t.type === TokenType.Variable && t.value === 'age')).toBe(true);
  });

  test('괄호 인식', () => {
    const tokens = lex('()[]');
    expect(tokens.some(t => t.type === TokenType.LParen)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.RParen)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.LBracket)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.RBracket)).toBe(true);
  });

  test('세미콜론 주석 무시', () => {
    const tokens = lex('hello ; this is a comment\nworld');
    expect(tokens.some(t => t.value === 'hello')).toBe(true);
    expect(tokens.some(t => t.value === 'world')).toBe(true);
    expect(tokens.every(t => t.value !== 'this')).toBe(true);
  });

  test('빈 입력', () => {
    const tokens = lex('');
    expect(Array.isArray(tokens)).toBe(true);
  });

  test('공백 처리', () => {
    const tokens = lex('  hello   world  ');
    expect(tokens.filter(t => t.type !== TokenType.EOF).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Lexer - FreeLang v9 S-Expression 문법', () => {
  test('[FUNC] 블록 렉싱', () => {
    const tokens = lex('[FUNC add :params [$a $b] :body (+ $a $b)]');
    expect(tokens.some(t => t.value === 'FUNC')).toBe(true);
    expect(tokens.some(t => t.value === 'add')).toBe(true);
    // $a → Variable("a")
    expect(tokens.some(t => t.type === TokenType.Variable && t.value === 'a')).toBe(true);
  });

  test('[ROUTE] 블록 렉싱', () => {
    const tokens = lex('[ROUTE health :method "GET" :path "/health"]');
    expect(tokens.some(t => t.value === 'ROUTE')).toBe(true);
    // :method → Colon + Symbol("method")
    expect(tokens.some(t => t.value === 'method')).toBe(true);
  });

  test(':키워드 인식', () => {
    const tokens = lex(':params :body :method :path');
    // : 는 Colon 타입, 뒤에 Symbol이 따라옴
    expect(tokens.some(t => t.value === 'params')).toBe(true);
    expect(tokens.some(t => t.value === 'body')).toBe(true);
  });

  test('let 바인딩 문법', () => {
    const tokens = lex('(let [[$x 10] [$y 20]] (+ $x $y))');
    expect(tokens.some(t => t.value === 'let')).toBe(true);
    // $x → Variable("x")
    expect(tokens.some(t => t.type === TokenType.Variable && t.value === 'x')).toBe(true);
  });

  test('if 조건 문법', () => {
    const tokens = lex('(if (null? $x) 0 $x)');
    expect(tokens.some(t => t.value === 'if')).toBe(true);
    expect(tokens.some(t => t.value === 'null?')).toBe(true);
  });

  test('중첩 괄호', () => {
    const tokens = lex('((()))');
    const lp = tokens.filter(t => t.type === TokenType.LParen).length;
    expect(lp).toBe(3);
  });

  test('불리언 리터럴', () => {
    const tokens = lex('true false null');
    expect(tokens.some(t => t.value === 'true')).toBe(true);
    expect(tokens.some(t => t.value === 'false')).toBe(true);
    expect(tokens.some(t => t.value === 'null')).toBe(true);
  });
});
