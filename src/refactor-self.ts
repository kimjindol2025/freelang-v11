// refactor-self.ts — FreeLang v9 Phase 137: [REFACTOR-SELF] 자기 코드 리팩토링
// AI가 자신의 코드/로직을 감지하고 자동으로 리팩토링하는 시스템

export type RefactorPattern =
  | 'extract-duplicate'    // 중복 코드 추출
  | 'simplify-condition'   // 복잡한 조건문 단순화
  | 'flatten-nesting'      // 중첩 감소
  | 'rename-unclear'       // 불명확한 이름 변경
  | 'split-long-function'  // 긴 함수 분리
  | 'inline-single-use';   // 단일 사용 변수 인라인

export interface RefactorSuggestion {
  pattern: RefactorPattern;
  location: string;        // 코드 위치 설명
  original: string;        // 원본 코드 스니펫
  suggested: string;       // 제안 코드
  reason: string;          // 리팩토링 이유
  impact: 'low' | 'medium' | 'high'; // 개선 영향도
}

export interface RefactorResult {
  suggestions: RefactorSuggestion[];
  applied: number;         // 자동 적용된 수
  skipped: number;         // 건너뛴 수 (확신 낮음)
  score: {
    before: number;        // 리팩토링 전 품질
    after: number;         // 리팩토링 후 품질
    improvement: number;   // 개선율
  };
}

// 중복 코드 블록 감지 결과
interface DuplicateBlock {
  snippet: string;
  occurrences: number;
  lines: number[];
}

// 명명 분석 이슈
interface NamingIssue {
  name: string;
  suggestion: string;
  reason: string;
}

// 복잡도 분석 결과
interface ComplexityResult {
  lines: number;
  depth: number;           // 최대 중첩 깊이
  conditions: number;
  score: number;           // 복잡도 점수 (낮을수록 좋음)
}

// 명명 분석 결과
interface NamingResult {
  issues: NamingIssue[];
  score: number;
}

// 불명확한 이름 패턴 (단일/이중 문자 이름, 임시 변수)
const UNCLEAR_NAME_PATTERNS = [
  /\b([a-z])\b/g,                    // 단일 문자 변수 (i, j, k 제외)
  /\b(tmp|temp|foo|bar|baz|x|y|z|xx|yy)\b/g,  // 임시/임의 이름
  /\b(val|var|obj|arr|str|num|fn|cb)\b/g,      // 너무 짧은 약어
];

const ALLOWED_SHORT_NAMES = new Set(['i', 'j', 'k', 'n', 'm', 'e', 'a', 'b', 'c']);

