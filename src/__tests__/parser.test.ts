// FreeLang v9 파서 테스트
// Token[] → ASTNode[] 검증

import { lex } from '../lexer';
import { Parser } from '../parser';

function parse(source: string) {
  const tokens = lex(source);
  return new Parser(tokens).parse();
}

describe('Parser - 기본 S-Expression 파싱', () => {
  test('단순 심볼 — 최상위 레벨 심볼은 파서 에러', () => {
    // FreeLang v9는 최상위에 블록이나 S-expression만 허용
    expect(() => parse('hello')).toThrow();
  });

  test('숫자 리터럴 S-expression', () => {
    const ast = parse('(+ 1 2)');
    expect(ast).toBeDefined();
    expect(ast.length).toBeGreaterThan(0);
  });

  test('중첩 S-expression', () => {
    const ast = parse('(+ (* 2 3) 4)');
    expect(ast).toBeDefined();
    expect(ast.length).toBe(1);
  });

  test('문자열 인자 S-expression', () => {
    const ast = parse('(print "hello world")');
    expect(ast).toBeDefined();
  });

  test('$변수 인자', () => {
    const ast = parse('(+ $a $b)');
    expect(ast).toBeDefined();
  });

  test('null? 함수 호출', () => {
    const ast = parse('(null? $x)');
    expect(ast).toBeDefined();
  });

  test('if S-expression', () => {
    const ast = parse('(if (null? $x) 0 $x)');
    expect(ast).toBeDefined();
  });

  test('let 바인딩', () => {
    const ast = parse('(let [[$x 10] [$y 20]] (+ $x $y))');
    expect(ast).toBeDefined();
  });

  test('중첩 괄호 3겹', () => {
    const ast = parse('(+ (+ 1 2) (+ 3 4))');
    expect(ast).toBeDefined();
    expect(ast.length).toBe(1);
  });

  test('불리언 리터럴', () => {
    const ast = parse('(if true 1 0)');
    expect(ast).toBeDefined();
  });
});

describe('Parser - [FUNC] 블록', () => {
  test('[FUNC] 기본 파싱', () => {
    const ast = parse('[FUNC add :params [$a $b] :body (+ $a $b)]');
    expect(ast).toBeDefined();
    expect(ast.length).toBe(1);
  });

  test('[FUNC] 단일 파라미터', () => {
    const ast = parse('[FUNC double :params [$x] :body (* $x 2)]');
    expect(ast).toBeDefined();
  });

  test('[FUNC] 빈 파라미터', () => {
    const ast = parse('[FUNC greet :params [] :body "hello"]');
    expect(ast).toBeDefined();
  });

  test('[FUNC] 중첩 body', () => {
    const ast = parse('[FUNC max :params [$a $b] :body (if (> $a $b) $a $b)]');
    expect(ast).toBeDefined();
  });

  test('[FUNC] 여러 개 연속', () => {
    const ast = parse('[FUNC f1 :params [$x] :body $x][FUNC f2 :params [$x] :body (* $x 2)]');
    expect(ast.length).toBe(2);
  });
});

describe('Parser - [ROUTE] 블록', () => {
  test('[ROUTE] GET 파싱', () => {
    const ast = parse('[ROUTE health :method "GET" :path "/health" :handler (respond 200 "ok")]');
    expect(ast).toBeDefined();
  });

  test('[ROUTE] POST 파싱', () => {
    const ast = parse('[ROUTE create :method "POST" :path "/api/items" :handler (respond 201 "created")]');
    expect(ast).toBeDefined();
  });
});

describe('Parser - AST 노드 구조', () => {
  test('S-expression 노드 kind', () => {
    const ast = parse('(+ 1 2)');
    expect((ast[0] as any).kind).toBe('sexpr');
  });

  test('[FUNC] 노드 kind 검증', () => {
    const ast = parse('[FUNC f :params [$x] :body $x]');
    expect((ast[0] as any).kind).toBe('block');
  });

  test('복수 노드 파싱', () => {
    const ast = parse('(+ 1 2)(* 3 4)');
    expect(ast.length).toBe(2);
  });

  test('빈 입력 → 빈 배열', () => {
    const ast = parse('');
    expect(Array.isArray(ast)).toBe(true);
    expect(ast.length).toBe(0);
  });
});

describe('Parser - 에러 처리', () => {
  test('괄호 불일치 — 에러 발생', () => {
    expect(() => parse('(+ 1 2')).toThrow();
  });

  test('최상위 심볼 — 에러 발생', () => {
    expect(() => parse('hello world')).toThrow();
  });

  test('미완성 [FUNC] — 에러 발생', () => {
    expect(() => parse('[FUNC')).toThrow();
  });
});
