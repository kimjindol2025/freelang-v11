"use strict";
// FreeLang v9: Logging System
// Phase 6: Structured Logging with Environment Control
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoOpLogger = exports.StructuredLogger = void 0;
exports.setGlobalLogger = setGlobalLogger;
exports.getGlobalLogger = getGlobalLogger;
/**
 * 구조화된 로거 구현
 * - LOG_LEVEL 환경변수로 로깅 레벨 제어
 * - 타임스탬프 및 로그 레벨 포함
 * - 추가 데이터 JSON 형식 출력 가능
 */
class StructuredLogger {
    constructor(initialLevel) {
        this.logLevelOrder = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        };
        // 환경변수에서 LOG_LEVEL 읽기, 없으면 'info'가 기본값
        const envLevel = process.env.LOG_LEVEL;
        this.currentLogLevel = initialLevel || envLevel || "info";
        // 개발 중에는 로그 레벨 표시
        if (process.env.DEBUG_LOGGER) {
            console.log(`[Logger] Initialized with log level: ${this.currentLogLevel}`);
        }
    }
    debug(message, data) {
        this.log("debug", message, data);
    }
    info(message, data) {
        this.log("info", message, data);
    }
    warn(message, data) {
        this.log("warn", message, data);
    }
    error(message, data) {
        this.log("error", message, data);
    }
    setLogLevel(level) {
        this.currentLogLevel = level;
    }
    /**
     * 실제 로그 출력 로직
     */
    log(level, message, data) {
        // 현재 로그 레벨보다 낮은 우선순위의 메시지는 무시
        if (this.logLevelOrder[level] < this.logLevelOrder[this.currentLogLevel]) {
            return;
        }
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        const fullMessage = `${prefix} ${message}`;
        // 로그 레벨에 따라 적절한 console 함수 사용
        switch (level) {
            case "debug":
                console.log(fullMessage, data ? data : "");
                break;
            case "info":
                console.log(fullMessage, data ? data : "");
                break;
            case "warn":
                console.warn(fullMessage, data ? data : "");
                break;
            case "error":
                console.error(fullMessage, data ? data : "");
                break;
        }
    }
}
exports.StructuredLogger = StructuredLogger;
/**
 * 로그를 비활성화하는 NoOp 로거
 * 테스트 시 콘솔 출력을 억제할 때 사용
 */
class NoOpLogger {
    debug() { }
    info() { }
    warn() { }
    error() { }
    setLogLevel() { }
}
exports.NoOpLogger = NoOpLogger;
/**
 * 전역 로거 인스턴스 (싱글톤)
 */
let globalLogger = new StructuredLogger();
/**
 * 전역 로거 설정
 */
function setGlobalLogger(logger) {
    globalLogger = logger;
}
/**
 * 전역 로거 가져오기
 */
function getGlobalLogger() {
    return globalLogger;
}
//# sourceMappingURL=logger.js.map