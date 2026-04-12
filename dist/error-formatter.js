"use strict";
// FreeLang v9: Error Formatter
// Phase 59: 위치 정보 + 소스 강조 + 유사 함수 힌트
Object.defineProperty(exports, "__esModule", { value: true });
exports.levenshtein = levenshtein;
exports.suggestSimilar = suggestSimilar;
exports.formatError = formatError;
/**
 * 레벤슈타인 거리 계산 (간단 구현, npm 패키지 불필요)
 */
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            }
            else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    return dp[m][n];
}
/**
 * 유사 이름 추천
 * - 짧은 이름(≤4자): 거리 ≤ 2
 * - 긴 이름(>4자): 거리 ≤ 3 (예: compute-tax vs compute-rate = 3)
 * @param name 찾지 못한 이름
 * @param candidates 후보 목록
 * @returns 가장 가까운 후보 또는 null
 */
function suggestSimilar(name, candidates) {
    let best = null;
    let bestDist = Infinity;
    // 이름 길이에 따라 임계값 조정
    const threshold = name.length > 4 ? 3 : 2;
    for (const candidate of candidates) {
        const dist = levenshtein(name.toLowerCase(), candidate.toLowerCase());
        if (dist <= threshold && dist < bestDist) {
            bestDist = dist;
            best = candidate;
        }
    }
    return best;
}
/**
 * 에러 포매팅 — 파일:줄:컬럼 헤더 + 소스 강조 (±2줄) + 힌트
 */
function formatError(err) {
    const lines = [];
    // 1) 헤더 줄
    let header = `FreeLang 실행 오류`;
    if (err.file) {
        header += `  ${err.file}`;
        if (err.line != null) {
            header += `:${err.line}`;
            if (err.col != null) {
                header += `:${err.col}`;
            }
        }
    }
    lines.push(header);
    // 2) 소스 강조 (±2줄)
    if (err.source && err.line != null) {
        const srcLines = err.source.split("\n");
        const targetLine = err.line; // 1-based
        const startLine = Math.max(1, targetLine - 2);
        const endLine = Math.min(srcLines.length, targetLine + 2);
        for (let i = startLine; i <= endLine; i++) {
            const lineNum = String(i).padStart(3, " ");
            const srcLine = srcLines[i - 1] ?? "";
            lines.push(`  ${lineNum} │ ${srcLine}`);
            // 오류 줄 아래에 캐럿(^^^) 표시
            if (i === targetLine) {
                const col = err.col != null ? err.col : 1;
                const prefix = " ".repeat(7 + (col - 1)); // "  NNN │ " = 7자
                let caretLen = 1;
                // 오류 토큰 길이: message에서 따옴표 안 이름 추출 시도
                const tokenMatch = err.message.match(/['"`]([^'"`]+)['"`]/);
                if (tokenMatch)
                    caretLen = tokenMatch[1].length;
                lines.push(prefix + "^".repeat(caretLen));
            }
        }
    }
    // 3) 에러 메시지
    lines.push(`오류: ${err.message}`);
    // 4) 힌트
    if (err.hint) {
        lines.push(`힌트: ${err.hint}`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=error-formatter.js.map