"use strict";
// ethics-check.ts — FreeLang v9 Phase 147: [ETHICS-CHECK]
// AI가 자신의 행동/출력을 윤리적으로 자기 검사하는 시스템
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalEthics = exports.EthicsChecker = void 0;
// 기본 원칙 정의들
const doNoHarmPrinciple = {
    id: 'do-no-harm',
    name: '해악 금지',
    description: '행동이나 출력이 인간이나 생명체에 해를 끼쳐서는 안 된다',
    framework: 'deontological',
    check: (subject, _context) => {
        const harmKeywords = [
            'kill', 'murder', 'harm', 'hurt', 'injure', 'damage', 'destroy',
            '죽', '살인', '해치', '폭력', '폭발', '폭탄', '독', '자살',
            'weapon', 'bomb', 'poison', 'explosive', 'attack', 'violence',
            'illegal', 'steal', 'theft', 'fraud', 'abuse',
        ];
        const lower = subject.toLowerCase();
        const found = harmKeywords.some(kw => lower.includes(kw));
        return {
            passed: !found,
            reason: found
                ? `해악을 초래할 수 있는 내용이 감지되었습니다: "${subject.substring(0, 50)}"`
                : '해악 금지 원칙을 준수합니다',
        };
    },
};
const fairnessPrinciple = {
    id: 'fairness',
    name: '공정성',
    description: '모든 개인과 집단을 공정하게 대우해야 한다',
    framework: 'fairness',
    check: (subject, _context) => {
        const discriminationKeywords = [
            'racist', 'sexist', 'discriminat', 'prejudice', 'bias against',
            '차별', '편견', '혐오', '인종차별', '성차별', '장애인 차별',
            'inferior', 'superior race', 'stereotype',
        ];
        const lower = subject.toLowerCase();
        const found = discriminationKeywords.some(kw => lower.includes(kw));
        return {
            passed: !found,
            reason: found
                ? '차별 또는 편견이 감지되었습니다'
                : '공정성 원칙을 준수합니다',
        };
    },
};
const transparencyPrinciple = {
    id: 'transparency',
    name: '투명성',
    description: 'AI 시스템의 의사결정 과정은 투명하고 설명 가능해야 한다',
    framework: 'virtue',
    check: (subject, context) => {
        // 숨김이나 기만 관련 패턴 검사
        const deceptionKeywords = [
            'deceive', 'lie', 'hide', 'conceal', 'manipulate', 'trick', 'mislead',
            '속이', '거짓', '숨기', '조작', '기만', '사기',
        ];
        const lower = subject.toLowerCase();
        const found = deceptionKeywords.some(kw => lower.includes(kw));
        // context에 hiding flag가 있으면 위반
        const hidingContext = context['hiding'] === true || context['deceptive'] === true;
        return {
            passed: !found && !hidingContext,
            reason: (found || hidingContext)
                ? '투명성을 해치는 내용이 감지되었습니다'
                : '투명성 원칙을 준수합니다',
        };
    },
};
const privacyPrinciple = {
    id: 'privacy',
    name: '개인정보 보호',
    description: '개인의 프라이버시와 데이터 보호 권리를 존중해야 한다',
    framework: 'care',
    check: (subject, context) => {
        const privacyKeywords = [
            'personal data', 'private information', 'ssn', 'social security',
            'credit card', 'password', 'expose private',
            '주민번호', '개인정보 유출', '비밀번호 노출', '사생활 침해',
            'doxx', 'doxing', 'stalk',
        ];
        const lower = subject.toLowerCase();
        const found = privacyKeywords.some(kw => lower.includes(kw));
        const privacyViolation = context['privacy_violation'] === true;
        return {
            passed: !found && !privacyViolation,
            reason: (found || privacyViolation)
                ? '개인정보 보호 위반이 감지되었습니다'
                : '개인정보 보호 원칙을 준수합니다',
        };
    },
};
const autonomyPrinciple = {
    id: 'autonomy',
    name: '자율성 존중',
    description: '인간의 자율적 의사결정 능력을 존중하고 최대 이익을 추구한다',
    framework: 'utilitarian',
    check: (subject, context) => {
        const coercionKeywords = [
            'force', 'coerce', 'compel', 'override human', 'bypass consent',
            '강제', '동의 없이', '허락 없이', '자율성 침해', '인간 무시',
            'manipulate user', 'control human', 'override decision',
        ];
        const lower = subject.toLowerCase();
        const found = coercionKeywords.some(kw => lower.includes(kw));
        const autonomyViolation = context['autonomy_violation'] === true;
        return {
            passed: !found && !autonomyViolation,
            reason: (found || autonomyViolation)
                ? '인간의 자율성을 침해하는 내용이 감지되었습니다'
                : '자율성 존중 원칙을 준수합니다',
        };
    },
};
const DEFAULT_PRINCIPLES = [
    doNoHarmPrinciple,
    fairnessPrinciple,
    transparencyPrinciple,
    privacyPrinciple,
    autonomyPrinciple,
];
class EthicsChecker {
    constructor() {
        this.principles = [...DEFAULT_PRINCIPLES];
    }
    // 기본 원칙 추가
    addPrinciple(principle) {
        this.principles.push(principle);
    }
    // 윤리 검사
    check(subject, context = {}) {
        const violations = [];
        const frameworkResults = {
            utilitarian: { passed: true, score: 1.0, violations: 0 },
            deontological: { passed: true, score: 1.0, violations: 0 },
            virtue: { passed: true, score: 1.0, violations: 0 },
            care: { passed: true, score: 1.0, violations: 0 },
            fairness: { passed: true, score: 1.0, violations: 0 },
        };
        for (const principle of this.principles) {
            const result = principle.check(subject, context);
            if (!result.passed) {
                const severity = this._determineSeverity(subject, principle, context);
                const violation = {
                    principle: principle.name,
                    severity,
                    description: result.reason,
                    suggestion: this._generateSuggestion(principle, subject),
                    framework: principle.framework,
                };
                violations.push(violation);
                frameworkResults[principle.framework].passed = false;
                frameworkResults[principle.framework].violations += 1;
            }
        }
        // 프레임워크별 점수 계산
        const principlesByFramework = {
            utilitarian: 0, deontological: 0, virtue: 0, care: 0, fairness: 0,
        };
        for (const p of this.principles) {
            principlesByFramework[p.framework] = (principlesByFramework[p.framework] || 0) + 1;
        }
        for (const fw of Object.keys(frameworkResults)) {
            const total = principlesByFramework[fw] || 1;
            const violated = frameworkResults[fw].violations;
            frameworkResults[fw].score = Math.max(0, 1 - violated / total);
        }
        // 전체 점수 계산 (severity 가중치 적용)
        let penaltySum = 0;
        for (const v of violations) {
            penaltySum += this._severityPenalty(v.severity);
        }
        const score = Math.max(0, 1 - penaltySum / Math.max(this.principles.length, 1));
        const passed = violations.length === 0;
        const hasCritical = violations.some(v => v.severity === 'critical');
        const hasHigh = violations.some(v => v.severity === 'high');
        const requiresHumanReview = hasCritical || hasHigh;
        const frameworks = {
            utilitarian: { passed: frameworkResults.utilitarian.passed, score: frameworkResults.utilitarian.score },
            deontological: { passed: frameworkResults.deontological.passed, score: frameworkResults.deontological.score },
            virtue: { passed: frameworkResults.virtue.passed, score: frameworkResults.virtue.score },
            care: { passed: frameworkResults.care.passed, score: frameworkResults.care.score },
            fairness: { passed: frameworkResults.fairness.passed, score: frameworkResults.fairness.score },
        };
        const recommendation = this._generateRecommendation(passed, violations, score);
        return {
            subject,
            passed,
            violations,
            score,
            frameworks,
            recommendation,
            requiresHumanReview,
        };
    }
    // 특정 프레임워크로만 검사
    checkByFramework(subject, framework, context = {}) {
        const relevantPrinciples = this.principles.filter(p => p.framework === framework);
        const violations = [];
        for (const principle of relevantPrinciples) {
            const result = principle.check(subject, context);
            if (!result.passed) {
                const severity = this._determineSeverity(subject, principle, context);
                violations.push({
                    principle: principle.name,
                    severity,
                    description: result.reason,
                    suggestion: this._generateSuggestion(principle, subject),
                    framework: principle.framework,
                });
            }
        }
        const total = relevantPrinciples.length || 1;
        const score = Math.max(0, 1 - violations.reduce((sum, v) => sum + this._severityPenalty(v.severity), 0) / total);
        return {
            passed: violations.length === 0,
            score,
            violations,
        };
    }
    // 위반 없는지 빠른 확인
    isEthical(subject, context = {}) {
        for (const principle of this.principles) {
            const result = principle.check(subject, context);
            if (!result.passed)
                return false;
        }
        return true;
    }
    // 윤리적 대안 제시
    suggestEthicalAlternative(subject, violations) {
        if (violations.length === 0) {
            return `"${subject.substring(0, 50)}"은(는) 이미 윤리적입니다. 변경이 필요하지 않습니다.`;
        }
        const suggestions = [];
        const frameworks = new Set(violations.map(v => v.framework));
        for (const v of violations) {
            suggestions.push(`• [${v.framework}] ${v.suggestion}`);
        }
        const frameworkAdvice = [];
        if (frameworks.has('deontological'))
            frameworkAdvice.push('의무론적 관점: 절대적 해악을 제거하십시오');
        if (frameworks.has('utilitarian'))
            frameworkAdvice.push('공리주의적 관점: 최대 다수의 최대 이익을 추구하십시오');
        if (frameworks.has('virtue'))
            frameworkAdvice.push('덕 윤리 관점: 투명하고 정직한 방식을 택하십시오');
        if (frameworks.has('care'))
            frameworkAdvice.push('돌봄 윤리 관점: 취약한 개인의 권리를 보호하십시오');
        if (frameworks.has('fairness'))
            frameworkAdvice.push('공정성 관점: 모든 집단을 동등하게 대우하십시오');
        return [
            `윤리적 대안 제안 (${violations.length}개 위반):`,
            ...suggestions,
            '',
            '프레임워크별 권고사항:',
            ...frameworkAdvice,
            '',
            '권장: 위 사항들을 반영하여 내용을 수정하거나 전문가의 검토를 받으십시오.',
        ].join('\n');
    }
    // 리스크 레벨
    riskLevel(result) {
        if (result.violations.length === 0)
            return 'none';
        const hasCritical = result.violations.some(v => v.severity === 'critical');
        if (hasCritical)
            return 'critical';
        const hasHigh = result.violations.some(v => v.severity === 'high');
        if (hasHigh)
            return 'high';
        const hasMedium = result.violations.some(v => v.severity === 'medium');
        if (hasMedium)
            return 'medium';
        return 'low';
    }
    _determineSeverity(subject, principle, context) {
        const lower = subject.toLowerCase();
        // critical: 심각한 물리적 해악, 생명 위협
        const criticalKeywords = ['kill', 'murder', 'bomb', 'explosive', '살인', '폭탄', '자살'];
        if (criticalKeywords.some(kw => lower.includes(kw)))
            return 'critical';
        // high: 심각한 개인정보 침해, 차별
        const highKeywords = ['doxx', 'doxing', 'stalk', 'racist', 'sexist', '주민번호', '사기'];
        if (highKeywords.some(kw => lower.includes(kw)))
            return 'high';
        // 컨텍스트에서 severity 힌트
        const ctxSeverity = context['severity'];
        if (ctxSeverity === 'critical')
            return 'critical';
        if (ctxSeverity === 'high')
            return 'high';
        if (ctxSeverity === 'medium')
            return 'medium';
        // medium: 중등도 위반
        const mediumKeywords = ['harm', 'hurt', 'damage', '해치', '손해', 'manipulate'];
        if (mediumKeywords.some(kw => lower.includes(kw)))
            return 'medium';
        return 'low';
    }
    _generateSuggestion(principle, subject) {
        const suggestions = {
            'do-no-harm': '해악을 초래하지 않는 방향으로 내용을 수정하거나, 유해한 요소를 제거하십시오',
            'fairness': '모든 집단을 공평하게 표현하고, 차별적 언어나 관점을 제거하십시오',
            'transparency': '의사결정 과정을 명확히 설명하고, 숨김이나 기만 요소를 제거하십시오',
            'privacy': '개인식별 정보를 익명화하고, 동의 없는 개인정보 처리를 중단하십시오',
            'autonomy': '사용자의 자유로운 선택을 보장하고, 강제나 조작 요소를 제거하십시오',
        };
        return suggestions[principle.id] || `${principle.name} 원칙에 맞게 내용을 수정하십시오`;
    }
    _severityPenalty(severity) {
        const penalties = {
            low: 0.1,
            medium: 0.25,
            high: 0.5,
            critical: 1.0,
        };
        return penalties[severity] || 0.1;
    }
    _generateRecommendation(passed, violations, score) {
        if (passed) {
            return score >= 0.9
                ? '모든 윤리 원칙을 준수합니다. 안전하게 사용할 수 있습니다.'
                : '주요 원칙은 통과했으나 일부 개선 여지가 있습니다.';
        }
        const criticalCount = violations.filter(v => v.severity === 'critical').length;
        const highCount = violations.filter(v => v.severity === 'high').length;
        if (criticalCount > 0) {
            return `심각한 윤리 위반 ${criticalCount}건이 발견되었습니다. 즉시 사용을 중단하고 전문가 검토가 필요합니다.`;
        }
        if (highCount > 0) {
            return `중대한 윤리 위반 ${highCount}건이 발견되었습니다. 인간 전문가의 검토가 권장됩니다.`;
        }
        return `경미한 윤리 위반 ${violations.length}건이 발견되었습니다. 제안 사항을 참고하여 수정하십시오.`;
    }
}
exports.EthicsChecker = EthicsChecker;
// 전역 인스턴스
exports.globalEthics = new EthicsChecker();
//# sourceMappingURL=ethics-check.js.map