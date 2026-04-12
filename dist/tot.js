"use strict";
// FreeLang v9: Phase 93 — Tree-of-Thought 런타임
// AI의 병렬 분기 탐색과 최선 선택을 언어 원어로
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeOfThought = void 0;
exports.evalTotBlock = evalTotBlock;
const maybe_type_1 = require("./maybe-type");
// ── TreeOfThought 클래스 ───────────────────────────────────────────────────
class TreeOfThought {
    constructor() {
        this._branches = [];
        this._scoreFn = null;
        this._pruneThreshold = 0;
        this._executed = [];
    }
    /**
     * 분기 추가: 가설 이름과 실행 함수
     */
    branch(hypothesis, fn) {
        this._branches.push({ hypothesis, fn });
        return this;
    }
    /**
     * 점수 함수 등록: result → 0~1 점수
     */
    evaluate(scoreFn) {
        this._scoreFn = scoreFn;
        return this;
    }
    /**
     * 가지치기 임계값 설정: threshold 이하 점수는 pruned = true
     */
    prune(threshold) {
        this._pruneThreshold = threshold;
        return this;
    }
    /**
     * 탐색 실행 후 결과 선택
     * strategy: 'best' = 최고 점수 하나, 'top-k' = 상위 k개
     */
    select(strategy = 'best', k = 1) {
        // 각 branch 독립 실행
        this._executed = this._branches.map((b, idx) => {
            let result;
            try {
                result = b.fn();
            }
            catch (e) {
                result = { error: String(e.message ?? e) };
            }
            // maybe 타입 unwrap
            if ((0, maybe_type_1.isMaybe)(result)) {
                result = { maybeValue: result.value, confidence: result.confidence };
            }
            else if ((0, maybe_type_1.isNone)(result)) {
                result = null;
            }
            const score = this._scoreFn ? clamp(this._scoreFn(result), 0, 1) : 0.5;
            return {
                id: `branch-${idx}`,
                hypothesis: b.hypothesis,
                result,
                score,
                pruned: false,
            };
        });
        const explored = this._executed.length;
        // 가지치기
        let prunedCount = 0;
        for (const br of this._executed) {
            if (br.score < this._pruneThreshold) {
                br.pruned = true;
                prunedCount++;
            }
        }
        // 살아있는 branches
        const alive = this._executed.filter((b) => !b.pruned);
        // 모든 가지치기 시 최고 점수 하나 복구
        if (alive.length === 0 && this._executed.length > 0) {
            const best = [...this._executed].sort((a, b) => b.score - a.score)[0];
            best.pruned = false;
            alive.push(best);
            prunedCount--;
        }
        // 정렬 (높은 점수 우선)
        alive.sort((a, b) => b.score - a.score);
        let best;
        let resultBranches;
        if (strategy === 'top-k') {
            resultBranches = alive.slice(0, k);
            best = resultBranches[0];
        }
        else {
            best = alive[0];
            resultBranches = this._executed;
        }
        return {
            branches: resultBranches,
            best,
            explored,
            pruned: prunedCount,
        };
    }
    /**
     * 분기 트리를 Markdown으로 시각화
     */
    toMarkdown() {
        if (this._executed.length === 0) {
            // select 아직 안 했으면 빈 상태
            return `# Tree-of-Thought\n\n분기 없음. \`select()\` 먼저 호출하세요.\n`;
        }
        const lines = ['# Tree-of-Thought 탐색 결과\n'];
        const sorted = [...this._executed].sort((a, b) => b.score - a.score);
        for (const br of sorted) {
            const status = br.pruned ? '✂️ PRUNED' : '✅ ALIVE';
            lines.push(`## [${br.id}] ${br.hypothesis}`);
            lines.push(`- 상태: ${status}`);
            lines.push(`- 점수: ${br.score.toFixed(4)}`);
            lines.push(`- 결과: ${JSON.stringify(br.result)}`);
            lines.push('');
        }
        const alive = sorted.filter((b) => !b.pruned);
        if (alive.length > 0) {
            lines.push(`## 최선 선택: ${alive[0].hypothesis}`);
            lines.push(`점수: ${alive[0].score.toFixed(4)}`);
        }
        return lines.join('\n');
    }
}
exports.TreeOfThought = TreeOfThought;
// ── 유틸 ──────────────────────────────────────────────────────────────────
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}
// ── FL 인터프리터용 TOT 블록 핸들러 ─────────────────────────────────────────
/**
 * [TOT
 *   :branch "가설A" (approach-a $problem)
 *   :branch "가설B" (approach-b $problem)
 *   :eval (fn [$result] (score-quality $result))
 *   :prune 0.3
 *   :select best]
 *
 * evalTotBlock(interp, block) → ToTResult
 */
function evalTotBlock(interp, // Interpreter — circular import 방지를 위해 any
block) {
    const ev = (node) => interp.eval(node);
    const tot = new TreeOfThought();
    const fields = block.fields;
    const branchHypotheses = [];
    const branchNodes = [];
    // fields에서 :branch, :eval, :prune, :select 추출
    // Block.fields는 Map<string, any>이지만, :branch는 여러 개일 수 있어
    // 파서가 어떻게 처리하는지 확인: 배열로 올 수 있음
    // branch 목록은 별도 처리 (배열일 수 있음)
    const branchField = fields.get("branch");
    if (Array.isArray(branchField)) {
        // [hypothesis, node, hypothesis, node, ...]  pairs
        for (let i = 0; i + 1 < branchField.length; i += 2) {
            const hypo = String(ev(branchField[i]));
            const node = branchField[i + 1];
            branchHypotheses.push(hypo);
            branchNodes.push(node);
        }
    }
    else if (branchField != null) {
        // 단일 branch
        const hypo = String(ev(branchField));
        branchHypotheses.push(hypo);
        branchNodes.push(null);
    }
    // 각 branch 등록
    for (let i = 0; i < branchHypotheses.length; i++) {
        const node = branchNodes[i];
        const hypo = branchHypotheses[i];
        tot.branch(hypo, () => (node != null ? ev(node) : null));
    }
    // :eval 점수 함수
    const evalField = fields.get("eval");
    if (evalField != null) {
        const scoreFnVal = ev(evalField);
        tot.evaluate((result) => {
            if (typeof scoreFnVal === "function")
                return Number(scoreFnVal(result)) || 0;
            if (scoreFnVal?.kind === "function-value") {
                return Number(interp.callFunctionValue(scoreFnVal, [result])) || 0;
            }
            return 0.5;
        });
    }
    // :prune 임계값
    const pruneField = fields.get("prune");
    if (pruneField != null) {
        const threshold = Number(ev(pruneField));
        if (!isNaN(threshold))
            tot.prune(threshold);
    }
    // :select 전략
    const selectField = fields.get("select");
    let strategy = 'best';
    let k = 1;
    if (selectField != null) {
        const val = ev(selectField);
        if (val === "best" || val === "top-k") {
            strategy = val;
        }
    }
    // :k 파라미터
    const kField = fields.get("k");
    if (kField != null) {
        const kVal = Number(ev(kField));
        if (!isNaN(kVal) && kVal > 0)
            k = kVal;
    }
    return tot.select(strategy, k);
}
//# sourceMappingURL=tot.js.map