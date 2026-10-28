/**
 * ai-run P2 Integration Tests
 *
 * Validates the ai-run block in bootstrap.js:
 *  - Structured JSON contract on all paths (status in {SUCCESS,FAILURE,BLOCKED})
 *  - Provider-unavailable returns BLOCKED with truthfully SKIP'd verification
 *  - Missing --input file returns BLOCKED with E_AI_INPUT_NOT_FOUND
 *  - Valid syntax without execution returns BLOCKED with E_AI_RUN_INCOMPLETE,
 *    empty stdout, syntax PASS, runtime/verifier/authority SKIP
 *  - Malformed syntax returns FAILURE with syntax FAIL, other unrun checks SKIP
 *  - authorityCheck is keyword-scanning only: SKIP for non-matches, FAIL for risky content
 *  - Candidate source is never returned in stdout
 *  - All paths carry the required keys: status, exit_code, stdout, stderr,
 *    evidence_id, attempt, verification
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

const BOOTSTRAP = path.resolve(__dirname, '../../bootstrap.js');
const NODE_BIN = process.execPath;

type AiRunResult = {
  status: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  evidence_id: string;
  attempt: number;
  verification: {
    syntax: string;
    authority: string;
    runtime: string;
    verifier: string;
  };
};

function aiRun(
  request: string,
  opts: { env?: NodeJS.ProcessEnv } = {}
): { result: AiRunResult; exitCode: number } {
  const result = spawnSync(NODE_BIN, [BOOTSTRAP, 'ai-run', request], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      NODE_PATH: path.resolve(__dirname, '../../node_modules'),
      ...opts.env,
    },
    encoding: 'utf-8',
  });
  const stdout = (result.stdout || '').trim();
  const exitCode = result.status ?? 1;
  return { result: JSON.parse(stdout), exitCode };
}

function aiRunArgs(
  args: string[],
  opts: { env?: NodeJS.ProcessEnv } = {}
): { result: AiRunResult; exitCode: number } {
  const result = spawnSync(NODE_BIN, [BOOTSTRAP, 'ai-run', ...args], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      NODE_PATH: path.resolve(__dirname, '../../node_modules'),
      ...opts.env,
    },
    encoding: 'utf-8',
  });
  const stdout = (result.stdout || '').trim();
  const exitCode = result.status ?? 1;
  return { result: JSON.parse(stdout), exitCode };
}

const REQUIRED_KEYS = [
  'status', 'exit_code', 'stdout', 'stderr',
  'evidence_id', 'attempt', 'verification',
] as const;

function hasAllKeys(obj: Record<string, unknown>): boolean {
  return REQUIRED_KEYS.every((k) => k in obj);
}

function hasVerificationKeys(v: Record<string, unknown>): boolean {
  return ['syntax', 'authority', 'runtime', 'verifier'].every((k) => k in v);
}

describe('ai-run P2 structured JSON contract', () => {
  describe('consistent JSON shape on every outcome', () => {
    test('provider-unavailable output has all required keys', () => {
      const { result } = aiRun('(+ 1 2)', {
        env: { FL_AI_PROVIDER: '' },
      });
      expect(hasAllKeys(result)).toBe(true);
      expect(hasVerificationKeys(result.verification)).toBe(true);
      expect(typeof result.evidence_id).toBe('string');
      expect(result.evidence_id).toMatch(/^run-\d{8}-\d+$/);
      expect(typeof result.attempt).toBe('number');
    });

    test('mock mode valid syntax output has all required keys', () => {
      const { result } = aiRun('(+ 1 2)', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(hasAllKeys(result)).toBe(true);
      expect(hasVerificationKeys(result.verification)).toBe(true);
    });

    test('mock mode malformed syntax output has all required keys', () => {
      const { result } = aiRun('(def broken', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(hasAllKeys(result)).toBe(true);
      expect(hasVerificationKeys(result.verification)).toBe(true);
    });
  });

  describe('provider-unavailable structured output', () => {
    test('returns BLOCKED with exit 1 and SKIP for runtime/verifier', () => {
      const { result, exitCode } = aiRun('(+ 1 2)', {
        env: { FL_AI_PROVIDER: '' },
      });
      expect(result.status).toBe('BLOCKED');
      expect(exitCode).toBe(1);
      expect(result.exit_code).toBe(1);
      expect(result.stderr).toContain('E_AI_PROVIDER_UNAVAILABLE');
      expect(result.verification.syntax).toBe('SKIP');
      expect(result.verification.runtime).toBe('SKIP');
      expect(result.verification.verifier).toBe('SKIP');
    });
  });

  describe('missing --input file', () => {
    test('returns BLOCKED with E_AI_INPUT_NOT_FOUND and exit 1', () => {
      const { result, exitCode } = aiRunArgs(
        ['--input', '/nonexistent/path/does-not-exist.fl'],
        { env: { FL_AI_PROVIDER: 'mock' } }
      );
      expect(exitCode).toBe(1);
      expect(result.status).toBe('BLOCKED');
      expect(result.exit_code).toBe(1);
      expect(result.stderr).toContain('E_AI_INPUT_NOT_FOUND');
      expect(result.verification.syntax).toBe('SKIP');
      expect(result.verification.runtime).toBe('SKIP');
      expect(result.verification.verifier).toBe('SKIP');
    });
  });

  describe('valid syntax without execution', () => {
    test('status is BLOCKED with exit 1 (not SUCCESS, not SYNTAX_OK)', () => {
      const { result, exitCode } = aiRun('(+ 1 2)', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(exitCode).toBe(1);
      expect(result.exit_code).toBe(1);
      expect(result.status).toBe('BLOCKED');
      expect(result.status).not.toBe('SUCCESS');
      expect(result.status).not.toBe('SYNTAX_OK');
    });

    test('stderr contains E_AI_RUN_INCOMPLETE', () => {
      const { result } = aiRun('(+ 1 2)', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.stderr).toContain('E_AI_RUN_INCOMPLETE');
    });

    test('stdout is empty (nothing executed)', () => {
      const { result } = aiRun('(+ 1 2)', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.stdout).toBe('');
    });

    test('source is not returned in the result', () => {
      const { result } = aiRun('(+ 1 2)', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      // The candidate source must not appear in stdout or any other field
      expect(result.stdout).not.toContain('(+ 1 2)');
    });

    test('syntax verification is PASS (actual lex+parse succeeded)', () => {
      const { result } = aiRun('(+ 1 2)', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.verification.syntax).toBe('PASS');
    });

    test('runtime and verifier are SKIP (no execution occurred)', () => {
      const { result } = aiRun('(+ 1 2)', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.verification.runtime).toBe('SKIP');
      expect(result.verification.verifier).toBe('SKIP');
    });

    test('authority is SKIP for non-risky content (keyword scan only)', () => {
      const { result } = aiRun('(+ 1 2)', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.verification.authority).toBe('SKIP');
    });
  });

  describe('malformed syntax', () => {
    test('returns FAILURE with syntax FAIL and exit 1', () => {
      const { result, exitCode } = aiRun('(def broken', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(exitCode).toBe(1);
      expect(result.status).toBe('FAILURE');
      expect(result.exit_code).toBe(1);
      expect(result.verification.syntax).toBe('FAIL');
    });

    test('runtime, verifier, authority are SKIP (unrun checks)', () => {
      const { result } = aiRun('(def broken', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.verification.runtime).toBe('SKIP');
      expect(result.verification.verifier).toBe('SKIP');
      expect(result.verification.authority).toBe('SKIP');
    });

    test('stderr contains parse error indicator', () => {
      const { result } = aiRun('(def broken', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.stderr).toContain('E_PARSE_SYNTAX_ERROR');
    });

    test('attempt is always 1 (no fake retries)', () => {
      const { result } = aiRun('(def broken', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.attempt).toBe(1);
    });

    test('no fake repair claims in stderr', () => {
      const { result } = aiRun('(def broken', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.stderr).not.toMatch(/repair/i);
      expect(result.stderr).not.toMatch(/retried/i);
    });
  });

  describe('candidate source is never mutated or echoed', () => {
    test('unclosed paren does not get brackets appended', () => {
      const input = '(+ 1 2';
      const { result } = aiRun(input, {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.stdout).not.toContain('] }');
      expect(result.stdout).not.toContain(')]}');
    });

    test('stdout is always empty in mock mode', () => {
      const { result } = aiRun('(+ 1 2)', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.stdout).toBe('');
    });
  });

  describe('authority check (keyword scanning only)', () => {
    test('high-risk content returns BLOCKED with authority FAIL', () => {
      const { result, exitCode } = aiRun('sudo rm -rf /', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(exitCode).toBe(1);
      expect(result.status).toBe('BLOCKED');
      expect(result.verification.authority).toBe('FAIL');
    });

    test('approval-missing content returns BLOCKED with authority FAIL', () => {
      const { result, exitCode } = aiRun('approv this deploy', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(exitCode).toBe(1);
      expect(result.status).toBe('BLOCKED');
      expect(result.verification.authority).toBe('FAIL');
    });

    test('scope-exceeded content returns BLOCKED with authority FAIL', () => {
      const { result, exitCode } = aiRun('범위 초과 권한', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(exitCode).toBe(1);
      expect(result.status).toBe('BLOCKED');
      expect(result.verification.authority).toBe('FAIL');
    });

    test('non-risky content does not trigger authority FAIL', () => {
      const { result } = aiRun('hello world', {
        env: { FL_AI_PROVIDER: 'mock' },
      });
      expect(result.verification.authority).not.toBe('FAIL');
      expect(result.verification.authority).toBe('SKIP');
    });
  });
});
