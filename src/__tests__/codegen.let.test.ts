// codegen.let.test.ts — Let-in-Expression Regression Tests (Phase C)
// genSExpr let 처리의 회귀 검증

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

describe("Codegen — Let-in-Expression (Regression)", () => {
  const testDir = path.join(__dirname, "../../tests/regen");

  const tests = [
    {
      name: "Case A: return 내 let",
      file: "let-in-expr-01.fl",
      shouldHaveIIFE: true,
    },
    {
      name: "Case B: if 조건의 let",
      file: "let-in-expr-02.fl",
      shouldHaveIIFE: true,
    },
    {
      name: "Case C: 인자 위치 let",
      file: "let-in-expr-03.fl",
      shouldHaveIIFE: true,
    },
    {
      name: "Case D: 중첩 let",
      file: "let-in-expr-04.fl",
      shouldHaveIIFE: true,
    },
    {
      name: "Case E: 복잡한 expression",
      file: "let-in-expr-05.fl",
      shouldHaveIIFE: true,
    },
  ];

  // 생성된 JS가 "return let" 형태(잘못된 구문)를 포함하는지 확인
  const LET_AS_STATEMENT = /return\s+let\s+[^\;]+\;/;
  const UNSUPPORTED_BLOCK = /\/\*\s*unsupported block/;

  tests.forEach(({ name, file, shouldHaveIIFE }) => {
    it(name, () => {
      const filePath = path.join(testDir, file);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Test file not found: ${filePath}`);
      }

      // bootstrap.js로 컴파일
      const output = path.join("/tmp", `jest-${path.basename(file, ".fl")}.js`);
      try {
        execSync(`node bootstrap.js compile "${filePath}" -o "${output}"`, {
          cwd: path.join(__dirname, "../../"),
          stdio: "pipe",
        });
      } catch (err: any) {
        throw new Error(`Compilation failed: ${err.message}`);
      }

      const js = fs.readFileSync(output, "utf8");

      // 검증 1: unsupported block 없음
      expect(js).not.toMatch(UNSUPPORTED_BLOCK);

      // 검증 2: let-as-statement 잔재 없음
      expect(js).not.toMatch(LET_AS_STATEMENT);

      // 검증 3: Node syntax 검증
      try {
        execSync(`node --check "${output}"`, { stdio: "pipe" });
      } catch (err: any) {
        throw new Error(`Syntax error in generated JS: ${err.message}`);
      }

      // 정리
      fs.unlinkSync(output);
    });
  });
});
