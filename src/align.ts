// align.ts — Phase 146: [ALIGN] 목표 정렬 시스템
// AI의 행동이 목표/가치와 정렬되어 있는지 확인하고 교정하는 시스템

export interface Goal {
  id: string;
  description: string;
  priority: number;       // 1~10 (10이 최고 우선순위)
  measurable: boolean;    // 측정 가능 여부
  metric?: string;        // 측정 지표
  target?: number;        // 목표값
}

export interface Value {
  id: string;
  name: string;
  description: string;
  weight: number;         // 상대적 중요도 0~1
}

export interface Action {
  id: string;
  description: string;
  expectedOutcomes: Record<string, number>; // goal_id → 기여도
  risks: string[];
}

export interface AlignmentScore {
  action: Action;
  goalAlignment: Record<string, number>;  // goal_id → 정렬도 0~1
  valueAlignment: Record<string, number>; // value_id → 정렬도 0~1
  overallScore: number;                   // 종합 정렬도
  conflicts: Array<{
    goal1: string;
    goal2: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  recommendation: 'proceed' | 'caution' | 'reject';
  reasons: string[];
}

export class AlignmentSystem {
  private goals: Map<string, Goal>;
  private values: Map<string, Value>;

  constructor() {
    this.goals = new Map();
    this.values = new Map();
  }

  addGoal(goal: Goal): void {
    // 우선순위 범위 검증
    if (goal.priority < 1) goal = { ...goal, priority: 1 };
    if (goal.priority > 10) goal = { ...goal, priority: 10 };
    this.goals.set(goal.id, goal);
  }

  addValue(value: Value): void {
    // 가중치 범위 검증
    if (value.weight < 0) value = { ...value, weight: 0 };
    if (value.weight > 1) value = { ...value, weight: 1 };
    this.values.set(value.id, value);
  }

  // 행동의 목표/가치 정렬도 계산
  score(action: Action): AlignmentScore {
    const goalAlignment: Record<string, number> = {};
    const valueAlignment: Record<string, number> = {};
    const reasons: string[] = [];

    // 목표별 정렬도 계산
    for (const [goalId, goal] of this.goals) {
      const outcome = action.expectedOutcomes[goalId] ?? 0;
      // outcome을 -1~1 범위라고 가정, 0~1로 정규화
      const normalized = Math.max(0, Math.min(1, (outcome + 1) / 2));
      goalAlignment[goalId] = normalized;

      if (normalized >= 0.7) {
        reasons.push(`목표 "${goal.description}" 달성에 기여 (${(normalized * 100).toFixed(0)}%)`);
      } else if (normalized < 0.3) {
        reasons.push(`목표 "${goal.description}" 달성에 부정적 영향 (${(normalized * 100).toFixed(0)}%)`);
      }
    }

    // 가치 정렬도 계산 (리스크 기반)
    for (const [valueId, value] of this.values) {
      // 위험 요소가 가치 키워드를 포함하면 정렬도 감소
      let valueScore = 1.0;
      for (const risk of action.risks) {
        const riskLower = risk.toLowerCase();
        const valueLower = value.name.toLowerCase();
        const descLower = value.description.toLowerCase();
        if (riskLower.includes(valueLower) || riskLower.includes(descLower.split(' ')[0])) {
          valueScore -= 0.3;
        }
        // 일반적인 위험 키워드
        if (riskLower.includes('harm') || riskLower.includes('위험') || riskLower.includes('거짓') || riskLower.includes('속임')) {
          valueScore -= 0.2 * value.weight;
        }
      }
      valueAlignment[valueId] = Math.max(0, Math.min(1, valueScore));
    }

    // 충돌 감지
    const conflicts: AlignmentScore['conflicts'] = this._detectActionConflicts(action, goalAlignment);

    // 종합 정렬도 계산 (목표 우선순위 가중 평균 + 가치 가중 평균)
    let goalScore = 0;
    let totalGoalWeight = 0;
    for (const [goalId, goal] of this.goals) {
      const weight = goal.priority / 10;
      goalScore += (goalAlignment[goalId] ?? 0) * weight;
      totalGoalWeight += weight;
    }
    const avgGoalScore = totalGoalWeight > 0 ? goalScore / totalGoalWeight : 0.5;

    let valueScore = 0;
    let totalValueWeight = 0;
    for (const [valueId, value] of this.values) {
      valueScore += (valueAlignment[valueId] ?? 1) * value.weight;
      totalValueWeight += value.weight;
    }
    const avgValueScore = totalValueWeight > 0 ? valueScore / totalValueWeight : 1.0;

    // 충돌 패널티
    let conflictPenalty = 0;
    for (const c of conflicts) {
      if (c.severity === 'high') conflictPenalty += 0.3;
      else if (c.severity === 'medium') conflictPenalty += 0.15;
      else conflictPenalty += 0.05;
    }

    const overallScore = Math.max(0, Math.min(1,
      avgGoalScore * 0.6 + avgValueScore * 0.4 - conflictPenalty
    ));

    // 권고 결정
    let recommendation: 'proceed' | 'caution' | 'reject';
    if (overallScore >= 0.65 && conflictPenalty < 0.3) {
      recommendation = 'proceed';
    } else if (overallScore >= 0.35 && conflictPenalty < 0.6) {
      recommendation = 'caution';
    } else {
      recommendation = 'reject';
      reasons.push('종합 정렬도가 너무 낮거나 심각한 충돌이 있음');
    }

    if (conflicts.length > 0) {
      reasons.push(`${conflicts.length}개의 목표 충돌 감지됨`);
    }

    return {
      action,
      goalAlignment,
      valueAlignment,
      overallScore,
      conflicts,
      recommendation,
      reasons,
    };
  }

