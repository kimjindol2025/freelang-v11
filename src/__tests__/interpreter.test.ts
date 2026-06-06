// FreeLang v9 인터프리터 테스트
// ASTNode[] → ExecutionContext 검증

import { lex } from '../lexer';
import { Parser } from '../parser';
import { Interpreter, ExecutionContext } from '../interpreter';

// LearnedFactsStore가 setInterval을 사용하므로 fake timers 필요
beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

function run(source: string): ExecutionContext {
  const tokens = lex(source);
  const ast = new Parser(tokens).parse();
  const interp = new Interpreter();
  return interp.interpret(ast);
}

describe('Interpreter - 산술 연산', () => {
  test('덧셈', () => {
    const ctx = run('(+ 1 2)');
    expect(ctx.lastValue).toBe(3);
  });

  test('곱셈', () => {
    const ctx = run('(* 3 4)');
    expect(ctx.lastValue).toBe(12);
  });

  test('뺄셈', () => {
    const ctx = run('(- 10 3)');
    expect(ctx.lastValue).toBe(7);
  });

  test('나눗셈', () => {
    const ctx = run('(/ 10 2)');
    expect(ctx.lastValue).toBe(5);
  });

  test('중첩 산술', () => {
    const ctx = run('(+ (* 2 3) (- 10 4))');
    expect(ctx.lastValue).toBe(12);
  });

  test('비교 >', () => {
    const ctx = run('(> 5 3)');
    expect(ctx.lastValue).toBe(true);
  });

  test('비교 <', () => {
    const ctx = run('(< 5 3)');
    expect(ctx.lastValue).toBe(false);
  });

  test('동등 비교 =', () => {
    const ctx = run('(= 5 5)');
    expect(ctx.lastValue).toBe(true);
  });
});

describe('Interpreter - let 바인딩', () => {
  test('단일 변수 바인딩', () => {
    const ctx = run('(let [[$x 10]] $x)');
    expect(ctx.lastValue).toBe(10);
  });

  test('복수 변수 바인딩', () => {
    const ctx = run('(let [[$x 3] [$y 4]] (+ $x $y))');
    expect(ctx.lastValue).toBe(7);
  });

  test('let 안 산술', () => {
    const ctx = run('(let [[$a 5] [$b 6]] (* $a $b))');
    expect(ctx.lastValue).toBe(30);
  });
});

describe('Interpreter - 조건문 if', () => {
  test('참 분기', () => {
    const ctx = run('(if true 1 2)');
    expect(ctx.lastValue).toBe(1);
  });

  test('거짓 분기', () => {
    const ctx = run('(if false 1 2)');
    expect(ctx.lastValue).toBe(2);
  });

  test('조건식 결과 참', () => {
    const ctx = run('(if (> 5 3) "yes" "no")');
    expect(ctx.lastValue).toBe('yes');
  });

  test('조건식 결과 거짓', () => {
    const ctx = run('(if (< 5 3) "yes" "no")');
    expect(ctx.lastValue).toBe('no');
  });

  test('null? 체크 — null', () => {
    const ctx = run('(if (null? null) 0 1)');
    expect(ctx.lastValue).toBe(0);
  });
});

describe('Interpreter - [FUNC] 함수 정의 및 호출', () => {
  test('함수 등록', () => {
    const ctx = run('[FUNC add :params [$a $b] :body (+ $a $b)]');
    expect(ctx.functions.has('add')).toBe(true);
  });

  test('함수 호출', () => {
    const ctx = run('[FUNC add :params [$a $b] :body (+ $a $b)](add 3 4)');
    expect(ctx.lastValue).toBe(7);
  });

  test('단항 함수', () => {
    const ctx = run('[FUNC double :params [$x] :body (* $x 2)](double 5)');
    expect(ctx.lastValue).toBe(10);
  });

  test('함수 내 let', () => {
    const ctx = run('[FUNC calc :params [$x] :body (let [[$y (* $x 2)]] (+ $y 1))](calc 3)');
    expect(ctx.lastValue).toBe(7);
  });

  test('함수 내 if', () => {
    const ctx = run('[FUNC abs :params [$x] :body (if (< $x 0) (- 0 $x) $x)](abs -5)');
    expect(ctx.lastValue).toBe(5);
  });
});

describe('Interpreter - 문자열', () => {
  test('문자열 리터럴 반환', () => {
    const ctx = run('(str "hello")');
    expect(ctx.lastValue).toBe('hello');
  });

  test('문자열 if 결과', () => {
    const ctx = run('(if true "yes" "no")');
    expect(ctx.lastValue).toBe('yes');
  });
});

describe('Interpreter - ExecutionContext 구조', () => {
  test('context.functions 존재', () => {
    const ctx = run('(+ 1 1)');
    expect(ctx.functions).toBeDefined();
    expect(ctx.functions instanceof Map).toBe(true);
  });

  test('context.variables 존재', () => {
    const ctx = run('(+ 1 1)');
    expect(ctx.variables).toBeDefined();
    // variables는 ScopeStack (Map-like 인터페이스 제공)
    expect(ctx.variables).toHaveProperty('has');
    expect(ctx.variables).toHaveProperty('get');
    expect(ctx.variables).toHaveProperty('set');
  });

  test('context.lastValue 설정됨', () => {
    const ctx = run('(+ 2 3)');
    expect(ctx).toHaveProperty('lastValue');
    expect(ctx.lastValue).toBe(5);
  });

  test('여러 표현식 — 마지막 값', () => {
    const ctx = run('(+ 1 2)(* 3 3)');
    expect(ctx.lastValue).toBe(9);
  });
});
