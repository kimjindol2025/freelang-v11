// FreeLang v9 렉서 테스트
// 토큰화 및 문법 검증

import { lex } from '../lexer';
import { Token } from '../token';

describe('Lexer - 토큰화 기본', () => {
  test('식별자 인식', () => {
    const tokens = lex('hello world');
    expect(tokens[0].type).toBe('IDENTIFIER');
    expect(tokens[0].value).toBe('hello');
    expect(tokens[1].type).toBe('IDENTIFIER');
    expect(tokens[1].value).toBe('world');
  });

  test('숫자 리터럴 인식', () => {
    const tokens = lex('123 45.67');
    expect(tokens[0].type).toBe('NUMBER');
    expect(tokens[0].value).toBe('123');
    expect(tokens[1].type).toBe('NUMBER');
    expect(tokens[1].value).toBe('45.67');
  });

  test('문자열 리터럴 인식', () => {
    const tokens = lex('"hello" \'world\'');
    expect(tokens[0].type).toBe('STRING');
    expect(tokens[0].value).toBe('hello');
    expect(tokens[1].type).toBe('STRING');
    expect(tokens[1].value).toBe('world');
  });

  test('키워드 인식', () => {
    const tokens = lex('function if else async await');
    expect(tokens[0].type).toBe('KEYWORD');
    expect(tokens[0].value).toBe('function');
  });

  test('연산자 인식', () => {
    const tokens = lex('+ - * / = == !=');
    expect(tokens[0].type).toBe('OPERATOR');
    expect(tokens[2].type).toBe('OPERATOR');
  });

  test('괄호 인식', () => {
    const tokens = lex('() [] {}');
    expect(tokens[0].type).toBe('LPAREN');
    expect(tokens[1].type).toBe('RPAREN');
    expect(tokens[2].type).toBe('LBRACKET');
  });

  test('주석 무시', () => {
    const tokens = lex('hello // comment\nworld');
    expect(tokens.length).toBe(2);
    expect(tokens[0].value).toBe('hello');
    expect(tokens[1].value).toBe('world');
  });

  test('멀티라인 문자열', () => {
    const tokens = lex('`hello\nworld`');
    expect(tokens[0].type).toBe('STRING');
    expect(tokens[0].value).toContain('hello');
    expect(tokens[0].value).toContain('world');
  });

  test('특수 문자 처리', () => {
    const tokens = lex('$name @decorator #hash');
    expect(tokens[0].type).toBe('IDENTIFIER');
    expect(tokens[0].value).toBe('$name');
  });

  test('공백 및 들여쓰기 처리', () => {
    const tokens = lex('  hello   world  ');
    expect(tokens.length).toBe(2);
    expect(tokens[0].value).toBe('hello');
  });
});

describe('Lexer - 고급 토크나이제이션', () => {
  test('제네릭 문법', () => {
    const tokens = lex('Map<string, int>');
    expect(tokens.some((t: Token) => t.value === 'Map')).toBe(true);
    expect(tokens.some((t: Token) => t.value === '<')).toBe(true);
  });

  test('포인터 문법', () => {
    const tokens = lex('*ptr &ref');
    expect(tokens.some((t: Token) => t.type === 'OPERATOR')).toBe(true);
  });

  test('모듈 임포트 문법', () => {
    const tokens = lex('import "module" as alias');
    expect(tokens[0].value).toBe('import');
    expect(tokens[1].type).toBe('STRING');
  });

  test('async/await 문법', () => {
    const tokens = lex('async fn() { await promise }');
    expect(tokens.some((t: Token) => t.value === 'async')).toBe(true);
    expect(tokens.some((t: Token) => t.value === 'await')).toBe(true);
  });
});

describe('Lexer - 에러 처리', () => {
  test('미종료 문자열 감지', () => {
    const tokens = lex('"unclosed');
    expect(tokens).toBeDefined();
  });

  test('잘못된 이스케이프 시퀀스', () => {
    const tokens = lex('"\\x"');
    expect(tokens[0].type).toBe('STRING');
  });

  test('중첩 괄호 처리', () => {
    const tokens = lex('((()))');
    const parenCount = tokens.filter((t: Token) => t.type === 'LPAREN').length;
    expect(parenCount).toBe(3);
  });
});
