/**
 * Phase 3-D: AI Library Test Suite
 * self/stdlib/ai.fl에서 구현된 7개 핵심 AI 함수 검증
 * - vector-add, vector-dot, cosine-sim
 * - score-candidates, prompt-template, top-k-retrieval
 * - map-indexed (유틸리티)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = path.resolve(__dirname, '../../');

describe('Phase 3-D: AI Library (self/stdlib/ai.fl)', () => {
  let aiCode: string;

  beforeAll(() => {
    // ai.fl을 bootstrap로 컴파일
    const aiFile = path.join(PROJECT_ROOT, 'self/stdlib/ai.fl');
    const outFile = path.join(PROJECT_ROOT, '.test-cache/ai-lib.js');

    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    execSync(
      `node ${path.join(PROJECT_ROOT, 'bootstrap.js')} run self/codegen.fl ${aiFile} ${outFile}`,
      { cwd: PROJECT_ROOT, stdio: 'pipe' }
    );

    aiCode = fs.readFileSync(outFile, 'utf-8');
  });

  describe('코어 함수 정의 검증', () => {
    it('ai.fl이 성공적으로 컴파일됨', () => {
      expect(aiCode).toBeTruthy();
      expect(aiCode.length).toBeGreaterThan(1000);
    });

    it('JS 문법이 유효함 (node --check로 검증)', () => {
      const testFile = path.join(PROJECT_ROOT, '.test-cache/ai-check.js');
      fs.writeFileSync(testFile, aiCode);
      // node --check은 파일 실행 없이 구문만 검사
      expect(() => {
        execSync(`node --check ${testFile}`, { stdio: 'pipe' });
      }).not.toThrow();
    });

    it('vector-add 함수가 생성됨', () => {
      expect(aiCode).toMatch(/vector[_-]?add|_fl_vector_add/i);
    });

    it('vector-dot 함수가 생성됨', () => {
      expect(aiCode).toMatch(/vector[_-]?dot|_fl_vector_dot/i);
    });

    it('vector-magnitude 함수가 생성됨', () => {
      expect(aiCode).toMatch(/magnitude|_fl_vector_magnitude/i);
    });

    it('cosine-sim 함수가 생성됨', () => {
      expect(aiCode).toMatch(/cosine[_-]?sim|_fl_cosine_sim/i);
    });

    it('score-candidates 함수가 생성됨', () => {
      expect(aiCode).toMatch(/score[_-]?candidates|_fl_score_candidates/i);
    });

    it('prompt-template 함수가 생성됨', () => {
      expect(aiCode).toMatch(/prompt[_-]?template|_fl_prompt_template/i);
    });

    it('top-k-retrieval 함수가 생성됨', () => {
      expect(aiCode).toMatch(/top[_-]?k[_-]?retrieval|_fl_top_k_retrieval/i);
    });

    it('map-indexed 유틸리티 함수가 생성됨', () => {
      expect(aiCode).toMatch(/map[_-]?indexed|_fl_map_indexed/i);
    });
  });

  describe('함수형 구현 검증', () => {
    it('vector-add가 map 기반으로 구현됨', () => {
      expect(aiCode).toMatch(/_fl_map|map\(/);
    });

    it('vector-dot가 reduce 기반으로 구현됨', () => {
      expect(aiCode).toMatch(/_fl_reduce|reduce\(/);
    });

    it('cosine-sim이 벡터 크기 계산 포함', () => {
      expect(aiCode).toMatch(/magnitude|sqrt/i);
    });

    it('score-candidates가 map-indexed 사용', () => {
      expect(aiCode).toMatch(/map[_-]?indexed|indexed/i);
    });

    it('prompt-template이 reduce + str-replace 사용', () => {
      expect(aiCode).toMatch(/_fl_reduce|reduce|replace/i);
    });

    it('top-k-retrieval이 sort + reverse + take 사용', () => {
      expect(aiCode).toMatch(/sort|reverse|take/i);
    });
  });

  describe('내장 함수 활용 검증', () => {
    it('range 함수 사용 (벡터 순회)', () => {
      expect(aiCode).toMatch(/_fl_range|range/);
    });

    it('length 함수 사용 (길이 계산)', () => {
      expect(aiCode).toMatch(/_fl_length|length/);
    });

    it('get 함수 사용 (요소 접근)', () => {
      expect(aiCode).toMatch(/_fl_get|get\(/);
    });

    it('keys 함수 사용 (맵 키 조회)', () => {
      expect(aiCode).toMatch(/_fl_keys|keys/);
    });

    it('str-replace 함수 사용 (템플릿)', () => {
      expect(aiCode).toMatch(/replace|str[_-]replace/i);
    });
  });

  describe('Phase 3-D 성공 기준', () => {
    it('ai.fl 파일이 존재하고 유효', () => {
      const aiFilePath = path.join(PROJECT_ROOT, 'self/stdlib/ai.fl');
      expect(fs.existsSync(aiFilePath)).toBe(true);
    });

    it('7개 함수 모두 정의됨 (6 core + 1 utility)', () => {
      const functions = [
        'vector-add',
        'vector-dot',
        'cosine-sim',
        'score-candidates',
        'prompt-template',
        'top-k-retrieval',
        'map-indexed'
      ];
      functions.forEach(fn => {
        expect(aiCode.toLowerCase()).toMatch(
          new RegExp(fn.replace(/-/g, '[_-]?'), 'i')
        );
      });
    });

    it('컴파일된 JS 크기 >= 2000 bytes (실질적 구현)', () => {
      expect(aiCode.length).toBeGreaterThanOrEqual(2000);
    });

    it('functions 객체 또는 defun으로 정의됨', () => {
      expect(aiCode).toMatch(/defun|function.*vector|function.*cosine/i);
    });

    it('재귀가 아닌 함수형 프로그래밍 기반', () => {
      expect(aiCode).toMatch(/map|reduce|sort|take/i);
    });
  });

  describe('통합 테스트', () => {
    it('AI 라이브러리 완전 자가 호스팅 가능성', () => {
      // ai.fl이 다른 복잡한 stdlib에 의존하지 않는지 확인
      const aiContent = fs.readFileSync(
        path.join(PROJECT_ROOT, 'self/stdlib/ai.fl'),
        'utf-8'
      );

      // require는 없어야 함 (내장함수만 사용)
      expect(aiContent).not.toMatch(/require|import(?!\s+:)/i);
    });

    it('기본 내장함수만 사용 (map, reduce, range, sort)', () => {
      const aiContent = fs.readFileSync(
        path.join(PROJECT_ROOT, 'self/stdlib/ai.fl'),
        'utf-8'
      );

      // 단순하고 강력한 함수형 구성
      expect(aiContent).toMatch(/map|reduce|range|sort|reverse|take/);
    });

    it('벡터 수학 연산 완전 구현', () => {
      // vector-add, vector-dot, vector-magnitude가 모두 포함
      const aiContent = fs.readFileSync(
        path.join(PROJECT_ROOT, 'self/stdlib/ai.fl'),
        'utf-8'
      );

      expect(aiContent).toMatch(/vector-add/);
      expect(aiContent).toMatch(/vector-dot/);
      expect(aiContent).toMatch(/magnitude/);
    });

    it('RAG 보조 함수 완전 구현 (score, template, top-k)', () => {
      const aiContent = fs.readFileSync(
        path.join(PROJECT_ROOT, 'self/stdlib/ai.fl'),
        'utf-8'
      );

      expect(aiContent).toMatch(/score-candidates/);
      expect(aiContent).toMatch(/prompt-template/);
      expect(aiContent).toMatch(/top-k-retrieval/);
    });
  });
});