  private _detectActionConflicts(
    action: Action,
    goalAlignment: Record<string, number>
  ): AlignmentScore['conflicts'] {
    const conflicts: AlignmentScore['conflicts'] = [];
    const goalIds = Array.from(this.goals.keys());

    for (let i = 0; i < goalIds.length; i++) {
      for (let j = i + 1; j < goalIds.length; j++) {
        const g1 = goalIds[i];
        const g2 = goalIds[j];
        const score1 = goalAlignment[g1] ?? 0.5;
        const score2 = goalAlignment[g2] ?? 0.5;

        // 한 목표에 매우 긍정적이고 다른 목표에 매우 부정적이면 충돌
        const diff = Math.abs(score1 - score2);
        if (diff > 0.6) {
          conflicts.push({ goal1: g1, goal2: g2, severity: 'high' });
        } else if (diff > 0.4) {
          conflicts.push({ goal1: g1, goal2: g2, severity: 'medium' });
        } else if (diff > 0.25) {
          conflicts.push({ goal1: g1, goal2: g2, severity: 'low' });
        }
      }
    }

    return conflicts;
  }

  // 여러 행동 중 가장 잘 정렬된 것 선택
  selectBestAligned(actions: Action[]): Action {
    if (actions.length === 0) throw new Error('행동 목록이 비어있음');
    if (actions.length === 1) return actions[0];

    let best = actions[0];
    let bestScore = this.score(actions[0]).overallScore;

    for (let i = 1; i < actions.length; i++) {
      const s = this.score(actions[i]).overallScore;
      if (s > bestScore) {
        bestScore = s;
        best = actions[i];
      }
    }

    return best;
  }

  // 목표 간 충돌 감지
  detectConflicts(): Array<{ goal1: string; goal2: string; description: string }> {
    const conflicts: Array<{ goal1: string; goal2: string; description: string }> = [];
    const goalList = Array.from(this.goals.values());

    for (let i = 0; i < goalList.length; i++) {
      for (let j = i + 1; j < goalList.length; j++) {
        const g1 = goalList[i];
        const g2 = goalList[j];

        // 우선순위 차이가 크면 잠재적 충돌
        const priorityDiff = Math.abs(g1.priority - g2.priority);
        if (priorityDiff >= 5) {
          conflicts.push({
            goal1: g1.id,
            goal2: g2.id,
            description: `우선순위 차이 ${priorityDiff}: "${g1.description}" vs "${g2.description}"`,
          });
        }

        // 측정 가능한 목표와 추상적 목표의 충돌
        if (g1.measurable !== g2.measurable && priorityDiff >= 3) {
          conflicts.push({
            goal1: g1.id,
            goal2: g2.id,
            description: `측정 가능성 불일치: "${g1.description}" (${g1.measurable ? '측정가능' : '추상적'}) vs "${g2.description}" (${g2.measurable ? '측정가능' : '추상적'})`,
          });
        }
      }
    }

    return conflicts;
  }

