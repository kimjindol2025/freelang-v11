#!/usr/bin/env node
/**
 * FreeLang v9 Build System Entry Point
 * Phase 5c: tsc 래퍼 (현재 단계), 향후 순수 v9 컴파일러로 전환
 *
 * 사용법:
 *   npx ts-node vpm/v9-build-entry.ts
 */

import { execSync } from 'child_process';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '..');

try {
  console.log('🔨 Building with TypeScript...');

  // 현재 단계: tsc 사용
  // TODO Phase 5c+: 순수 v9 컴파일러로 대체
  const result = execSync('npx tsc --noEmit false', {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  console.log('✅ Build completed successfully');
  process.exit(0);
} catch (err: any) {
  console.error('❌ Build failed:', err.message);
  process.exit(1);
}
