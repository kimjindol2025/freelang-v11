#!/usr/bin/env node
/**
 * FreeLang v11.1 성능 기준선 벤치마크
 * 측정: Lexing, Parsing, Codegen, Execution
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const BOOTSTRAP = path.join(__dirname, '../bootstrap.js');
const SAMPLES = {
  'small-arithmetic': '(+ 1 2 3 4 5)',
  'map-filter': '(filter (fn [x] (> x 2)) (map (fn [n] (* n 2)) [1 2 3 4 5]))',
  'recursive-factorial': `(define factorial (fn [n]
    (if (<= n 1) 1 (* n (factorial (- n 1))))))
  (factorial 10)`,
  'reduce-sum': '(reduce (fn [acc x] (+ acc x)) 0 [1 2 3 4 5 6 7 8 9 10])',
  'complex-let': `(let [[x 10] [y 20] [z (+ 10 20)]]
    (+ x y z))`,
  'try-catch': `(try
    (/ 1 0)
    (catch e "error caught"))`,
  'type-validation': `(if (number? 42)
    (if (array? [1 2 3])
      "valid"
      "invalid")
    "not-number")`,
};

function benchmark(name, code, iterations = 100) {
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    try {
      cp.execSync(`node "${BOOTSTRAP}" run /dev/stdin`, {
        input: code,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
    } catch (e) {
      // 에러 무시
    }
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1000); // 마이크로초
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b) / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  return { avg, p50, p95, p99, min: times[0], max: times[times.length - 1] };
}

console.log('📊 FreeLang v11.1 성능 기준선');
console.log('='.repeat(60));
console.log('');

const results = {};
for (const [name, code] of Object.entries(SAMPLES)) {
  process.stdout.write(`${name.padEnd(25)}`);
  const perf = benchmark(name, code, 50);
  results[name] = perf;

  console.log(`${perf.avg.toFixed(2)}μs (p95: ${perf.p95.toFixed(2)}μs)`);
}

console.log('');
console.log('='.repeat(60));
console.log('');

// 통계
const allTimes = Object.values(results).flatMap(r => [r.avg]);
const avgAll = allTimes.reduce((a, b) => a + b) / allTimes.length;
console.log(`📈 평균 실행 시간: ${avgAll.toFixed(2)}μs`);
console.log(`📈 최소: ${Math.min(...allTimes).toFixed(2)}μs`);
console.log(`📈 최대: ${Math.max(...allTimes).toFixed(2)}μs`);

// JSON 저장
const output = {
  timestamp: new Date().toISOString(),
  version: 'v11.1.0-alpha',
  platform: `${process.platform}-${process.arch}`,
  nodeVersion: process.version,
  samples: results,
  summary: {
    avgExecutionTime: avgAll,
    minExecutionTime: Math.min(...allTimes),
    maxExecutionTime: Math.max(...allTimes),
    samplesCount: Object.keys(SAMPLES).length,
  }
};

fs.writeFileSync(
  path.join(__dirname, '../benchmark-results-v11.1.json'),
  JSON.stringify(output, null, 2)
);

console.log('');
console.log('✅ 벤치마크 결과 저장: benchmark-results-v11.1.json');
