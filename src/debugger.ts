// FreeLang v9: Phase 78 — Debugger
// (break!) 중단점 지원 + step 모드

import { SourceLocation, SourceMap } from "./source-map";

export interface BreakEvent {
  loc: SourceLocation;
  env: Record<string, any>;
}

export type BreakCallback = (event: BreakEvent) => void;

export class DebugSession {
  /** 중단점 집합 — "file:line" 형태 */
  public breakpoints: Set<string> = new Set();

  /** step 모드 — true면 모든 줄에서 break */
  public stepMode: boolean = false;

  /** 디버그 모드 활성화 여부 */
  public enabled: boolean = false;

  /** 중단점 도달 시 호출할 콜백 (기본: 콘솔 출력) */
  public onBreakCallback: BreakCallback | null = null;

  /** 소스맵 (선택적) */
  public sourceMap: SourceMap | null = null;

  /** 브레이크 이벤트 로그 (테스트 검증용) */
  public breakLog: BreakEvent[] = [];

  private static _key(file: string, line: number): string {
    return `${file}:${line}`;
  }

  /** 중단점 추가 */
  addBreakpoint(file: string, line: number): void {
    this.breakpoints.add(DebugSession._key(file, line));
  }

  /** 중단점 제거 */
  removeBreakpoint(file: string, line: number): void {
    this.breakpoints.delete(DebugSession._key(file, line));
  }

  /** 해당 위치가 중단점인지 확인 */
  isBreakpoint(file: string, line: number): boolean {
    return this.breakpoints.has(DebugSession._key(file, line));
  }

  /**
   * 중단점 도달 시 처리:
   * - 콘솔에 "[BREAK] file:line:col" 출력
   * - 환경 변수 스냅샷 기록
   * - 콜백 실행
   */
  onBreak(loc: SourceLocation, env: Record<string, any>): void {
    if (!this.enabled) return; // 디버그 모드 꺼져 있으면 no-op

    const event: BreakEvent = { loc, env: { ...env } };
    this.breakLog.push(event);

    const locStr = `${loc.file}:${loc.line}:${loc.col}`;
    console.log(`[BREAK] ${locStr}`);

    // 환경 변수 스냅샷 출력 (최대 10개)
    const entries = Object.entries(env).slice(0, 10);
    if (entries.length > 0) {
      console.log(`  env:`);
      for (const [k, v] of entries) {
        const display = typeof v === "object" ? JSON.stringify(v) : String(v);
        console.log(`    ${k} = ${display.slice(0, 80)}`);
      }
    }

    // 콜백 호출
    if (this.onBreakCallback) {
      this.onBreakCallback(event);
    }
  }

  /** 중단점 모두 제거 */
  clearBreakpoints(): void {
    this.breakpoints.clear();
  }

  /** 중단점 개수 */
  breakpointCount(): number {
    return this.breakpoints.size;
  }
}

/** 전역 디버그 세션 (싱글톤) */
let _globalSession: DebugSession | null = null;

export function getGlobalDebugSession(): DebugSession {
  if (!_globalSession) {
    _globalSession = new DebugSession();
  }
  return _globalSession;
}

export function setGlobalDebugSession(session: DebugSession): void {
  _globalSession = session;
}

/**
 * (break!) 특수 폼 처리 함수
 * 인터프리터에서 호출됨
 * - 디버그 모드 꺼져 있으면 no-op (프로덕션 안전)
 */
export function handleBreak(
  session: DebugSession,
  loc: SourceLocation,
  env: Record<string, any>
): void {
  if (!session.enabled) return; // 프로덕션 안전: 디버그 꺼져 있으면 no-op
  session.onBreak(loc, env);
}
