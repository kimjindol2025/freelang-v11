// build-determinism.test.ts — TS → bootstrap.js/browser.js 결정론 검증
//
// npm run build를 두 번 실행해서 산출물 SHA256가 동일한지 jest로도 자동화.
// CI에서 회귀 검출 가능.
//
// scripts/verify-build-deterministic.sh의 jest wrapper.

import { execSync } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

const REPO_ROOT = join(__dirname, "..", "..");

describe("FreeLang v11 build determinism", () => {
  test(
    "scripts/verify-build-deterministic.sh: 2/2 artifacts identical",
    () => {
      const script = join(REPO_ROOT, "scripts", "verify-build-deterministic.sh");
      expect(existsSync(script)).toBe(true);
      // shell script가 exit 0이면 통과
      const out = execSync(`bash ${JSON.stringify(script)}`, {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 60_000,
      });
      // 결과 검증
      expect(out).toContain("Build Deterministic");
      expect(out).toContain("2/2 artifacts identical");
      expect(out).not.toContain("DIFFERS");
    },
    60_000
  );
});
