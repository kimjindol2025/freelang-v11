// FreeLang v9 RAG — Retrieval-Augmented Generation
// Phase 102: [RAG :query "..." :docs [...] :top 3 :augment fn]

export interface RAGDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  score?: number;
}

export interface RAGResult {
  query: string;
  retrieved: RAGDocument[];
  augmented: string;
}

// TF-IDF 기반 유사도 (외부 라이브러리 불필요)
export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, '').split(/\s+/).filter(Boolean);
}

export function tfidf(query: string[], doc: string[]): number {
  const docSet = new Set(doc);
  const overlap = query.filter(t => docSet.has(t)).length;
  if (overlap === 0) return 0;
  return overlap / (Math.sqrt(query.length) * Math.sqrt(doc.length));
}

export class RAGStore {
  private docs: RAGDocument[] = [];

  // 문서 추가
  add(doc: RAGDocument): void {
    this.docs.push(doc);
  }

  addMany(docs: RAGDocument[]): void {
    docs.forEach(d => this.add(d));
  }

  // 검색
  retrieve(query: string, topK: number = 3): RAGDocument[] {
    const queryTokens = tokenize(query);
    return this.docs
      .map(doc => ({
        ...doc,
        score: tfidf(queryTokens, tokenize(doc.content))
      }))
      .filter(d => (d.score ?? 0) > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, topK);
  }

  // RAG 실행: 검색 + augment 함수로 최종 응답 생성
  query(queryStr: string, options: {
    topK?: number;
    augment?: (query: string, docs: RAGDocument[]) => string;
  } = {}): RAGResult {
    const retrieved = this.retrieve(queryStr, options.topK ?? 3);
    const augmented = options.augment
      ? options.augment(queryStr, retrieved)
      : `Query: ${queryStr}\n\nContext:\n${retrieved.map(d => d.content).join('\n---\n')}`;
    return { query: queryStr, retrieved, augmented };
  }

  // 문서 삭제
  remove(id: string): boolean {
    const idx = this.docs.findIndex(d => d.id === id);
    if (idx === -1) return false;
    this.docs.splice(idx, 1);
    return true;
  }

  size(): number { return this.docs.length; }
  all(): RAGDocument[] { return [...this.docs]; }

  // 초기화
  clear(): void { this.docs = []; }
}

export const globalRAG = new RAGStore();
