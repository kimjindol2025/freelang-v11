export interface DocEntry {
    name: string;
    kind: "function" | "macro" | "struct" | "protocol";
    params: string[];
    doc: string;
    examples: string[];
    source: string;
}
export declare function extractDocs(src: string): DocEntry[];
//# sourceMappingURL=doc-extractor.d.ts.map