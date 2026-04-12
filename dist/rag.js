"use strict";
// FreeLang v9 RAG — Retrieval-Augmented Generation
// Phase 102: [RAG :query "..." :docs [...] :top 3 :augment fn]
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalRAG = exports.RAGStore = void 0;
exports.tokenize = tokenize;
exports.tfidf = tfidf;
// TF-IDF 기반 유사도 (외부 라이브러리 불필요)
function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, '').split(/\s+/).filter(Boolean);
}
function tfidf(query, doc) {
    const docSet = new Set(doc);
    const overlap = query.filter(t => docSet.has(t)).length;
    if (overlap === 0)
        return 0;
    return overlap / (Math.sqrt(query.length) * Math.sqrt(doc.length));
}
class RAGStore {
    constructor() {
        this.docs = [];
    }
    // 문서 추가
    add(doc) {
        this.docs.push(doc);
    }
    addMany(docs) {
        docs.forEach(d => this.add(d));
    }
    // 검색
    retrieve(query, topK = 3) {
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
    query(queryStr, options = {}) {
        const retrieved = this.retrieve(queryStr, options.topK ?? 3);
        const augmented = options.augment
            ? options.augment(queryStr, retrieved)
            : `Query: ${queryStr}\n\nContext:\n${retrieved.map(d => d.content).join('\n---\n')}`;
        return { query: queryStr, retrieved, augmented };
    }
    // 문서 삭제
    remove(id) {
        const idx = this.docs.findIndex(d => d.id === id);
        if (idx === -1)
            return false;
        this.docs.splice(idx, 1);
        return true;
    }
    size() { return this.docs.length; }
    all() { return [...this.docs]; }
    // 초기화
    clear() { this.docs = []; }
}
exports.RAGStore = RAGStore;
exports.globalRAG = new RAGStore();
//# sourceMappingURL=rag.js.map