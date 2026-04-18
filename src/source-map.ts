// FreeLang v9: Phase 78 — Source Map
// FL 실행 시 소스 위치 추적

export interface SourceLocation {
  file: string;
  line: number;
  col: number;
}

export class SourceMap {
  private map: Map<string, SourceLocation> = new Map();

  /** nodeId → 소스 위치 기록 */
  record(nodeId: string, loc: SourceLocation): void {
    this.map.set(nodeId, loc);
  }

  /** nodeId로 소스 위치 조회 */
  get(nodeId: string): SourceLocation | undefined {
    return this.map.get(nodeId);
  }

  /** SourceLocation → "file.fl:10:5" 형태 문자열 */
  formatLocation(loc: SourceLocation): string {
    return `${loc.file}:${loc.line}:${loc.col}`;
  }

  /** 전체 맵 크기 */
  size(): number {
    return this.map.size;
  }

  /** 모든 항목 순회 */
  entries(): IterableIterator<[string, SourceLocation]> {
    return this.map.entries();
  }

  /** 특정 파일의 모든 항목 필터 */
  getByFile(file: string): Array<[string, SourceLocation]> {
    const result: Array<[string, SourceLocation]> = [];
    for (const [id, loc] of this.map.entries()) {
      if (loc.file === file) result.push([id, loc]);
    }
    return result;
  }
}

/**
 * buildSourceMap: 소스 코드를 렉싱하여 토큰별 줄/열 정보를 소스맵에 기록
 * 실제 렉서 토큰 줄 정보를 활용
 */
export function buildSourceMap(src: string, filename: string = "<stdin>"): SourceMap {
  const sm = new SourceMap();
  let line = 1;
  let col = 1;
  let i = 0;
  let tokenIndex = 0;

  while (i < src.length) {
    const ch = src[i];

    // 개행
    if (ch === "\n") {
      line++;
      col = 1;
      i++;
      continue;
    }

    // 공백
    if (/\s/.test(ch)) {
      col++;
      i++;
      continue;
    }

    // 주석
    if (ch === ";") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }

    // 토큰 시작 위치 기록
    const startLine = line;
    const startCol = col;
    const nodeId = `token:${tokenIndex}`;

    if (ch === '"') {
      // 문자열 리터럴
      i++; col++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < src.length) {
          i++; col++;
        }
        if (src[i] === "\n") { line++; col = 1; }
        else col++;
        i++;
      }
      if (i < src.length) { i++; col++; } // closing "
    } else if (ch === "(" || ch === ")" || ch === "[" || ch === "]" || ch === "{" || ch === "}") {
      i++; col++;
    } else {
      // 심볼/숫자/키워드
      while (i < src.length && !/[\s()\[\]{};",]/.test(src[i])) {
        i++; col++;
      }
    }

    sm.record(nodeId, { file: filename, line: startLine, col: startCol });
    tokenIndex++;
  }

  return sm;
}
