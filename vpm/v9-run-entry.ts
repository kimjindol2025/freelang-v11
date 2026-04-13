#!/usr/bin/env node
/**
 * FreeLang v9 Runtime Entry Point
 * Phase 5d: .fl/.js/.ts 파일 실행
 *
 * 사용법:
 *   npx ts-node vpm/v9-run-entry.ts file.fl
 *   npx ts-node vpm/v9-run-entry.ts file.js
 *   npx ts-node vpm/v9-run-entry.ts file.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function runFreeLang(filePath: string): void {
  try {
    const source = fs.readFileSync(filePath, 'utf8');
    const { lex } = require('../src/lexer');
    const { parse } = require('../src/parser');
    const { Interpreter } = require('../src/interpreter');

    const tokens = lex(source);
    const ast = parse(tokens);
    const interp = new Interpreter();
    interp.currentFilePath = path.resolve(filePath);
    interp.interpret(ast);
  } catch (err: any) {
    console.error(`❌ Error running ${filePath}:`, err.message);
    process.exit(1);
  }
}

function runJavaScript(filePath: string): void {
  try {
    require(path.resolve(filePath));
  } catch (err: any) {
    console.error(`❌ Error running ${filePath}:`, err.message);
    process.exit(1);
  }
}

function runTypeScript(filePath: string): void {
  try {
    execSync(`npx ts-node ${filePath}`, { stdio: 'inherit' });
  } catch (err: any) {
    console.error(`❌ Error running ${filePath}:`, err.message);
    process.exit(1);
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: v9-run <file.fl|file.js|file.ts>');
  process.exit(1);
}

const filePath = args[0];
const ext = path.extname(filePath).toLowerCase();

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

// 파일 확장자에 따라 적절한 실행기 선택
switch (ext) {
  case '.fl':
    runFreeLang(filePath);
    break;
  case '.js':
    runJavaScript(filePath);
    break;
  case '.ts':
    runTypeScript(filePath);
    break;
  default:
    console.error(`❌ Unsupported file type: ${ext}`);
    process.exit(1);
}
