// self-hosting.test.ts — FreeLang v11 자가 호스팅 회귀 테스트
//
// 목적: stage1/stage2/stage3 fixed-point 및 파생 컴파일 결과를 잠가서
//       이후 어떤 변경이든 자가 호스팅이 깨지면 즉시 감지.
//
// 배경: Phase 1 작업으로 다음 2개 블로커 해결됨
//   1) bootstrap parser의 JS Map AST 필드를 FL에서 열거 불가
//      → data 모듈에 map-entries/map_entries primitive 추가
//   2) self/all.fl + self/lexer.fl의 emit 함수 필드명 오타 (:type vs :kind)
//      → {:kind $kind :type $kind ...} 로 통일 (alias 유지)
//
// 검증 기준: bootstrap으로 생성한 stage1 컴파일러가 자기 자신을 컴파일한
//            stage2, 그리고 stage2가 다시 컴파일한 stage3가 SHA256 동일.

import { execSync } from "child_process";
import { readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";
import { tmpdir } from "os";

const REPO_ROOT = join(__dirname, "..", "..");
const BOOTSTRAP = join(REPO_ROOT, "bootstrap.js");
const SELF_ALL = join(REPO_ROOT, "self", "all.fl");
const HELLO_FL = join(REPO_ROOT, "self", "bench", "hello.fl");

const WORK_DIR = join(tmpdir(), `fl-self-host-${process.pid}`);
if (!existsSync(WORK_DIR)) mkdirSync(WORK_DIR, { recursive: true });

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runNode(args: string[], timeoutMs = 60_000): string {
  return execSync(`node --stack-size=8000 ${args.map(a => JSON.stringify(a)).join(" ")}`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("FreeLang v11 self-hosting", () => {
  const stage1 = join(WORK_DIR, "stage1.js");
  const stage2 = join(WORK_DIR, "stage2.js");
  const stage3 = join(WORK_DIR, "stage3.js");

  // stage1: bootstrap으로 self/all.fl 자기 컴파일
  test("stage1 self-compile succeeds and produces >=40KB output", () => {
    runNode([BOOTSTRAP, "run", SELF_ALL, SELF_ALL, stage1]);
    const size = statSync(stage1).size;
    expect(size).toBeGreaterThanOrEqual(40_000);
  });

  // stage1로 hello.fl 재컴파일 + 실행 결과 검증
  test("stage1 compiles hello.fl correctly (end-to-end)", () => {
    const helloOut = join(WORK_DIR, "hello.js");
    runNode([stage1, HELLO_FL, helloOut]);
    const out = execSync(`node ${JSON.stringify(helloOut)}`, { encoding: "utf8" });
    // hello.fl 은 (println "hello") — 출력에 "hello" 포함
    expect(out).toContain("hello");
  });

  // stage2: stage1으로 self/all.fl 재컴파일
  test("stage2 compile succeeds with normal node count (Parsed 150..200)", () => {
    const output = runNode([stage1, SELF_ALL, stage2]);
    const parsedMatch = output.match(/Parsed:\s*(\d+)\s*nodes/);
    expect(parsedMatch).not.toBeNull();
    const parsed = Number(parsedMatch![1]);
    expect(parsed).toBeGreaterThanOrEqual(150);
    expect(parsed).toBeLessThanOrEqual(200);
  });

  // stage3: stage2로 self/all.fl 재컴파일
  test("stage3 compile succeeds", () => {
    runNode([stage2, SELF_ALL, stage3]);
    expect(statSync(stage3).size).toBeGreaterThanOrEqual(40_000);
  });

  // Fixed-point: stage1, stage2, stage3 SHA256 완전 일치
  test("fixed-point: stage1 == stage2 == stage3 (SHA256)", () => {
    const h1 = sha256File(stage1);
    const h2 = sha256File(stage2);
    const h3 = sha256File(stage3);
    expect(h2).toBe(h1);
    expect(h3).toBe(h2);
  });

  // map-entries primitive 회귀 방지: map 리터럴 컴파일 경로가 살아 있는지
  test("map-entries primitive: map literal compiles correctly", () => {
    const probe = join(WORK_DIR, "probe-map.fl");
    writeFileSync(
      probe,
      '(let [[$m {:x 1 :y 2 :z "hi"}]]\n' +
      '  (do\n' +
      '    (println (str "x=" (get $m :x)))\n' +
      '    (println (str "y=" (get $m :y)))\n' +
      '    (println (str "z=" (get $m :z)))))\n'
    );
    const probeJs = join(WORK_DIR, "probe-map.js");
    runNode([stage1, probe, probeJs]);
    const out = execSync(`node ${JSON.stringify(probeJs)}`, { encoding: "utf8" });
    expect(out).toContain("x=1");
    expect(out).toContain("y=2");
    expect(out).toContain("z=hi");
  });

  // Phase C-1: 결정론 — 같은 소스를 2 회 compile 해도 bit-identical
  test("determinism: stage1 built twice yields identical SHA", () => {
    const stage1b = join(WORK_DIR, "stage1b.js");
    runNode([BOOTSTRAP, "run", SELF_ALL, SELF_ALL, stage1b]);
    expect(sha256File(stage1b)).toBe(sha256File(stage1));
  });

  // Phase C-1: fixed-point 깊이 확장 — stage4, stage5 까지 SHA 불변
  test("fixed-point depth: stage1..stage5 all identical", () => {
    const stage4 = join(WORK_DIR, "stage4.js");
    const stage5 = join(WORK_DIR, "stage5.js");
    runNode([stage3, SELF_ALL, stage4]);
    runNode([stage4, SELF_ALL, stage5]);
    const h1 = sha256File(stage1);
    expect(sha256File(stage4)).toBe(h1);
    expect(sha256File(stage5)).toBe(h1);
  });

  // Phase 후속 (#4): deep fixed-point — stage6..stage10까지 SHA 불변
  // self-hosting 결정론을 더 강하게 증명 (10단계 chain)
  test(
    "deep fixed-point: stage1..stage10 all identical (10-stage chain)",
    () => {
      const h1 = sha256File(stage1);
      let prev = stage1;
      for (let i = 2; i <= 10; i++) {
        const next = join(WORK_DIR, `stage${i}.js`);
        runNode([prev, SELF_ALL, next]);
        expect(sha256File(next)).toBe(h1);
        prev = next;
      }
    },
    120_000
  );
});

// Phase C-4: 전체 verify-self-host.sh 를 Jest 에서 실행해 결과 집계 검증.
// bash 스크립트 1 회 실행 = 전 파이프라인 (91 케이스) 검증.
// fast config 에서 과도하게 오래 걸리지 않도록 별도 describe + 90s timeout.
describe("FreeLang v11 full verify-self-host harness", () => {
  test(
    "scripts/verify-self-host.sh tier2 → PASS 91 / FAIL 0 / SKIP 0",
    () => {
      const script = join(REPO_ROOT, "scripts", "verify-self-host.sh");
      const out = execSync(`bash ${JSON.stringify(script)} tier2`, {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 120_000,
      });
      // 필수 섹션 존재 확인
      expect(out).toContain("결정론 OK");
      expect(out).toContain("fixed-point OK (5 단계 전원 일치)");
      // 결과 수치
      const passMatch = out.match(/^PASS:\s*(\d+)/m);
      const failMatch = out.match(/^FAIL:\s*(\d+)/m);
      const skipMatch = out.match(/^SKIP:\s*(\d+)/m);
      expect(passMatch).not.toBeNull();
      expect(failMatch).not.toBeNull();
      expect(skipMatch).not.toBeNull();
      expect(Number(passMatch![1])).toBe(91);
      expect(Number(failMatch![1])).toBe(0);
      expect(Number(skipMatch![1])).toBe(0);
    },
    120_000
  );
});
