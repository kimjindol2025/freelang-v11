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
export declare function tokenize(text: string): string[];
export declare function tfidf(query: string[], doc: string[]): number;
export declare class RAGStore {
    private docs;
    add(doc: RAGDocument): void;
    addMany(docs: RAGDocument[]): void;
    retrieve(query: string, topK?: number): RAGDocument[];
    query(queryStr: string, options?: {
        topK?: number;
        augment?: (query: string, docs: RAGDocument[]) => string;
    }): RAGResult;
    remove(id: string): boolean;
    size(): number;
    all(): RAGDocument[];
    clear(): void;
}
export declare const globalRAG: RAGStore;
//# sourceMappingURL=rag.d.ts.map