  // 행동 계획의 전체 정렬도
  evaluatePlan(actions: Action[]): {
    overallAlignment: number;
    weakLinks: Action[];
    summary: string;
  } {
    if (actions.length === 0) {
      return { overallAlignment: 0, weakLinks: [], summary: '계획이 비어있음' };
    }

    const scores = actions.map(a => ({ action: a, result: this.score(a) }));
    const avgScore = scores.reduce((sum, s) => sum + s.result.overallScore, 0) / scores.length;

    const weakLinks = scores
      .filter(s => s.result.overallScore < 0.4 || s.result.recommendation === 'reject')
      .map(s => s.action);

    const rejectCount = scores.filter(s => s.result.recommendation === 'reject').length;
    const cautionCount = scores.filter(s => s.result.recommendation === 'caution').length;
    const proceedCount = scores.filter(s => s.result.recommendation === 'proceed').length;

    const summary = [
      `계획 ${actions.length}개 행동 평가:`,
      `  - 진행 권고: ${proceedCount}개`,
      `  - 주의 필요: ${cautionCount}개`,
      `  - 거부 권고: ${rejectCount}개`,
      `  - 전체 정렬도: ${(avgScore * 100).toFixed(1)}%`,
      weakLinks.length > 0 ? `  - 취약 고리 ${weakLinks.length}개 발견` : '  - 취약 고리 없음',
    ].join('\n');

    return {
      overallAlignment: avgScore,
      weakLinks,
      summary,
    };
  }

  // 정렬도 개선 제안
  suggestImprovements(action: Action): string[] {
    const result = this.score(action);
    const suggestions: string[] = [];

    // 낮은 목표 정렬도에 대한 제안
    for (const [goalId, alignment] of Object.entries(result.goalAlignment)) {
      if (alignment < 0.5) {
        const goal = this.goals.get(goalId);
        if (goal) {
          suggestions.push(
            `목표 "${goal.description}" 기여도 향상 필요 (현재 ${(alignment * 100).toFixed(0)}%): expectedOutcomes["${goalId}"]를 높이세요`
          );
        }
      }
    }

    // 낮은 가치 정렬도에 대한 제안
    for (const [valueId, alignment] of Object.entries(result.valueAlignment)) {
      if (alignment < 0.7) {
        const value = this.values.get(valueId);
        if (value) {
          suggestions.push(
            `가치 "${value.name}" 위반 위험 있음 (정렬도 ${(alignment * 100).toFixed(0)}%): 관련 리스크 요인을 제거하세요`
          );
        }
      }
    }

    // 충돌에 대한 제안
    for (const conflict of result.conflicts) {
      const g1 = this.goals.get(conflict.goal1);
      const g2 = this.goals.get(conflict.goal2);
      if (g1 && g2) {
        suggestions.push(
          `충돌(${conflict.severity}): "${g1.description}"와 "${g2.description}" 사이의 절충안 고려`
        );
      }
    }

    // 위험 요소에 대한 제안
    if (action.risks.length > 2) {
      suggestions.push(`리스크가 ${action.risks.length}개로 많습니다. 리스크 완화 전략을 수립하세요`);
    }

    if (suggestions.length === 0) {
      suggestions.push('현재 정렬도가 양호합니다. 유지하세요.');
    }

    return suggestions;
  }

  // 목표 우선순위 정렬
  prioritizeGoals(): Goal[] {
    return Array.from(this.goals.values()).sort((a, b) => b.priority - a.priority);
  }

  // 목표 목록 조회
  getGoals(): Map<string, Goal> {
    return new Map(this.goals);
  }

  // 가치 목록 조회
  getValues(): Map<string, Value> {
    return new Map(this.values);
  }
}

export const globalAlignment = new AlignmentSystem();
