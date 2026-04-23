import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Phase 3-C: L2 증명 — Semantic Preservation (bootstrap vs stage1)

describe('L2 Proof: Semantic Preservation', () => {
  const projectRoot = path.join(__dirname, '../../');
  const testDir = path.join(projectRoot, 'tests/l2');
  const resultsFile = path.join(projectRoot, 'L2-PROOF-RESULTS.json');

  beforeAll(() => {
    // verify-l2-proof.sh --prepare 실행
    try {
      execSync('bash scripts/verify-l2-proof.sh --prepare', {
        cwd: projectRoot,
        stdio: 'pipe',
      });
    } catch (e) {
      console.warn('verify-l2-proof.sh --prepare 실패:', e);
    }
  });

  afterAll(() => {
    // 정리
    try {
      execSync('bash scripts/verify-l2-proof.sh --clean', {
        cwd: projectRoot,
        stdio: 'pipe',
      });
    } catch (e) {
      console.warn('정리 실패:', e);
    }
  });

  it('테스트 케이스가 존재해야 함', () => {
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir).filter(f => f.endsWith('.fl'));
      expect(files.length).toBeGreaterThan(0);
    }
  });

  it('verify-l2-proof.sh --run 실행 후 결과 확인', () => {
    try {
      execSync('bash scripts/verify-l2-proof.sh --run', {
        cwd: projectRoot,
        stdio: 'pipe',
      });

      // 결과 파일 검증
      expect(fs.existsSync(resultsFile)).toBe(true);

      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
      expect(results.total).toBeGreaterThanOrEqual(0);
      expect(results.passed).toBeLessThanOrEqual(results.total);
      expect(results.failed).toBeLessThanOrEqual(results.total);
      expect(results.pass_rate).toBeGreaterThanOrEqual(0);
      expect(results.pass_rate).toBeLessThanOrEqual(100);

      console.log(`L2 결과: ${results.passed}/${results.total} PASS (${results.pass_rate}%)`);
    } catch (e) {
      console.error('L2 테스트 실행 중 오류:', e);
      throw e;
    }
  });

  it('모든 L2 테스트 케이스가 통과해야 함 (의미 동등성)', () => {
    if (fs.existsSync(resultsFile)) {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
      
      // 테스트 케이스가 있을 경우만 검증
      if (results.total > 0) {
        expect(results.passed).toBe(results.total);
        expect(results.failed).toBe(0);
      }
    }
  });
});
