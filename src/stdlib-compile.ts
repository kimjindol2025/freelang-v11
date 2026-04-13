// FreeLang v9: Compilation Standard Library
// Phase 6: Pure v9 compiler (.fl → .js)

import * as fs from "fs";
import * as path from "path";
import { lex } from "./lexer";
import { parse } from "./parser";
import { JSCodegen } from "./codegen-js";

/**
 * Create the compilation module for FreeLang
 * Provides: fl_compile_file, fl_compile, fl_compile_result_ok
 *
 * Replaces: (shell_run "npx tsc") from v9-build.fl
 */
export function createCompileModule() {
  const cg = new JSCodegen();

  return {
    // fl_compile_file(inputPath, outputPath) → boolean
    // Compile a single .fl file to JavaScript
    "fl_compile_file": (inputPath: string, outputPath: string): boolean => {
      try {
        // 1. Read source
        const source = fs.readFileSync(inputPath, "utf-8");

        // 2. Lex → Parse
        const tokens = lex(source);
        const ast = parse(tokens);

        // 3. Generate JavaScript
        const js = cg.generate(ast, {
          module: "commonjs",
          runtime: false,
          minify: false,
          target: "node",
        });

        // 4. Ensure parent directory exists
        const dir = path.dirname(outputPath);
        if (dir !== "." && !fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // 5. Write output
        fs.writeFileSync(outputPath, js, "utf-8");
        return true;
      } catch (err: any) {
        throw new Error(`fl_compile_file failed for '${inputPath}': ${err.message}`);
      }
    },

    // fl_compile(srcDir, distDir) → { compiled: number, failed: number, errors: string[] }
    // Compile all .fl files in a directory
    "fl_compile": (srcDir: string, distDir: string): Record<string, any> => {
      try {
        const absDir = path.resolve(srcDir);
        const absOut = path.resolve(distDir);

        // Find all .fl files
        const files = fs
          .readdirSync(absDir)
          .filter((f) => f.endsWith(".fl"))
          .map((f) => path.join(absDir, f));

        let compiled = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const file of files) {
          const outFile = path.join(absOut, path.basename(file, ".fl") + ".js");
          try {
            // Inline compile logic for each file
            const source = fs.readFileSync(file, "utf-8");
            const tokens = lex(source);
            const ast = parse(tokens);
            const js = cg.generate(ast, {
              module: "commonjs",
              runtime: false,
              minify: false,
              target: "node",
            });

            // Create output directory
            const dir = path.dirname(outFile);
            if (dir !== "." && !fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            // Write output
            fs.writeFileSync(outFile, js, "utf-8");
            compiled++;
          } catch (err: any) {
            failed++;
            errors.push(`${path.basename(file)}: ${err.message}`);
          }
        }

        return { compiled, failed, errors };
      } catch (err: any) {
        throw new Error(`fl_compile failed for '${srcDir}': ${err.message}`);
      }
    },

    // fl_compile_result_ok(result) → boolean
    // Check if compilation result is successful (no failures)
    "fl_compile_result_ok": (result: Record<string, any>): boolean => {
      return result.failed === 0;
    },
  };
}
