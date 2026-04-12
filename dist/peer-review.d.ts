export interface ReviewComment {
    reviewerId: string;
    aspect: string;
    score: number;
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
export declare class PeerReviewSystem {
    private reviewers;
    addReviewer(reviewer: Reviewer): void;
    review(targetId: string, output: any, reviewerIds?: string[], approvalThreshold?: number): ReviewResult;
    list(): string[];
    size(): number;
}
export declare const globalPeerReview: PeerReviewSystem;
//# sourceMappingURL=peer-review.d.ts.map