export class SelfRefactorer {
  /**
   * 중복 코드 블록 감지
   */
  findDuplicates(code: string): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];
    const lines = code.split('\n').filter(l => l.trim().length > 3);

    // 연속 2줄 이상의 블록을 비교
    const blockSize = 2;
    const seen = new Map<string, number[]>();

    for (let i = 0; i <= lines.length - blockSize; i++) {
      const block = lines.slice(i, i + blockSize).join('\n').trim();
      if (block.length < 10) continue; // 너무 짧은 블록 무시

      if (!seen.has(block)) {
        seen.set(block, [i]);
      } else {
        const prev = seen.get(block)!;
        prev.push(i);
        seen.set(block, prev);
      }
    }

    for (const [block, lineNums] of seen.entries()) {
      if (lineNums.length >= 2) {
        const impact: 'low' | 'medium' | 'high' =
          block.length > 100 ? 'high' : block.length > 40 ? 'medium' : 'low';
        suggestions.push({
          pattern: 'extract-duplicate',
          location: `lines ${lineNums.map(l => l + 1).join(', ')}`,
          original: block,
          suggested: `function extractedBlock() {\n  ${block.split('\n').join('\n  ')}\n}`,
          reason: `동일 코드가 ${lineNums.length}곳에서 반복됨 — 함수로 추출하면 유지보수성 향상`,
          impact,
        });
      }
    }

    return suggestions;
  }

  /**
   * 복잡도 분석
   */
  analyzeComplexity(code: string): ComplexityResult {
    const lines = code.split('\n');
    const totalLines = lines.filter(l => l.trim().length > 0).length;

    // 중첩 깊이 계산
    let maxDepth = 0;
    let currentDepth = 0;
    for (const line of lines) {
      const opens = (line.match(/[\(\[\{]/g) || []).length;
      const closes = (line.match(/[\)\]\}]/g) || []).length;
      currentDepth += opens - closes;
      if (currentDepth > maxDepth) maxDepth = currentDepth;
      if (currentDepth < 0) currentDepth = 0;
    }

    // 조건문 수 계산
    const conditionPatterns = [
      /\bif\b/g, /\belse\b/g, /\bcond\b/g, /\bwhen\b/g,
      /\bcase\b/g, /\bswitch\b/g, /\?\s/g, /\band\b/g, /\bor\b/g,
    ];
    let conditions = 0;
    for (const pattern of conditionPatterns) {
      const matches = code.match(pattern);
      if (matches) conditions += matches.length;
    }

    // 복잡도 점수: 줄수 + 중첩*10 + 조건*3
    const score = Math.round(totalLines * 0.5 + maxDepth * 10 + conditions * 3);

    return { lines: totalLines, depth: maxDepth, conditions, score };
  }

  /**
   * 리팩토링 제안 생성
   */
  suggest(code: string): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];

    // 1. 중복 감지
    suggestions.push(...this.findDuplicates(code));

    // 2. 복잡도 기반 제안
    const complexity = this.analyzeComplexity(code);

    if (complexity.depth > 5) {
      suggestions.push({
        pattern: 'flatten-nesting',
        location: 'high nesting area',
        original: `(depth=${complexity.depth} nesting detected)`,
        suggested: `; 중첩된 조건문을 early-return 또는 guard clause로 분리`,
        reason: `중첩 깊이 ${complexity.depth} — 5 이하 권장`,
        impact: 'high',
      });
    }

    if (complexity.conditions > 10) {
      suggestions.push({
        pattern: 'simplify-condition',
        location: 'multiple condition branches',
        original: `(${complexity.conditions} conditions found)`,
        suggested: `; 조건을 named predicate 함수로 추출하여 단순화`,
        reason: `조건문 ${complexity.conditions}개 — 과도한 분기로 가독성 저하`,
        impact: complexity.conditions > 20 ? 'high' : 'medium',
      });
    }

    // 3. 긴 함수 감지
    const lines = code.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 30) {
      suggestions.push({
        pattern: 'split-long-function',
        location: 'function body',
        original: `(${lines.length} lines in function)`,
        suggested: `; 함수를 논리적 단위로 분리: 검증 / 변환 / 출력`,
        reason: `함수 길이 ${lines.length}줄 — 30줄 이하 권장`,
        impact: lines.length > 60 ? 'high' : 'medium',
      });
    }

    // 4. 명명 분석
    const naming = this.analyzeNaming(code);
    for (const issue of naming.issues) {
      suggestions.push({
        pattern: 'rename-unclear',
        location: `variable: ${issue.name}`,
        original: issue.name,
        suggested: issue.suggestion,
        reason: issue.reason,
        impact: 'low',
      });
    }

    // 5. 단일 사용 변수 인라인 감지
    const singleUsePattern = /\(let \$(\w+) ([^\n]+)\)\s*\n[^\n]*\$\1[^\n]*\n(?![^\n]*\$\1)/g;
    let match;
    while ((match = singleUsePattern.exec(code)) !== null) {
      const varName = match[1];
      const varValue = match[2].trim();
      if (varValue.length < 30) {
        suggestions.push({
          pattern: 'inline-single-use',
          location: `variable $${varName}`,
          original: `(let $${varName} ${varValue})`,
          suggested: `; $${varName} 인라인 — 변수 선언 제거`,
          reason: `$${varName}은 한 번만 사용됨 — 인라인으로 단순화`,
          impact: 'low',
        });
      }
    }

    return suggestions;
  }

  /**
   * 자동 리팩토링 적용 (확신도 높은 것만 적용)
   */
  apply(code: string, suggestions: RefactorSuggestion[]): { code: string; applied: RefactorSuggestion[] } {
    let result = code;
    const applied: RefactorSuggestion[] = [];

    for (const s of suggestions) {
      // high impact & 단순 패턴만 자동 적용
      if (s.impact === 'high' && s.pattern === 'rename-unclear') {
        // 명확한 이름 변경은 자동 적용
        if (s.original && s.suggested && !s.suggested.startsWith(';')) {
          const before = result;
          result = result.replace(new RegExp(`\\b${s.original}\\b`, 'g'), s.suggested);
          if (result !== before) {
            applied.push(s);
          }
        }
      }
      // 기타 패턴은 주석으로 제안만 추가 (실제 코드 변경 없이)
    }

    return { code: result, applied };
  }

  /**
   * 코드 품질 점수 (0~1, 높을수록 좋음)
   */
  qualityScore(code: string): number {
    const complexity = this.analyzeComplexity(code);
    const naming = this.analyzeNaming(code);
    const duplicates = this.findDuplicates(code);

    // 복잡도 페널티 (최대 100점)
    const complexityPenalty = Math.min(complexity.score / 100, 1);
    // 명명 점수 (0~1)
    const namingScore = naming.score;
    // 중복 페널티
    const dupPenalty = Math.min(duplicates.length * 0.1, 0.5);

    // 종합 점수
    const raw = (1 - complexityPenalty) * 0.5 + namingScore * 0.3 + (1 - dupPenalty) * 0.2;
    return Math.max(0, Math.min(1, Math.round(raw * 100) / 100));
  }

  /**
   * 명명 규칙 분석
   */
  analyzeNaming(code: string): NamingResult {
    const issues: NamingIssue[] = [];
    const found = new Set<string>();

    // 불명확한 이름 탐지
    for (const pattern of UNCLEAR_NAME_PATTERNS) {
      const regex = new RegExp(pattern.source, 'g');
      let match;
      while ((match = regex.exec(code)) !== null) {
        const name = match[1] || match[0];
        if (ALLOWED_SHORT_NAMES.has(name)) continue;
        if (found.has(name)) continue;
        found.add(name);

        let suggestion = name;
        let reason = '';

        if (/^[a-z]$/.test(name)) {
          suggestion = `${name}Value`;
          reason = `단일 문자 변수 — 의미를 담은 이름 사용 권장`;
        } else if (['tmp', 'temp'].includes(name)) {
          suggestion = 'temporaryResult';
          reason = `'${name}'은 목적이 불명확한 임시 변수명`;
        } else if (['foo', 'bar', 'baz'].includes(name)) {
          suggestion = 'meaningfulName';
          reason = `'${name}'은 placeholder명 — 실제 의미를 담은 이름 사용`;
        } else if (['val', 'var', 'obj', 'arr', 'str', 'num', 'fn', 'cb'].includes(name)) {
          suggestion = name + 'Result';
          reason = `타입을 이름으로 쓰는 것은 불명확 — 역할/목적을 담은 이름 권장`;
        } else if (['x', 'y', 'z', 'xx', 'yy'].includes(name)) {
          suggestion = `${name}Coordinate`;
          reason = `수학적 좌표가 아닌 경우 의미있는 이름 권장`;
        }

        if (suggestion !== name) {
          issues.push({ name, suggestion, reason });
        }
      }
    }

    // 명명 점수: 이슈가 없을수록 높은 점수
    const score = issues.length === 0 ? 1.0 : Math.max(0, 1 - issues.length * 0.1);

    return { issues, score: Math.round(score * 100) / 100 };
  }

  /**
   * 전체 리팩토링 파이프라인
   */
  refactor(code: string, autoApply: boolean = true): RefactorResult {
    const scoreBefore = this.qualityScore(code);
    const suggestions = this.suggest(code);

    let applied = 0;
    let skipped = 0;

    let resultCode = code;

    if (autoApply) {
      const applyResult = this.apply(code, suggestions);
      resultCode = applyResult.code;
      applied = applyResult.applied.length;
      skipped = suggestions.length - applied;
    } else {
      skipped = suggestions.length;
    }

    const scoreAfter = autoApply ? this.qualityScore(resultCode) : scoreBefore;
    const improvement = scoreBefore > 0
      ? Math.round(((scoreAfter - scoreBefore) / scoreBefore) * 100 * 100) / 100
      : 0;

    return {
      suggestions,
      applied,
      skipped,
      score: {
        before: scoreBefore,
        after: scoreAfter,
        improvement,
      },
    };
  }
}

// 싱글톤 인스턴스
export const globalRefactorer = new SelfRefactorer();
