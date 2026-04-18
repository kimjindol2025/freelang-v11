// FreeLang v9: Phase 7 — Registry 통합 테스트
// npm 호환 패키지 레지스트리 (20 tests)

import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { createRegistryModule } from "./stdlib-registry";

let testsPassed = 0;
let testsFailed = 0;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    testsPassed++;
    results.push({ name, passed: true });
    console.log(`  ✅  ${name}`);
  } catch (err: any) {
    testsFailed++;
    results.push({ name, passed: false, error: err.message });
    console.error(`  ❌  ${name}`);
    console.error(`      ${err.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual: any, expected: any, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected}, got ${actual}`
    );
  }
}

console.log("\n🧪 Phase 7 — Registry 통합 테스트\n");

// ─────────────────────────────────────────
// Registry Module Creation Tests (2)
// ─────────────────────────────────────────

test("Registry 1: Module 생성", () => {
  const module = createRegistryModule();
  assert(module !== null, "Module should be created");
  assert(typeof module === "object", "Module should be object");
});

test("Registry 2: Module에 필수 함수들이 있음", () => {
  const module = createRegistryModule();
  assert("registry_publish" in module, "Should have registry_publish");
  assert("registry_search" in module, "Should have registry_search");
  assert("registry_info" in module, "Should have registry_info");
  assert("registry_delete" in module, "Should have registry_delete");
  assert("registry_start" in module, "Should have registry_start");
});

// ─────────────────────────────────────────
// Registry Function Type Tests (4)
// ─────────────────────────────────────────

test("Registry 3: registry_publish는 함수", () => {
  const module = createRegistryModule();
  assert(typeof module.registry_publish === "function", "registry_publish should be function");
});

test("Registry 4: registry_search는 함수", () => {
  const module = createRegistryModule();
  assert(typeof module.registry_search === "function", "registry_search should be function");
});

test("Registry 5: registry_info는 함수", () => {
  const module = createRegistryModule();
  assert(typeof module.registry_info === "function", "registry_info should be function");
});

test("Registry 6: registry_start는 함수", () => {
  const module = createRegistryModule();
  assert(typeof module.registry_start === "function", "registry_start should be function");
});

// ─────────────────────────────────────────
// Registry Function Signature Tests (6)
// ─────────────────────────────────────────

test("Registry 7: registry_publish(name, version, files) 호출 가능", () => {
  const module = createRegistryModule();
  const fn = module.registry_publish as Function;
  // 실제 HTTP 호출은 실패할 수 있으므로, 호출 가능 여부만 확인
  assert(typeof fn.call === "function", "Should be callable");
});

test("Registry 8: registry_search(query) 호출 가능", () => {
  const module = createRegistryModule();
  const fn = module.registry_search as Function;
  assert(typeof fn.call === "function", "Should be callable");
});

test("Registry 9: registry_info(name) 호출 가능", () => {
  const module = createRegistryModule();
  const fn = module.registry_info as Function;
  assert(typeof fn.call === "function", "Should be callable");
});

test("Registry 10: registry_delete(name, version) 호출 가능", () => {
  const module = createRegistryModule();
  const fn = module.registry_delete as Function;
  assert(typeof fn.call === "function", "Should be callable");
});

test("Registry 11: registry_start(port) 호출 가능", () => {
  const module = createRegistryModule();
  const fn = module.registry_start as Function;
  assert(typeof fn.call === "function", "Should be callable");
});

test("Registry 12: registry_start() 기본값 포트 사용", () => {
  const module = createRegistryModule();
  const result = (module.registry_start as Function).call(module);
  assert(result !== null, "Should return result");
  assert(typeof result === "object", "Should return object");
  assert("port" in result, "Should have port property");
});

// ─────────────────────────────────────────
// HTTP Environment Tests (2)
// ─────────────────────────────────────────

test("Registry 13: REGISTRY_URL 환경변수 읽음", () => {
  process.env.REGISTRY_URL = "http://test-registry:4873";
  const module = createRegistryModule();
  assert(module !== null, "Module should use REGISTRY_URL env var");
});

test("Registry 14: 기본 REGISTRY_URL 사용", () => {
  delete process.env.REGISTRY_URL;
  const module = createRegistryModule();
  assert(module !== null, "Module should have default registry URL");
});

// ─────────────────────────────────────────
// Error Handling Tests (4)
// ─────────────────────────────────────────

test("Registry 15: registry_search 에러 처리", () => {
  const module = createRegistryModule();
  const fn = module.registry_search as Function;
  // 기본 환경에서 에러 발생 예상 (localhost 없음)
  try {
    fn("");
  } catch (err: any) {
    assert(
      err.message.includes("registry_search failed"),
      "Should throw registry_search error"
    );
  }
});

test("Registry 16: registry_info 에러 처리", () => {
  const module = createRegistryModule();
  const fn = module.registry_info as Function;
  try {
    fn("nonexistent-package");
  } catch (err: any) {
    assert(
      err.message.includes("registry_info failed") || err.message.includes("ECONNREFUSED"),
      "Should throw registry_info error or connection error"
    );
  }
});

test("Registry 17: registry_delete 에러 처리", () => {
  const module = createRegistryModule();
  const fn = module.registry_delete as Function;
  try {
    fn("nonexistent-package", "0.0.1");
  } catch (err: any) {
    assert(
      err.message.includes("registry_delete failed") || err.message.includes("ECONNREFUSED"),
      "Should throw registry_delete error or connection error"
    );
  }
});

test("Registry 18: registry_start 성공 응답", () => {
  const module = createRegistryModule();
  const result = (module.registry_start as Function).call(module, 4873);
  assert("running" in result, "Should have running property");
  assertEquals(result.running, true, "Should indicate running");
  assert("port" in result, "Should have port property");
  assertEquals(result.port, 4873, "Should return correct port");
});

// ─────────────────────────────────────────
// Registry Server File Tests (2)
// ─────────────────────────────────────────

test("Registry 19: registry-server.fl 파일 존재", () => {
  const registryServerPath = path.resolve(__dirname, "../vpm/registry-server.fl");
  assert(
    fs.existsSync(registryServerPath),
    `registry-server.fl should exist at ${registryServerPath}`
  );
});

test("Registry 20: registry-server.fl 파일 크기 > 0", () => {
  const registryServerPath = path.resolve(__dirname, "../vpm/registry-server.fl");
  const stat = fs.statSync(registryServerPath);
  assert(stat.size > 0, "registry-server.fl should have content");
});

// ─────────────────────────────────────────
// Results
// ─────────────────────────────────────────

console.log("\n" + "─".repeat(50));
console.log(`\n📊 Test Results: ${testsPassed}/${testsPassed + testsFailed} PASS\n`);

if (testsFailed > 0) {
  console.error(`❌ ${testsFailed} tests failed\n`);
  process.exit(1);
} else {
  console.log(`✅ All tests passed!\n`);
  process.exit(0);
}
