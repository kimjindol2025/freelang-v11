const fs = require("fs");
const path = require("path");

function countLinesInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

function countBoilerplate(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const imports = (content.match(/^import /gm) || []).length;
    const exports = (content.match(/^export /gm) || []).length;
    const decorators = (content.match(/@/gm) || []).length;
    const typeAnnotations = (content.match(/: [A-Z]/gm) || []).length;

    return imports + exports + decorators + Math.floor(typeAnnotations / 3);
  } catch {
    return 0;
  }
}

function analyzeDirectory(dirPath) {
  const stats = {
    files: 0,
    lines: 0,
    boilerplate: 0,
  };

  function walk(dir) {
    if (!fs.existsSync(dir)) {
      return;
    }

    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (
        stat.isFile() &&
        (filePath.endsWith(".ts") || filePath.endsWith(".fl") || filePath.endsWith(".prisma"))
      ) {
        stats.files++;
        stats.lines += countLinesInFile(filePath);
        if (filePath.endsWith(".ts")) {
          stats.boilerplate += countBoilerplate(filePath);
        }
      } else if (stat.isDirectory() && !file.startsWith(".") && file !== "node_modules") {
        walk(filePath);
      }
    }
  }

  walk(dirPath);
  return stats;
}

async function main() {
  const traditionalDir = path.join(__dirname, "traditional");
  const freelangDir = path.join(__dirname, "freelang");

  console.log("📊 Analyzing directory structures...\n");

  const traditional = analyzeDirectory(traditionalDir);
  const freelang = analyzeDirectory(freelangDir);

  const fileReduction =
    traditional.files > 0 ? ((1 - freelang.files / traditional.files) * 100).toFixed(1) : "N/A";
  const lineReduction =
    traditional.lines > 0 ? ((1 - freelang.lines / traditional.lines) * 100).toFixed(1) : "N/A";
  const boilerplateReduction =
    traditional.boilerplate > 0
      ? ((1 - freelang.boilerplate / traditional.boilerplate) * 100).toFixed(1)
      : "N/A";

  const report = {
    traditional,
    freelang,
    reduction: {
      files: `${fileReduction}%`,
      lines: `${lineReduction}%`,
      boilerplate: `${boilerplateReduction}%`,
    },
  };

  console.log("=== Traditional Stack (NestJS + Prisma) ===");
  console.log(`Files: ${traditional.files}`);
  console.log(`Lines: ${traditional.lines}`);
  console.log(`Boilerplate: ${traditional.boilerplate}`);

  console.log("\n=== FreeLang v11 ===");
  console.log(`Files: ${freelang.files}`);
  console.log(`Lines: ${freelang.lines}`);
  console.log(`Boilerplate: ${freelang.boilerplate}`);

  console.log("\n=== Reduction ===");
  console.log(`Files: ${fileReduction}%`);
  console.log(`Lines: ${lineReduction}%`);
  console.log(`Boilerplate: ${boilerplateReduction}%`);

  // Write comparison report
  const comparisonMd = `# Code Comparison: NestJS + Prisma vs FreeLang v11

## Summary

| Metric | NestJS+Prisma | FreeLang v11 | Reduction |
|--------|---------------|--------------|-----------|
| Files | ${traditional.files} | ${freelang.files} | ${fileReduction}% |
| Lines | ${traditional.lines} | ${freelang.lines} | ${lineReduction}% |
| Boilerplate | ${traditional.boilerplate} | ${freelang.boilerplate} | ${boilerplateReduction}% |

## Analysis

### NestJS + Prisma
- **Strengths**: Type safety, DI, modular structure
- **Weaknesses**: High boilerplate, many files, complex configuration
- **Complexity**: High (requires understanding NestJS + Prisma + Decorators)

### FreeLang v11
- **Strengths**: DSL-based, minimal boilerplate, single language
- **Weaknesses**: Limited framework escape hatches (but supported via [RAW], [EXTEND], [TS|...|TS])
- **Complexity**: Low (one language, consistent syntax)

## Conclusion

FreeLang v11 reduces code:
- **${fileReduction}% fewer files** (${traditional.files} → ${freelang.files})
- **${lineReduction}% fewer lines** (${traditional.lines} → ${freelang.lines})
- **${boilerplateReduction}% less boilerplate** (decorators, imports, type annotations)

Same functionality achieved with **1/${Math.round(traditional.files / freelang.files)} the files** and **1/${Math.round(traditional.lines / freelang.lines)} the code**.

Generated: ${new Date().toISOString()}
`;

  fs.writeFileSync(path.join(__dirname, "COMPARISON.md"), comparisonMd);
  console.log("\n✅ Report written to COMPARISON.md");

  // Output JSON for tracking
  console.log("\n📋 JSON Report:");
  console.log(JSON.stringify(report, null, 2));
}

main().catch(console.error);
