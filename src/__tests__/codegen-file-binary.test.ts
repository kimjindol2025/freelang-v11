import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { lex } from "../lexer";
import { parse } from "../parser";
import { JSCodegen } from "../codegen-js";

test("generated FreeLang reads bounded binary bytes without UTF-8 conversion", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "freelang-codegen-binary-"));
  try {
    const file = path.join(directory, "bytes.bin");
    fs.writeFileSync(file, Buffer.from([0, 255, 1]));
    const good = new JSCodegen().generate(parse(lex(
      `(println (file-read-base64 ${JSON.stringify(file)} 3))`)));
    const goodResult = spawnSync(process.execPath, ["-e", good], { encoding: "utf8" });
    expect(goodResult.status).toBe(0);
    expect(goodResult.stdout).toBe("AP8B\n");
    const tooSmall = new JSCodegen().generate(parse(lex(
      `(println (file-read-base64 ${JSON.stringify(file)} 2))`)));
    const badResult = spawnSync(process.execPath, ["-e", tooSmall], { encoding: "utf8" });
    expect(badResult.status).not.toBe(0);
    expect(badResult.stderr).toContain("bounded regular file");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("generated FreeLang strictly decodes bounded UTF-8 text", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "freelang-codegen-utf8-"));
  try {
    const file = path.join(directory, "text.txt");
    fs.writeFileSync(file, "한글\n", "utf8");
    const source = (limit: number) => `(println (utf8-decode-strict (file-read-base64 ${JSON.stringify(file)} ${limit})))`;
    const good = spawnSync(process.execPath,
      ["-e", new JSCodegen().generate(parse(lex(source(100))))], { encoding: "utf8" });
    expect(good.status).toBe(0);
    expect(good.stdout).toBe("한글\n\n");
    const tooLarge = spawnSync(process.execPath,
      ["-e", new JSCodegen().generate(parse(lex(source(1))))], { encoding: "utf8" });
    expect(tooLarge.status).not.toBe(0);
    fs.writeFileSync(file, Buffer.from([0xff]));
    const invalid = spawnSync(process.execPath,
      ["-e", new JSCodegen().generate(parse(lex(source(100))))], { encoding: "utf8" });
    expect(invalid.status).not.toBe(0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
