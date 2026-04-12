"use strict";
// FreeLang v9 Self-Teaching System
// FL이 FL을 가르침 — 예제 기반 학습, 패턴 설명, 코드 생성
// Phase 107: FL이 FL을 가르치는 자기 교육 시스템
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalTutor = exports.FLTutor = exports.FL_EXAMPLES = void 0;
// 내장 FL 예제 라이브러리
exports.FL_EXAMPLES = [
    // 기초
    { concept: 'define', code: '(define x 42)', description: '변수 정의', difficulty: 'beginner', tags: ['basic', 'variable'] },
    { concept: 'lambda', code: '(lambda [$x $y] (+ $x $y))', description: '익명 함수', difficulty: 'beginner', tags: ['function', 'basic'] },
    { concept: 'if', code: '(if (> $x 0) "positive" "non-positive")', description: '조건 분기', difficulty: 'beginner', tags: ['control', 'basic'] },
    { concept: 'let', code: '(let [$a 1 $b 2] (+ $a $b))', description: '지역 변수', difficulty: 'beginner', tags: ['variable', 'scope'] },
    { concept: 'defn', code: '(defn add [$a $b] (+ $a $b))', description: '함수 정의', difficulty: 'beginner', tags: ['function'] },
    // 중급
    { concept: 'pipe', code: '(-> $data parse-json filter-errors extract-values)', description: '파이프라인', difficulty: 'intermediate', tags: ['pipeline', 'functional'] },
    { concept: 'maybe', code: '(maybe 0.85 "Paris")', description: '불확실성 타입', difficulty: 'intermediate', tags: ['ai', 'uncertainty'] },
    { concept: 'result', code: '(ok 42)\n(err "NOT_FOUND" "없음")', description: 'Result 타입', difficulty: 'intermediate', tags: ['error', 'result'] },
    { concept: 'fl-try', code: '(fl-try (call-api $url)\n  :on-not-found (fn [$e] "fallback")\n  :default (fn [$e] (log $e)))', description: 'AI 에러 처리', difficulty: 'intermediate', tags: ['error', 'ai'] },
    { concept: 'parallel', code: '(parallel [(task-a) (task-b) (task-c)])', description: '병렬 실행', difficulty: 'intermediate', tags: ['concurrency'] },
    // AI 블록
    { concept: 'COT', code: '[COT :step "분석" (analyze $data) :step "추론" (reason $prev) :conclude summarize]', description: 'Chain-of-Thought', difficulty: 'advanced', tags: ['ai', 'reasoning'] },
    { concept: 'TOT', code: '[TOT :branch "가설A" $val1 :branch "가설B" $val2 :eval score-fn :select best]', description: 'Tree-of-Thought', difficulty: 'advanced', tags: ['ai', 'search'] },
    { concept: 'REFLECT', code: '[REFLECT :output $result :criteria [accuracy completeness] :threshold 0.8]', description: '자기 평가', difficulty: 'advanced', tags: ['ai', 'reflect'] },
    { concept: 'AGENT', code: '[AGENT :goal "데이터 분석" :max-steps 5 :step (fn [$s] (analyze $s))]', description: '에이전트 루프', difficulty: 'advanced', tags: ['ai', 'agent'] },
    { concept: 'SELF-IMPROVE', code: '(self-improve :target $code :evaluate score-fn :improve enhance-fn :iterations 3)', description: '자기 개선', difficulty: 'advanced', tags: ['ai', 'improve'] },
];
class FLTutor {
    constructor(examples = exports.FL_EXAMPLES) {
        // 딥 카피로 독립성 보장
        this.examples = examples.map(e => ({ ...e, tags: [...e.tags] }));
    }
    // 개념으로 예제 찾기
    findByConcept(concept) {
        return this.examples.filter(e => e.concept.toLowerCase().includes(concept.toLowerCase()));
    }
    // 태그로 예제 찾기
    findByTag(tag) {
        return this.examples.filter(e => e.tags.includes(tag));
    }
    // 난이도로 필터
    findByDifficulty(level) {
        return this.examples.filter(e => e.difficulty === level);
    }
    // 레슨 생성
    lesson(concept) {
        const examples = this.findByConcept(concept);
        const explanation = examples.length > 0
            ? `${concept}은 FreeLang의 핵심 개념입니다.\n${examples.map(e => e.description).join('. ')}.`
            : `${concept} 개념을 찾을 수 없습니다.`;
        const exercise = examples.length > 0
            ? `; 연습: ${examples[0].description}\n; 아래를 완성하세요:\n${examples[0].code.replace(/\$\w+/g, '???')}`
            : `; ${concept} 예제를 작성해보세요`;
        return { concept, examples, explanation, exercise };
    }
    // 랜덤 예제
    random() {
        return this.examples[Math.floor(Math.random() * this.examples.length)];
    }
    // 전체 개념 목록
    concepts() {
        return [...new Set(this.examples.map(e => e.concept))];
    }
    // 예제 추가
    addExample(example) {
        this.examples.push(example);
    }
    size() { return this.examples.length; }
    // 레슨을 마크다운으로 변환
    lessonMarkdown(concept) {
        const result = this.lesson(concept);
        const lines = [
            `# FreeLang 레슨: ${result.concept}`,
            '',
            `## 설명`,
            result.explanation,
            '',
        ];
        if (result.examples.length > 0) {
            lines.push('## 예제');
            for (const ex of result.examples) {
                lines.push(`### ${ex.concept} (${ex.difficulty})`);
                lines.push(`${ex.description}`);
                lines.push('```');
                lines.push(ex.code);
                lines.push('```');
                lines.push('');
            }
        }
        lines.push('## 연습 문제');
        lines.push('```');
        lines.push(result.exercise);
        lines.push('```');
        return lines.join('\n');
    }
}
exports.FLTutor = FLTutor;
exports.globalTutor = new FLTutor();
//# sourceMappingURL=fl-tutor.js.map