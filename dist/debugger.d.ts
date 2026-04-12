import { SourceLocation, SourceMap } from "./source-map";
export interface BreakEvent {
    loc: SourceLocation;
    env: Record<string, any>;
}
export type BreakCallback = (event: BreakEvent) => void;
export declare class DebugSession {
    /** 중단점 집합 — "file:line" 형태 */
    breakpoints: Set<string>;
    /** step 모드 — true면 모든 줄에서 break */
    stepMode: boolean;
    /** 디버그 모드 활성화 여부 */
    enabled: boolean;
    /** 중단점 도달 시 호출할 콜백 (기본: 콘솔 출력) */
    onBreakCallback: BreakCallback | null;
    /** 소스맵 (선택적) */
    sourceMap: SourceMap | null;
    /** 브레이크 이벤트 로그 (테스트 검증용) */
    breakLog: BreakEvent[];
    private static _key;
    /** 중단점 추가 */
    addBreakpoint(file: string, line: number): void;
    /** 중단점 제거 */
    removeBreakpoint(file: string, line: number): void;
    /** 해당 위치가 중단점인지 확인 */
    isBreakpoint(file: string, line: number): boolean;
    /**
     * 중단점 도달 시 처리:
     * - 콘솔에 "[BREAK] file:line:col" 출력
     * - 환경 변수 스냅샷 기록
     * - 콜백 실행
     */
    onBreak(loc: SourceLocation, env: Record<string, any>): void;
    /** 중단점 모두 제거 */
    clearBreakpoints(): void;
    /** 중단점 개수 */
    breakpointCount(): number;
}
export declare function getGlobalDebugSession(): DebugSession;
export declare function setGlobalDebugSession(session: DebugSession): void;
/**
 * (break!) 특수 폼 처리 함수
 * 인터프리터에서 호출됨
 * - 디버그 모드 꺼져 있으면 no-op (프로덕션 안전)
 */
export declare function handleBreak(session: DebugSession, loc: SourceLocation, env: Record<string, any>): void;
//# sourceMappingURL=debugger.d.ts.map