// FreeLang v9: Phase 8 — OCI 자동 빌드 테스트
// Docker 없이 OCI 이미지 빌드 (20 tests)

import * as fs from "fs";
import * as path from "path";
import { createOciModule } from "./stdlib-oci";

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

console.log("\n🧪 Phase 8 — OCI 자동 빌드 테스트\n");

// ─────────────────────────────────────────
// OCI Module Creation Tests (2)
// ─────────────────────────────────────────

test("OCI 1: Module 생성", () => {
  const module = createOciModule();
  assert(module !== null, "Module should be created");
  assert(typeof module === "object", "Module should be object");
});

test("OCI 2: Module에 필수 함수들이 있음", () => {
  const module = createOciModule();
  assert("oci_create_manifest" in module, "Should have oci_create_manifest");
  assert("oci_create_layer" in module, "Should have oci_create_layer");
  assert("oci_build" in module, "Should have oci_build");
  assert("oci_push" in module, "Should have oci_push");
  assert("oci_sign" in module, "Should have oci_sign");
  assert("oci_list" in module, "Should have oci_list");
  assert("oci_inspect" in module, "Should have oci_inspect");
  assert("oci_remove" in module, "Should have oci_remove");
});

// ─────────────────────────────────────────
// OCI Manifest Creation Tests (3)
// ─────────────────────────────────────────

test("OCI 3: oci_create_manifest 함수", () => {
  const module = createOciModule();
  assert(typeof module.oci_create_manifest === "function", "Should be function");
});

test("OCI 4: Manifest 생성", () => {
  const module = createOciModule();
  const manifest = (module.oci_create_manifest as Function).call(module, {
    layers: []
  });
  assert(manifest !== null, "Should create manifest");
  assert("schemaVersion" in manifest, "Should have schemaVersion");
  assertEquals(manifest.schemaVersion, 2, "Schema version should be 2");
  assert("config" in manifest, "Should have config");
  assert("layers" in manifest, "Should have layers");
});

test("OCI 5: Manifest mediaType", () => {
  const module = createOciModule();
  const manifest = (module.oci_create_manifest as Function).call(module, {
    layers: []
  });
  assert(
    manifest.mediaType.includes("manifest"),
    "Should have manifest mediaType"
  );
});

// ─────────────────────────────────────────
// OCI Layer Creation Tests (3)
// ─────────────────────────────────────────

test("OCI 6: oci_create_layer 함수", () => {
  const module = createOciModule();
  assert(typeof module.oci_create_layer === "function", "Should be function");
});

test("OCI 7: Layer 생성 실패 (존재하지 않는 디렉토리)", () => {
  const module = createOciModule();
  const fn = module.oci_create_layer as Function;
  try {
    fn.call(module, "/nonexistent/directory");
    throw new Error("Should have thrown");
  } catch (err: any) {
    assert(
      err.message.includes("oci_create_layer failed") || err.message.includes("not found"),
      "Should throw appropriate error"
    );
  }
});

test("OCI 8: Layer digest 포맷", () => {
  const module = createOciModule();
  // 테스트 디렉토리 생성
  const testDir = path.join(__dirname, "..", ".test-oci-layer");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  fs.writeFileSync(path.join(testDir, "test.txt"), "test content");

  try {
    const layer = (module.oci_create_layer as Function).call(module, testDir);
    assert("digest" in layer, "Should have digest");
    assert(layer.digest.startsWith("sha256:"), "Digest should start with sha256:");
    assert("size" in layer, "Should have size");
    assert(layer.size > 0, "Size should be positive");
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────
// OCI Build Tests (4)
// ─────────────────────────────────────────

test("OCI 9: oci_build 함수", () => {
  const module = createOciModule();
  assert(typeof module.oci_build === "function", "Should be function");
});

test("OCI 10: 기본 이미지 빌드", () => {
  const module = createOciModule();
  const imageInfo = (module.oci_build as Function).call(module, "test-app:1.0.0");
  assert(imageInfo !== null, "Should build image");
  assertEquals(imageInfo.tag, "test-app:1.0.0", "Tag should match");
  assert("digestSha256" in imageInfo, "Should have digestSha256");
  assert(imageInfo.digestSha256.startsWith("sha256:"), "Digest should start with sha256:");
});

test("OCI 11: 레이어가 포함된 이미지 빌드", () => {
  const module = createOciModule();
  const layers = [{
    size: 1000,
    digest: "sha256:abc123",
    mediaType: "application/vnd.docker.image.rootfs.diff.tar.gzip"
  }];
  const imageInfo = (module.oci_build as Function).call(module, "test-app:2.0.0", layers);
  assert(imageInfo !== null, "Should build image with layers");
  assert(imageInfo.size === 1000, "Size should match layers");
});

test("OCI 12: OCI layout 디렉토리 생성", () => {
  const module = createOciModule();
  (module.oci_build as Function).call(module, "test-app:3.0.0");
  const imageDir = path.resolve(".oci-images", "test-app:3.0.0");
  assert(fs.existsSync(imageDir), "Should create image directory");
  assert(fs.existsSync(path.join(imageDir, "manifest.json")), "Should have manifest.json");
  assert(fs.existsSync(path.join(imageDir, "oci-layout")), "Should have oci-layout");
});

// ─────────────────────────────────────────
// OCI Image Management Tests (4)
// ─────────────────────────────────────────

test("OCI 13: oci_list 함수", () => {
  const module = createOciModule();
  assert(typeof module.oci_list === "function", "Should be function");
});

test("OCI 14: 이미지 목록 조회", () => {
  const module = createOciModule();
  (module.oci_build as Function).call(module, "list-test:1.0.0");
  const images = (module.oci_list as Function).call(module);
  assert(Array.isArray(images), "Should return array");
  assert(images.length > 0, "Should have at least one image");
});

test("OCI 15: oci_inspect 함수", () => {
  const module = createOciModule();
  assert(typeof module.oci_inspect === "function", "Should be function");
});

test("OCI 16: 이미지 상세 정보 조회", () => {
  const module = createOciModule();
  (module.oci_build as Function).call(module, "inspect-test:1.0.0");
  const info = (module.oci_inspect as Function).call(module, "inspect-test:1.0.0");
  assert(info !== null, "Should return image info");
  assert("digest" in info, "Should have digest");
  assert("config" in info, "Should have config");
  assert("size" in info, "Should have size");
  assert("created" in info, "Should have created timestamp");
});

// ─────────────────────────────────────────
// OCI Push & Sign Tests (2)
// ─────────────────────────────────────────

test("OCI 17: oci_push 함수", () => {
  const module = createOciModule();
  assert(typeof module.oci_push === "function", "Should be function");
});

test("OCI 18: oci_sign 함수", () => {
  const module = createOciModule();
  assert(typeof module.oci_sign === "function", "Should be function");
});

// ─────────────────────────────────────────
// OCI Remove & v9-oci.fl Tests (2)
// ─────────────────────────────────────────

test("OCI 19: oci_remove 함수", () => {
  const module = createOciModule();
  assert(typeof module.oci_remove === "function", "Should be function");
});

test("OCI 20: v9-oci.fl 파일 존재", () => {
  const ociScriptPath = path.resolve(__dirname, "../vpm/v9-oci.fl");
  assert(
    fs.existsSync(ociScriptPath),
    `v9-oci.fl should exist at ${ociScriptPath}`
  );
  const stat = fs.statSync(ociScriptPath);
  assert(stat.size > 0, "v9-oci.fl should have content");
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
