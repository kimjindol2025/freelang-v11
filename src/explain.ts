// explain.ts — FreeLang v9 Phase 145: EXPLAIN — 설명 가능한 AI (XAI)
// AI 결정/추론을 인간이 이해할 수 있도록 설명하는 시스템

export interface FeatureImportance {
  feature: string;
  importance: number;          // 0~1
  direction: 'positive' | 'negative'; // 결과에 미치는 방향
  description: string;
}

export interface DecisionExplanation {
  decision: unknown;
  reasoning: string[];         // 단계별 이유
  features: FeatureImportance[];
  confidence: number;
  alternatives: Array<{
    decision: unknown;
    reason: string;
    probability: number;
  }>;
  summary: string;
  audience: 'technical' | 'general';
}

export interface LocalExplanation {
  input: Record<string, unknown>;
  output: unknown;
  topFactors: FeatureImportance[];
  counterfactual: string;      // "만약 X가 달랐다면 Y가 됐을 것"
  confidence: number;
}

export class Explainer {
  /**
   * 결정 설명 — factors로부터 reasoning, features, alternatives를 생성
   */
  explain(
    decision: unknown,
    factors: Record<string, number>,
    context?: string
  ): DecisionExplanation {
    const entries = Object.entries(factors);
    const total = entries.reduce((s, [, v]) => s + Math.abs(v), 0) || 1;

    // 특성 중요도 계산
    const features: FeatureImportance[] = entries
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([feature, value]) => ({
        feature,
        importance: Math.min(Math.abs(value) / total, 1),
        direction: value >= 0 ? 'positive' : 'negative',
        description: `${feature}은(는) 결정에 ${value >= 0 ? '긍정적' : '부정적'} 영향을 미쳤습니다 (가중치: ${value.toFixed(3)})`,
      }));

    // 단계별 이유 생성
    const reasoning: string[] = [];
    if (context) reasoning.push(`컨텍스트: ${context}`);
    reasoning.push(`총 ${features.length}개의 요인을 분석했습니다`);
    if (features.length > 0) {
      reasoning.push(`가장 중요한 요인: "${features[0].feature}" (중요도: ${(features[0].importance * 100).toFixed(1)}%)`);
    }
    const positives = features.filter(f => f.direction === 'positive');
    const negatives = features.filter(f => f.direction === 'negative');
    if (positives.length > 0) {
      reasoning.push(`긍정적 요인 ${positives.length}개: ${positives.map(f => f.feature).join(', ')}`);
    }
    if (negatives.length > 0) {
      reasoning.push(`부정적 요인 ${negatives.length}개: ${negatives.map(f => f.feature).join(', ')}`);
    }
    reasoning.push(`최종 결정: "${String(decision)}"`);

    // 신뢰도 계산 (중요도 분산이 낮을수록 불확실)
    const topImportance = features.length > 0 ? features[0].importance : 0;
    const confidence = Math.min(0.5 + topImportance * 0.5, 1.0);

    // 대안 생성
    const alternatives: DecisionExplanation['alternatives'] = [];
    if (features.length > 0 && features[0].direction === 'positive') {
      alternatives.push({
        decision: `not-${String(decision)}`,
        reason: `"${features[0].feature}"의 값이 낮았다면 다른 결정을 내렸을 것입니다`,
        probability: Math.max(0, 1 - confidence),
      });
    }
    if (features.length > 1) {
      alternatives.push({
        decision: 'uncertain',
        reason: `요인들 간의 균형이 달랐다면 결정이 달라졌을 수 있습니다`,
        probability: Math.round((1 - confidence) * 0.5 * 100) / 100,
      });
    }

    const summary = `"${String(decision)}" 결정은 신뢰도 ${(confidence * 100).toFixed(0)}%로, ${features.length}개 요인 분석 결과입니다`;

