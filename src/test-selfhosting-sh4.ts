/**
 * Phase SH-4: 진짜 셀프 호스팅 검증
 * Stage 1 = Stage 2 = Stage 3 (동일 출력)
 * TS → simple-test.fl
 * TS → interpreter.fl → simple-test.fl
 * TS → interpreter.fl → interpreter.fl → simple-test.fl
 */
import { execSync } from 'child_process';

let passed = 0, total = 0;

function t(desc: string, fn: () => boolean) {
  total++;
  try {
    const ok = fn();
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${desc}`);
    if (ok) passed++;
  } catch (e: any) {
    console.log(`FAIL: ${desc}\n  error: ${e.message?.slice(0,100)}`);
  }
}

function run(args: string): string {
  return execSync(
    `npx ts-node --project .config/tsconfig.json src/cli.ts ${args}`,
    { encoding: 'utf-8', cwd: process.cwd() }
  ).trim();
}

const EXPECTED = '1 + 2 = 3\ndouble(7) = 14\nfib(8) = 21';
const INTERP = 'src/freelang-interpreter.fl';
const TARGET = 'examples/simple-test.fl';

t("Stage 1: TS → simple-test.fl", () => {
  const out = run(`run ${TARGET}`);
  return out === EXPECTED;
});

t("Stage 2: TS → interpreter.fl → simple-test.fl", () => {
  const out = run(`run ${INTERP} ${TARGET}`);
  return out === EXPECTED;
});

t("Stage 3: TS → interpreter.fl → interpreter.fl → simple-test.fl", () => {
  const out = run(`run ${INTERP} ${INTERP} ${TARGET}`);
  return out === EXPECTED;
});

t("Stage 1 == Stage 2 (셀프 호스팅 동일성)", () => {
  const s1 = run(`run ${TARGET}`);
  const s2 = run(`run ${INTERP} ${TARGET}`);
  return s1 === s2;
});

t("Stage 2 == Stage 3 (2중 셀프 호스팅 동일성)", () => {
  const s2 = run(`run ${INTERP} ${TARGET}`);
  const s3 = run(`run ${INTERP} ${INTERP} ${TARGET}`);
  return s2 === s3;
});

console.log(`\n결과: ${passed} / ${total} PASS`);
if (passed === total) {
  console.log('\n🎉 FreeLang 셀프 호스팅 완성!');
  console.log('   FL 코드가 FL 코드를 FL 코드로 실행합니다.');
}
