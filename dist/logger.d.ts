/**
 * 로깅 레벨 정의
 */
export type LogLevel = "debug" | "info" | "warn" | "error";
/**
 * Logger 인터페이스
 * 모든 로거가 구현해야 할 기본 메서드 정의
 */
export interface Logger {
    debug(message: string, data?: any): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, data?: any): void;
    setLogLevel(level: LogLevel): void;
}
/**
 * 구조화된 로거 구현
 * - LOG_LEVEL 환경변수로 로깅 레벨 제어
 * - 타임스탬프 및 로그 레벨 포함
 * - 추가 데이터 JSON 형식 출력 가능
 */
export declare class StructuredLogger implements Logger {
    private logLevelOrder;
    private currentLogLevel;
    constructor(initialLevel?: LogLevel);
    debug(message: string, data?: any): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, data?: any): void;
    setLogLevel(level: LogLevel): void;
    /**
     * 실제 로그 출력 로직
     */
    private log;
}
/**
 * 로그를 비활성화하는 NoOp 로거
 * 테스트 시 콘솔 출력을 억제할 때 사용
 */
export declare class NoOpLogger implements Logger {
    debug(): void;
    info(): void;
    warn(): void;
    error(): void;
    setLogLevel(): void;
}
/**
 * 전역 로거 설정
 */
export declare function setGlobalLogger(logger: Logger): void;
/**
 * 전역 로거 가져오기
 */
export declare function getGlobalLogger(): Logger;
//# sourceMappingURL=logger.d.ts.map