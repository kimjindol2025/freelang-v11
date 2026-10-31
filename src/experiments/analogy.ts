// FreeLang v9 Analogy — 유사 패턴 추론
// Phase 117: AI가 새 문제를 만났을 때 유사한 패턴을 찾아 해법을 제안
// (analogy-store "pattern" solution tags)
// (analogy-find "problem" topK) → 유사 패턴 리스트
// (analogy-apply "problem" fn) → 가장 유사한 패턴의 해법 적용

export interface Pattern {
  id: string;
  description: string;
  solution: any;
  tags: string[];
  useCount: number;
  similarity?: number;  // 조회 시 채움
}

// 간단한 텍스트 유사도 (TF 기반)
export function similarity(a: string, b: string): number {
  const tokA = new Set(a.toLowerCase().split(/\s+/));
  const tokB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...tokA].filter(t => tokB.has(t)).length;
  if (intersection === 0) return 0;
  return intersection / Math.sqrt(tokA.size * tokB.size);
}

export class AnalogyStore {
  private patterns: Pattern[] = [];
  private counter = 0;

  // 패턴 저장
  store(description: string, solution: any, tags: string[] = []): Pattern {
    const p: Pattern = {
      id: `pattern-${++this.counter}`,
      description,
      solution,
      tags,
      useCount: 0
    };
    this.patterns.push(p);
    return p;
  }

  // 유사 패턴 찾기
  find(problem: string, topK = 3): Pattern[] {
    return this.patterns
      .map(p => ({
        ...p,
        similarity: similarity(problem, p.description) +
          p.tags.filter(t => problem.toLowerCase().includes(t)).length * 0.1
      }))
      .filter(p => (p.similarity ?? 0) > 0)
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, topK);
  }

  // 가장 유사한 패턴 1개
  best(problem: string): Pattern | null {
    const results = this.find(problem, 1);
    if (results.length === 0) return null;
    const found = this.patterns.find(p => p.id === results[0].id);
    if (found) found.useCount++;
    return results[0];
  }

  // 태그로 검색
  byTag(tag: string): Pattern[] {
    return this.patterns.filter(p => p.tags.includes(tag));
  }

  // 자주 쓰인 패턴
  popular(n = 3): Pattern[] {
    return [...this.patterns].sort((a, b) => b.useCount - a.useCount).slice(0, n);
  }

  size(): number { return this.patterns.length; }
  all(): Pattern[] { return [...this.patterns]; }
}

export const globalAnalogy = new AnalogyStore();
