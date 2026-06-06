// peer-review.ts — FreeLang v9 Phase 127: PEER-REVIEW
// 에이전트 간 피어 리뷰 시스템

export interface ReviewComment {
  reviewerId: string;
  aspect: string;
  score: number;      // 0~1
  comment: string;
  suggestion?: string;
}

export interface ReviewResult {
  targetId: string;
  output: any;
  comments: ReviewComment[];
  averageScore: number;
  approved: boolean;
  summary: string;
}

export interface Reviewer {
  id: string;
  review: (output: any, context?: any) => ReviewComment;
}

export class PeerReviewSystem {
  private reviewers: Map<string, Reviewer> = new Map();

  addReviewer(reviewer: Reviewer): void { this.reviewers.set(reviewer.id, reviewer); }

  review(targetId: string, output: any, reviewerIds?: string[], approvalThreshold = 0.7): ReviewResult {
    const selected = reviewerIds
      ? reviewerIds.map(id => this.reviewers.get(id)).filter(Boolean) as Reviewer[]
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

  list(): string[] { return [...this.reviewers.keys()]; }
  size(): number { return this.reviewers.size; }
}

export const globalPeerReview = new PeerReviewSystem();
