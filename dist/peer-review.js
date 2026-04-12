"use strict";
// peer-review.ts — FreeLang v9 Phase 127: PEER-REVIEW
// 에이전트 간 피어 리뷰 시스템
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalPeerReview = exports.PeerReviewSystem = void 0;
class PeerReviewSystem {
    constructor() {
        this.reviewers = new Map();
    }
    addReviewer(reviewer) { this.reviewers.set(reviewer.id, reviewer); }
    review(targetId, output, reviewerIds, approvalThreshold = 0.7) {
        const selected = reviewerIds
            ? reviewerIds.map(id => this.reviewers.get(id)).filter(Boolean)
            : [...this.reviewers.values()];
        const comments = selected.map(r => r.review(output));
        const averageScore = comments.length > 0
            ? comments.reduce((s, c) => s + c.score, 0) / comments.length
            : 0;
        const approved = averageScore >= approvalThreshold;
        const issues = comments.filter(c => c.score < approvalThreshold);
        const summary = approved
            ? `승인 (평균 점수: ${averageScore.toFixed(2)})`
            : `반려 — ${issues.length}개 문제: ${issues.map(c => c.aspect).join(', ')}`;
        return { targetId, output, comments, averageScore, approved, summary };
    }
    list() { return [...this.reviewers.keys()]; }
    size() { return this.reviewers.size; }
}
exports.PeerReviewSystem = PeerReviewSystem;
exports.globalPeerReview = new PeerReviewSystem();
//# sourceMappingURL=peer-review.js.map