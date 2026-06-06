// runtime-intelligence.ts — FreeLang Phase 10: unified cross-run intelligence API

import { computeHistory, replayHistory } from "./runtime-history";
import { computeAllReputations } from "./runtime-reputation";
import { storeLoadRuns } from "./runtime-store";

export interface IntelligenceReport {
  "history": ReturnType<typeof computeHistory>;
  "reputation": ReturnType<typeof computeAllReputations>;
  "recommendations": string[];
  "health-score": number;  // 0~100
}

export function computeIntelligence(filePath?: string): IntelligenceReport {
  const history = computeHistory(filePath);
  const reputation = computeAllReputations(filePath);
  const recommendations: string[] = [];

  // recommendation rules
  if (history["error-trend"] === "degrading") {
    recommendations.push("에러 증가 추세 감지 — runtime-analyze 실행 후 근본 원인 수정 권장");
  }
  if (history["budget-exceeded-runs"] > 0) {
    const pct = Math.round((history["budget-exceeded-runs"] / Math.max(history["total-runs"], 1)) * 100);
    recommendations.push(`예산 초과 발생 ${pct}% 실행 — max-ms/max-recursion 상향 또는 알고리즘 최적화 필요`);
  }
  if (history["panic-mode-runs"] > 0) {
    recommendations.push("panic 모드 진입 이력 있음 — auto:panic-cascade 컨트랙트 임계값 검토");
  }
  if (reputation.worstContract) {
    const worst = reputation.contracts[0];
    recommendations.push(
      `컨트랙트 '${worst.name}' 안정성 낮음 (score=${worst.score}, ${worst.affectedRuns}/${worst.totalRuns} 실행 위반) — 조건 완화 또는 로직 수정`
    );
  }
  if (history["most-frequent-issue"] === "slow-operation") {
    recommendations.push("반복적 느린 트레이스 감지 — I/O 병목 또는 캐시 전략 재검토");
  }
  if (recommendations.length === 0 && history["total-runs"] > 0) {
    recommendations.push("이상 패턴 없음 — 시스템 안정적");
  }
  if (history["total-runs"] === 0) {
    recommendations.push("저장된 실행 이력 없음 — (runtime-store-save) 먼저 실행");
  }

  // health score: 100 base, deductions
  let health = 100;
  if (history["error-trend"] === "degrading") health -= 20;
  if (history["error-trend"] === "stable" && history["avg-errors-per-run"] > 5) health -= 10;
  const budgetPct = history["total-runs"] > 0
    ? history["budget-exceeded-runs"] / history["total-runs"] : 0;
  health -= Math.round(budgetPct * 30);
  const panicPct = history["total-runs"] > 0
    ? history["panic-mode-runs"] / history["total-runs"] : 0;
  health -= Math.round(panicPct * 25);
  if (reputation.worstContract && reputation.contracts[0].verdict === "risky") health -= 15;
  health = Math.max(0, Math.min(100, health));

  return { history, reputation, recommendations, "health-score": health };
}

export { replayHistory };
