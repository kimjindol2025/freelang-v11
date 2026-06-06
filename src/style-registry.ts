// style-registry.ts — FreeLang v11 스타일 관리 시스템
// Phase 59 P3: 요청 스코프 글로벌 스타일 저장소

/**
 * 요청마다 새로 생성되는 스타일 저장소
 * (theme) 블록 → THEME 토큰 저장
 * (style) 블록 → 스타일 규칙 저장
 * flush() → 모든 CSS 반환 + 초기화
 */
export class StyleRegistry {
  private themes: string[] = [];  // :root { --token: value; }
  private styles: string[] = [];  // .selector { prop: value; }

  /**
   * THEME 블록 결과 추가
   * CSS Variables: :root { --primary: #2563eb; ... }
   */
  addTheme(css: string): void {
    if (css.trim()) {
      this.themes.push(css);
    }
  }

  /**
   * STYLE 블록 결과 추가
   * 선택자 규칙: .selector { background: #fff; ... }
   */
  addStyle(css: string): void {
    if (css.trim()) {
      this.styles.push(css);
    }
  }

  /**
   * 누적된 모든 CSS 반환 (THEME 먼저, 그 다음 STYLE)
   * 반환 후 레지스트리 초기화 (요청 스코프)
   */
  flush(): string {
    const allCss = [...this.themes, ...this.styles].join("\n");
    this.themes = [];
    this.styles = [];
    return allCss;
  }

  /**
   * 현재 CSS 크기 (디버그용)
   */
  size(): number {
    return this.themes.length + this.styles.length;
  }
}

// 싱글톤: 모든 interpreter 공유
export const styleRegistry = new StyleRegistry();
