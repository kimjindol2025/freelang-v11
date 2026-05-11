// Phase B stdlib 테스트: queue.fl, math-ext.fl, csv (내장 + csv.fl)
import * as fs from 'fs';
import { Interpreter } from '../interpreter';
import { lex } from '../lexer';
import { Parser } from '../parser';

function run(src: string): any {
  const tokens = lex(src);
  const ast = new Parser(tokens).parse();
  const interp = new Interpreter();
  interp.interpret(ast);
  return (interp as any).context?.lastValue ?? null;
}

function loadLib(name: string): string {
  return fs.readFileSync(`stdlib/${name}.fl`, 'utf8');
}

beforeAll(() => { jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterAll(() => { jest.restoreAllMocks(); });

// ─── queue.fl ────────────────────────────────────────────────────────────────
describe("stdlib/queue.fl — Queue (FIFO)", () => {
  const src = loadLib('queue');

  test("queue-create 초기 상태", () => {
    const r = run(src + '\n(queue-size (queue-create))');
    expect(r).toBe(0);
  });

  test("queue-empty? 초기에 true", () => {
    const r = run(src + '\n(queue-empty? (queue-create))');
    expect(r).toBe(true);
  });

  test("queue-push 후 size 증가", () => {
    const r = run(src + `
      (let [q (queue-push (queue-create) 42)]
        (queue-size q))`);
    expect(r).toBe(1);
  });

  test("queue-peek: 첫 번째 값 반환", () => {
    const r = run(src + `
      (let [q (queue-push (queue-push (queue-create) 1) 2)]
        (queue-peek q))`);
    expect(r).toBe(1);
  });

  test("queue-pop: val=1, 나머지 size=1", () => {
    const r = run(src + `
      (let [q (queue-push (queue-push (queue-create) 1) 2)
            result (queue-pop q)]
        (get result :val))`);
    expect(r).toBe(1);
  });

  test("queue-pop 후 queue size 감소", () => {
    const r = run(src + `
      (let [q (queue-push (queue-push (queue-create) 1) 2)
            result (queue-pop q)]
        (queue-size (get result :queue)))`);
    expect(r).toBe(1);
  });

  test("빈 큐 pop: val=nil", () => {
    const r = run(src + `
      (let [result (queue-pop (queue-create))]
        (nil? (get result :val)))`);
    expect(r).toBe(true);
  });

  test("queue->list: 순서 유지", () => {
    const r = run(src + `
      (let [q (queue-push (queue-push (queue-push (queue-create) 1) 2) 3)]
        (queue->list q))`);
    expect(r).toEqual([1, 2, 3]);
  });
});

describe("stdlib/queue.fl — Stack (LIFO)", () => {
  const src = loadLib('queue');

  test("stack-push / stack-peek: 마지막 push 값", () => {
    const r = run(src + `
      (let [s (stack-push (stack-push (stack-create) 10) 20)]
        (stack-peek s))`);
    expect(r).toBe(20);
  });

  test("stack-pop: LIFO 순서", () => {
    const r = run(src + `
      (let [s (stack-push (stack-push (stack-create) 10) 20)
            result (stack-pop s)]
        (get result :val))`);
    expect(r).toBe(20);
  });

  test("stack-empty? 초기에 true", () => {
    const r = run(src + '\n(stack-empty? (stack-create))');
    expect(r).toBe(true);
  });

  test("stack-size 정확", () => {
    const r = run(src + `
      (let [s (stack-push (stack-push (stack-create) "a") "b")]
        (stack-size s))`);
    expect(r).toBe(2);
  });
});

// ─── math-ext.fl ─────────────────────────────────────────────────────────────
describe("stdlib/math-ext.fl — 기본 통계", () => {
  const src = loadLib('math-ext');

  test("math-sum", () => {
    const r = run(src + '\n(math-sum [1 2 3 4 5])');
    expect(r).toBe(15);
  });

  test("math-mean", () => {
    const r = run(src + '\n(math-mean [2 4 6])');
    expect(r).toBeCloseTo(4);
  });

  test("math-mean 빈 배열 → nil", () => {
    const r = run(src + '\n(nil? (math-mean []))');
    expect(r).toBe(true);
  });

  test("math-median 홀수 개", () => {
    const r = run(src + '\n(math-median [3 1 2])');
    expect(r).toBe(2);
  });

  test("math-median 짝수 개 (평균)", () => {
    const r = run(src + '\n(math-median [1 2 3 4])');
    expect(r).toBeCloseTo(2.5);
  });

  test("math-variance", () => {
    const r = run(src + '\n(math-variance [2 4 4 4 5 5 7 9])');
    expect(r).toBeCloseTo(4.0);
  });

  test("math-stddev", () => {
    const r = run(src + '\n(math-stddev [2 4 4 4 5 5 7 9])');
    expect(r).toBeCloseTo(2.0);
  });

  test("math-min", () => {
    const r = run(src + '\n(math-min [5 3 8 1 4])');
    expect(r).toBe(1);
  });

  test("math-max", () => {
    const r = run(src + '\n(math-max [5 3 8 1 4])');
    expect(r).toBe(8);
  });

  test("math-range", () => {
    const r = run(src + '\n(math-range [1 5 3 9 2])');
    expect(r).toBe(8);
  });

  test("math-percentile p=50 (중간값과 동일)", () => {
    const r = run(src + '\n(math-percentile [10 20 30 40 50] 50)');
    expect(r).toBe(30);
  });

  test("math-clamp 범위 내", () => {
    const r = run(src + '\n(math-clamp 5 1 10)');
    expect(r).toBe(5);
  });

  test("math-clamp 상한 초과", () => {
    const r = run(src + '\n(math-clamp 15 1 10)');
    expect(r).toBe(10);
  });

  test("math-normalize: 0~1 범위", () => {
    const r = run(src + `
      (let [result (math-normalize [0 5 10])]
        [(nth result 0) (nth result 1) (nth result 2)])`);
    expect(r[0]).toBeCloseTo(0);
    expect(r[1]).toBeCloseTo(0.5);
    expect(r[2]).toBeCloseTo(1.0);
  });
});

// ─── csv 내장 함수 ──────────────────────────────────────────────────────────
describe("csv 내장 함수 (csv-parse / csv-parse-map / csv-stringify)", () => {

  test("csv-parse: 기본 파싱", () => {
    const r = run(`(csv-parse "a,b,c\n1,2,3")`);
    expect(r).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  test("csv-parse: quoted fields with comma", () => {
    const r = run(`(csv-parse "name,desc\nAlice,\\"hello, world\\"")`);
    expect(r[1][1]).toBe("hello, world");
  });

  test("csv-parse-map: 헤더 맵 반환", () => {
    const r = run(`(csv-parse-map "name,age\nAlice,30\nBob,25")`);
    expect(r.length).toBe(2);
    expect(r[0]["name"]).toBe("Alice");
    expect(r[1]["age"]).toBe("25");
  });

  test("csv-stringify: 배열 → CSV 문자열", () => {
    const r = run(`(csv-stringify [["a" "b"] ["1" "2"]])`);
    expect(r).toBe("a,b\n1,2");
  });

  test("csv-stringify: comma 포함 셀 자동 인용부호", () => {
    const r = run(`(csv-stringify [["name" "desc"] ["Alice" "hello, world"]])`);
    expect(r).toContain('"hello, world"');
  });
});

// ─── csv.fl 헬퍼 ────────────────────────────────────────────────────────────
describe("stdlib/csv.fl — 헬퍼 함수", () => {
  const src = loadLib('csv');

  test("csv-headers: 첫 행 반환", () => {
    const r = run(src + '\n(csv-headers "id,name,age\n1,Alice,30")');
    expect(r).toEqual(["id", "name", "age"]);
  });

  test("csv-data-rows: 헤더 제외 행 수", () => {
    const r = run(src + '\n(length (csv-data-rows "id,name\n1,Alice\n2,Bob"))');
    expect(r).toBe(2);
  });

  test("csv-row-count", () => {
    const r = run(src + '\n(csv-row-count "a,b\n1,2\n3,4\n5,6")');
    expect(r).toBe(3);
  });

  test("csv-filter: 특정 컬럼 조건 필터", () => {
    const r = run(src + `
      (let [result (csv-filter "name,score\nAlice,90\nBob,70\nCarol,85"
                               "score"
                               (fn [v] (>= (str-to-num v) 85)))]
        (length result))`);
    expect(r).toBe(2);
  });
});
