// Phase Y-2-D: 디버그 API — AI가 쿼리 가능한 인터페이스

export class DebugAPI {
  /**
   * 마지막 에러 정보 조회
   * AI 에이전트가 자동 수정을 위해 호출
   */
  static getLastError(): any {
    if (typeof window === 'undefined') return null;
    const debugAPI = (window as any).__FL_DEBUG;
    return debugAPI?.lastError || null;
  }

  /**
   * 호출 스택 조회
   * 에러 발생 시점의 함수 호출 체인
   */
  static getCallStack(): any[] {
    if (typeof window === 'undefined') return [];
    const debugAPI = (window as any).__FL_DEBUG;
    return debugAPI?.callStack || [];
  }

  /**
   * 특정 변수 검사
   * 에러 시점의 변수 값 확인
   */
  static inspectVariable(name: string): any {
    if (typeof window === 'undefined') return undefined;
    const debugAPI = (window as any).__FL_DEBUG;
    return debugAPI?.variables?.[name];
  }

  /**
   * 에러 메시지 포맷팅
   * 직관적인 표시용
   */
  static showError(): string {
    if (typeof window === 'undefined') return 'No error';
    const debugAPI = (window as any).__FL_DEBUG;
    return debugAPI?.showError?.() || 'No error';
  }

  /**
   * 콘솔에 전체 에러 정보 출력
   * 개발 중 디버깅용
   */
  static printConsole(): void {
    if (typeof window === 'undefined') return;
    const debugAPI = (window as any).__FL_DEBUG;
    debugAPI?.printConsole?.();
  }

  /**
   * 에러 정보 전체 JSON 반환
   * /api/debug 엔드포인트에서 호출
   */
  static getErrorJSON(): Record<string, any> {
    if (typeof window === 'undefined') return {};
    const debugAPI = (window as any).__FL_DEBUG;
    const err = debugAPI?.lastError;
    if (!err) return {};
    return {
      message: err.message,
      code: err.code,
      file: err.file,
      line: err.line,
      col: err.col,
      callStack: err.callStack || [],
      variables: err.variables || {},
      hint: err.hint,
    };
  }

  /**
   * 디버그 패널 표시 여부 확인
   */
  static isVisible(): boolean {
    if (typeof window === 'undefined') return false;
    const panel = document.getElementById('fl-debug-panel');
    return panel ? panel.style.display !== 'none' : false;
  }

  /**
   * 디버그 정보 초기화
   */
  static clear(): void {
    if (typeof window === 'undefined') return;
    const debugAPI = (window as any).__FL_DEBUG;
    debugAPI?.clear?.();
  }
}