    return {
      decision,
      reasoning,
      features,
      confidence,
      alternatives,
      summary,
      audience: 'technical',
    };
  }

  /**
   * 특성 중요도 계산 (SHAP-like 방식)
   * baseline과의 차이로 각 입력 특성의 기여도를 계산
   */
  featureImportance(
    inputs: Record<string, number>,
    outputs: Record<string, number>,
    baselineOutputs?: Record<string, number>
  ): FeatureImportance[] {
    const inputEntries = Object.entries(inputs);
    const outputValues = Object.values(outputs);
    const outputMean = outputValues.reduce((s, v) => s + v, 0) / (outputValues.length || 1);

    const baselineValues = baselineOutputs ? Object.values(baselineOutputs) : [];
    const baselineMean = baselineValues.length > 0
      ? baselineValues.reduce((s, v) => s + v, 0) / baselineValues.length
      : 0;

    const delta = outputMean - baselineMean;

    // 각 입력 특성의 기여도 계산 (값 크기 × 출력 변화)
    const contributions = inputEntries.map(([feature, value]) => {
      const absVal = Math.abs(value);
      const contribution = absVal * Math.abs(delta) * Math.sign(value) * Math.sign(delta || 1);
      return { feature, contribution };
    });

    const totalAbs = contributions.reduce((s, c) => s + Math.abs(c.contribution), 0) || 1;

    return contributions
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .map(({ feature, contribution }) => ({
        feature,
        importance: Math.min(Math.abs(contribution) / totalAbs, 1),
        direction: contribution >= 0 ? 'positive' : 'negative',
        description: `${feature}: 출력에 ${contribution >= 0 ? '긍정적' : '부정적'} 기여 (${contribution.toFixed(4)})`,
      }));
  }

  /**
   * 로컬 설명 — 단일 예측에 대한 설명
   */
  localExplain(
    input: Record<string, unknown>,
    output: unknown,
    model: (input: Record<string, unknown>) => unknown
  ): LocalExplanation {
    const inputEntries = Object.entries(input);

    // 각 특성을 변화시켰을 때의 영향 계산 (퍼터베이션)
    const factors: FeatureImportance[] = inputEntries.map(([feature, value]) => {
      // 숫자 특성의 경우 약간 변형해서 영향 측정
      let perturbedInput: Record<string, unknown>;
      if (typeof value === 'number') {
        perturbedInput = { ...input, [feature]: value * 1.1 + 0.01 };
      } else if (typeof value === 'string') {
        perturbedInput = { ...input, [feature]: '' };
      } else {
        perturbedInput = { ...input, [feature]: null };
      }

      let sensitivity = 0.5; // 기본값
      try {
        const altOutput = model(perturbedInput);
        const outStr = String(output);
        const altStr = String(altOutput);
        sensitivity = outStr !== altStr ? 0.8 : 0.2;
      } catch {
        sensitivity = 0.3;
      }

      return {
        feature,
        importance: sensitivity,
        direction: 'positive' as const,
        description: `${feature} = ${JSON.stringify(value)} (민감도: ${(sensitivity * 100).toFixed(0)}%)`,
      };
    });

    // 정규화
    const totalImportance = factors.reduce((s, f) => s + f.importance, 0) || 1;
    const topFactors = factors
      .map(f => ({ ...f, importance: f.importance / totalImportance }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);

    // 가장 중요한 특성에 대한 반사실 설명
    const topFeature = topFactors[0];
    const topValue = topFeature ? input[topFeature.feature] : undefined;
    const counterfactual = topFeature
      ? `만약 "${topFeature.feature}"의 값이 "${String(topValue)}"가 아니었다면, 결과가 "${String(output)}"이 되지 않았을 가능성이 높습니다`
      : `입력 특성들이 달랐다면 결과가 달라졌을 것입니다`;

    const confidence = topFactors.length > 0 ? topFactors[0].importance : 0.5;

    return {
      input,
      output,
      topFactors,
      counterfactual,
      confidence,
    };
  }

  /**
   * 자연어 설명 생성
   */
  toNaturalLanguage(
    explanation: DecisionExplanation,
    audience?: 'technical' | 'general'
  ): string {
    const target = audience ?? explanation.audience;

    if (target === 'general') {
      const topFeature = explanation.features[0];
      let text = `이 AI는 "${String(explanation.decision)}"라고 결정했습니다.\n\n`;
      text += `이유: ${explanation.reasoning.slice(-1)[0] ?? '분석 완료'}\n`;
      if (topFeature) {
        text += `가장 중요한 이유는 "${topFeature.feature}" 때문입니다.\n`;
      }
      text += `이 결정의 확실성은 ${(explanation.confidence * 100).toFixed(0)}% 정도입니다.`;
      if (explanation.alternatives.length > 0) {
        text += `\n\n다른 가능성: ${explanation.alternatives[0].reason}`;
      }
      return text;
    }

    // technical
    let text = `[기술적 설명]\n`;
    text += `결정: ${JSON.stringify(explanation.decision)}\n`;
    text += `신뢰도: ${(explanation.confidence * 100).toFixed(2)}%\n\n`;
    text += `추론 단계:\n`;
    explanation.reasoning.forEach((r, i) => {
      text += `  ${i + 1}. ${r}\n`;
    });
    text += `\n특성 중요도 (상위):\n`;
    explanation.features.slice(0, 5).forEach(f => {
      const bar = '█'.repeat(Math.round(f.importance * 10));
      text += `  ${f.feature}: ${bar} ${(f.importance * 100).toFixed(1)}% [${f.direction}]\n`;
    });
    if (explanation.alternatives.length > 0) {
      text += `\n대안:\n`;
      explanation.alternatives.forEach(a => {
        text += `  - "${String(a.decision)}": ${a.reason} (확률: ${(a.probability * 100).toFixed(1)}%)\n`;
      });
    }
    text += `\n요약: ${explanation.summary}`;
    return text;
  }

  /**
   * 대조 설명 ("A가 아니라 B인 이유")
   */
  contrastiveExplain(
    decision: unknown,
    alternative: unknown,
    factors: Record<string, number>
  ): string {
    const entries = Object.entries(factors).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const topEntries = entries.slice(0, 3);

    let explanation = `"${String(alternative)}" 대신 "${String(decision)}"을(를) 선택한 이유:\n\n`;

    topEntries.forEach(([feature, value], i) => {
      const direction = value > 0 ? '높은' : '낮은';
      explanation += `${i + 1}. ${feature}의 ${direction} 값(${value.toFixed(3)})이 "${String(decision)}"을 지지했습니다.\n`;
    });

    if (entries.length > 3) {
      explanation += `\n(외 ${entries.length - 3}개 요인도 영향을 미쳤습니다)\n`;
    }

    const dominantFactor = topEntries[0];
    if (dominantFactor) {
      explanation += `\n핵심: "${dominantFactor[0]}" 요인이 결정적 역할을 했습니다. 이 요인이 없었다면 "${String(alternative)}"가 선택됐을 것입니다.`;
    }

    return explanation;
  }

  /**
   * 규칙 추출 — 입력/출력 예시에서 간단한 if-then 규칙 추출
   */
  extractRules(
    examples: Array<{ input: Record<string, unknown>; output: unknown }>
  ): Array<{ condition: string; outcome: unknown; support: number }> {
    if (examples.length === 0) return [];

    // 출력별로 그룹화
    const groups = new Map<string, typeof examples>();
    for (const ex of examples) {
      const key = JSON.stringify(ex.output);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ex);
    }

    const rules: Array<{ condition: string; outcome: unknown; support: number }> = [];
    const total = examples.length;

    for (const [, group] of groups) {
      const outcome = group[0].output;
      const support = group.length / total;

      // 공통 입력 특성 찾기
      if (group.length === 0) continue;

      const firstInput = group[0].input;
      const inputKeys = Object.keys(firstInput);
      const commonConditions: string[] = [];

      for (const key of inputKeys) {
        const values = group.map(ex => ex.input[key]);
        const uniqueValues = [...new Set(values.map(v => JSON.stringify(v)))];

        if (uniqueValues.length === 1) {
          // 모든 예시가 같은 값을 가짐
          commonConditions.push(`${key} = ${uniqueValues[0]}`);
        } else if (values.every(v => typeof v === 'number')) {
          // 숫자형: 범위 조건
          const nums = values as number[];
          const min = Math.min(...nums);
          const max = Math.max(...nums);
          if (max - min < Math.abs(min + max) * 0.5) {
            commonConditions.push(`${key} ∈ [${min.toFixed(2)}, ${max.toFixed(2)}]`);
          }
        }
      }

      const condition = commonConditions.length > 0
        ? commonConditions.join(' AND ')
        : `출력이 "${JSON.stringify(outcome)}"인 경우`;

      rules.push({ condition, outcome, support });
    }

    return rules.sort((a, b) => b.support - a.support);
  }
}

export const globalExplainer = new Explainer();
