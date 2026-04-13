#!/usr/bin/env node
/**
 * FreeLang v9 Build System Entry Point
 * Phase 6: Pure v9 Compiler (tsc 제거 완료)
 *
 * 사용법:
 *   npx ts-node vpm/v9-build-entry.ts
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { lex } from '../src/lexer';
import { parse } from '../src/parser';
import { Interpreter } from '../src/interpreter';

const projectRoot = path.resolve(__dirname, '..');

try {
  console.log('🔨 Building with Pure v9 Compiler (Phase 6)...');

  // v9-build.fl 로드 및 실행 (Interpreter 기반)
  const buildScript = fs.readFileSync(path.join(__dirname, 'v9-build.fl'), 'utf-8');

  // Interpreter 설정
  const interp = new Interpreter();
  interp.currentFilePath = path.resolve(__dirname, 'v9-build.fl');

  // lex → parse → interpret
  const tokens = lex(buildScript);
  const ast = parse(tokens);
  const ctx = interp.interpret(ast);

  // 빌드 결과 확인
  if (ctx.lastValue === false) {
    console.error('❌ Build failed');
    process.exit(1);
  }

  console.log('✅ Build completed successfully (Pure v9)');
  process.exit(0);
} catch (err: any) {
  console.error('❌ Build failed:', err.message);
  process.exit(1);
}
