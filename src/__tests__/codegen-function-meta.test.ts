import { spawnSync } from "child_process";
import { lex } from "../lexer";
import { parse } from "../parser";
import { JSCodegen } from "../codegen-js";

function runGenerated(source: string): string {
  const generated = new JSCodegen().generate(parse(lex(source)));
  const result = spawnSync(process.execPath, ["-e", generated], { encoding: "utf8" });
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  return result.stdout;
}

test("defn metadata is separate from the executable body", () => {
  expect(runGenerated('(defn answer [] {:context "test" :returns "number"} (+ 40 2)) (println (answer))')).toBe("42\n");
});

test("integer? compiles to the interpreter's integer predicate", () => {
  expect(runGenerated('(println (integer? 2)) (println (integer? 2.5)) (println (integer? "2"))')).toBe("true\nfalse\nfalse\n");
});

test("filesystem helpers compile without invoking a command shell", () => {
  const source = '(println (str-starts-with (shell-cwd) "/")) (println (shell-safe "printf" ["%s" "$(echo unsafe)"]))';
  expect(runGenerated(source)).toBe("true\n$(echo unsafe)\n");
});
