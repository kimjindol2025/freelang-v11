export interface SourceLocation {
    file: string;
    line: number;
    col: number;
}
export declare class SourceMap {
    private map;
    /** nodeId → 소스 위치 기록 */
    record(nodeId: string, loc: SourceLocation): void;
    /** nodeId로 소스 위치 조회 */
    get(nodeId: string): SourceLocation | undefined;
    /** SourceLocation → "file.fl:10:5" 형태 문자열 */
    formatLocation(loc: SourceLocation): string;
    /** 전체 맵 크기 */
    size(): number;
    /** 모든 항목 순회 */
    entries(): IterableIterator<[string, SourceLocation]>;
    /** 특정 파일의 모든 항목 필터 */
    getByFile(file: string): Array<[string, SourceLocation]>;
}
/**
 * buildSourceMap: 소스 코드를 렉싱하여 토큰별 줄/열 정보를 소스맵에 기록
 * 실제 렉서 토큰 줄 정보를 활용
 */
export declare function buildSourceMap(src: string, filename?: string): SourceMap;
//# sourceMappingURL=source-map.d.ts.map