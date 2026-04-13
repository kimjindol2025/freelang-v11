#!/usr/bin/env node
/**
 * FreeLang v9 Package Manager Entry Point
 * Phase 5b: v9-pm.fl 실행 래퍼
 *
 * 사용법:
 *   npx ts-node vpm/v9-pm-entry.ts install [package@version]
 *   npx ts-node vpm/v9-pm-entry.ts install  (dependencies from package.json)
 */

import * as fs from 'fs';
import * as path from 'path';
import { lex } from '../src/lexer';
import { parse } from '../src/parser';
import { interpret } from '../src/interpreter';

function runSource(source: string, filePath: string): void {
  try {
    const tokens = lex(source);
    const ast = parse(tokens);
    const interp = new (require('../src/interpreter').Interpreter)();
    interp.currentFilePath = path.resolve(filePath);

    // Pass CLI arguments via process.argv (v9 코드에서 (process_argv) 로 접근)
    interp.interpret(ast);

  } catch (err: any) {
    console.error(`Error in v9-pm:`, err.message);
    process.exit(1);
  }
}

// v9-pm.fl 경로
const pmScriptPath = path.resolve(__dirname, 'v9-pm.fl');

if (!fs.existsSync(pmScriptPath)) {
  console.error(`❌ v9-pm.fl not found at ${pmScriptPath}`);
  process.exit(1);
}

// v9-pm.fl 실행
const source = fs.readFileSync(pmScriptPath, 'utf8');
runSource(source, pmScriptPath);
