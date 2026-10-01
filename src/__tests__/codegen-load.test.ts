import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

test("compile expands relative top-level load once", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "freelang-codegen-load-"));
  try {
    const moduleFile = path.join(directory, "module.fls");
    const mainFile = path.join(directory, "main.fls");
    const outputFile = path.join(directory, "main.js");
    fs.writeFileSync(moduleFile, '(defn answer [] (+ 40 2))\n');
    fs.writeFileSync(mainFile, '(load "module.fls")\n(load "module.fls")\n(println (answer))\n');
    const compile = spawnSync(process.execPath,
      [path.join(__dirname, "../../bootstrap.js"), "compile", mainFile, "-o", outputFile],
      { encoding: "utf8" });
    expect(compile.status).toBe(0);
    const run = spawnSync(process.execPath, [outputFile], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stderr).toBe("");
    expect(run.stdout).toBe("42\n");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("compile rejects dynamic load paths", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "freelang-codegen-load-"));
  try {
    const mainFile = path.join(directory, "main.fls");
    fs.writeFileSync(mainFile, '(define file "module.fls")\n(load file)\n');
    const compile = spawnSync(process.execPath,
      [path.join(__dirname, "../../bootstrap.js"), "compile", mainFile], { encoding: "utf8" });
    expect(compile.status).not.toBe(0);
    expect(compile.stderr).toContain("compile supports only top-level");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
