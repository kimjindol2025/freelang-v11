// wisdom.ts — FreeLang v9 Phase 149: [WISDOM]
// 지혜 (경험+판단 통합) — AI가 경험을 통해 쌓은 지혜로 더 나은 판단을 내리는 시스템

export interface Experience {
  id: string;
  situation: string;
  action: string;
  outcome: string;
  lesson: string;       // 배운 교훈
  success: boolean;
  importance: number;   // 0~1
  timestamp: Date;
  domain: string;       // 어떤 영역의 경험인가
}

export interface Heuristic {
  id: string;
  rule: string;         // "만약 X라면 Y를 하라"
  confidence: number;   // 0~1
  successCount: number;
  totalCount: number;
  domain: string;
  derivedFrom: string[]; // 어떤 경험들에서 도출됐는가
}

export interface WisdomJudgment {
  situation: string;
  recommendation: string;
  reasoning: string[];
  relevantExperiences: Experience[];
  applicableHeuristics: Heuristic[];
  confidence: number;
  caveats: string[];    // 주의 사항
  alternatives: string[];
}

let _expIdCounter = 0;
let _heuristicIdCounter = 0;

function genExpId(): string {
  return `exp-${++_expIdCounter}-${Date.now()}`;
}

function genHeuristicId(): string {
  return `heuristic-${++_heuristicIdCounter}-${Date.now()}`;
}

/**
 * 두 문자열 간 단어 기반 유사도 계산 (Jaccard 유사도)
 */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * 경험에서 패턴 추출 — 핵심 키워드 추출
 */
function extractPattern(exp: Experience): string {
  const words = [exp.situation, exp.action, exp.lesson]
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] ?? 0) + 1;
  }
  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);
  return topWords.join(', ');
}

/**
 * 경험 그룹을 휴리스틱으로 변환
 */
function experiencesToHeuristic(exps: Experience[], domain: string): Heuristic | null {
  if (exps.length === 0) return null;

  const successExps = exps.filter(e => e.success);
  const failExps = exps.filter(e => !e.success);

  // 성공 경험이 많은 경우: "이런 상황이면 이 액션을 하라"
  // 실패 경험이 많은 경우: "이런 상황이면 이 액션을 피하라"
  let rule: string;
  let confidence: number;

  if (successExps.length >= failExps.length) {
    const topLessons = successExps
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 2)
      .map(e => e.lesson);
    const topActions = successExps
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 1)
      .map(e => e.action);
    rule = `[${domain}] 유사 상황에서는 '${topActions[0] ?? ''}' 접근이 효과적. 핵심: ${topLessons.join('; ')}`;
    confidence = Math.min(0.95, 0.5 + (successExps.length / exps.length) * 0.5);
  } else {
    const topLessons = failExps
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 2)
      .map(e => e.lesson);
    const avoidActions = failExps
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 1)
      .map(e => e.action);
    rule = `[${domain}] 유사 상황에서 '${avoidActions[0] ?? ''}' 방식은 주의 필요. 교훈: ${topLessons.join('; ')}`;
    confidence = Math.min(0.8, 0.3 + (failExps.length / exps.length) * 0.4);
  }

  return {
    id: genHeuristicId(),
    rule,
    confidence,
    successCount: successExps.length,
    totalCount: exps.length,
    domain,
    derivedFrom: exps.map(e => e.id),
  };
}

export class WisdomEngine {
  private experiences: Experience[];
  private heuristics: Heuristic[];

  constructor() {
    this.experiences = [];
    this.heuristics = [];
  }

  /**
   * 경험 추가
   */
  addExperience(exp: Omit<Experience, 'id' | 'timestamp'>): Experience {
    const newExp: Experience = {
      ...exp,
      id: genExpId(),
      timestamp: new Date(),
    };
    this.experiences.push(newExp);
    return newExp;
  }

  /**
   * 경험에서 휴리스틱 추출 (도메인별 그룹화)
   */
  extractHeuristics(): Heuristic[] {
    const domainMap = new Map<string, Experience[]>();

    for (const exp of this.experiences) {
      const list = domainMap.get(exp.domain) ?? [];
      list.push(exp);
      domainMap.set(exp.domain, list);
    }

    const newHeuristics: Heuristic[] = [];
    for (const [domain, exps] of domainMap) {
      // 유사한 경험 그룹끼리 묶어 휴리스틱 생성
      const groups = this._groupSimilarExperiences(exps);
      for (const group of groups) {
        const h = experiencesToHeuristic(group, domain);
        if (h) {
          // 중복 방지: derivedFrom이 같은 휴리스틱이 이미 있으면 스킵
          const duplicate = this.heuristics.find(existing =>
            existing.domain === h.domain &&
            existing.derivedFrom.length === h.derivedFrom.length &&
            existing.derivedFrom.every(id => h.derivedFrom.includes(id))
          );
          if (!duplicate) {
            newHeuristics.push(h);
          }
        }
      }
    }

    this.heuristics.push(...newHeuristics);
    return this.heuristics;
  }

  /**
   * 유사한 경험들 그룹화
   */
  private _groupSimilarExperiences(exps: Experience[]): Experience[][] {
    if (exps.length === 0) return [];
    if (exps.length === 1) return [exps];

    const groups: Experience[][] = [];
    const used = new Set<string>();

    for (const exp of exps) {
      if (used.has(exp.id)) continue;
      const group: Experience[] = [exp];
      used.add(exp.id);

      for (const other of exps) {
        if (used.has(other.id)) continue;
        const sim = textSimilarity(exp.situation, other.situation);
        if (sim >= 0.2) {
          group.push(other);
          used.add(other.id);
        }
      }
      groups.push(group);
    }

    return groups;
  }

  /**
   * 상황에 맞는 경험 검색 (유사도 기반)
   */
  findRelevantExperiences(situation: string, limit: number = 5): Experience[] {
    return this.experiences
      .map(exp => ({
        exp,
        score: textSimilarity(situation, exp.situation) * 0.6 +
               textSimilarity(situation, exp.lesson) * 0.3 +
               exp.importance * 0.1,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ exp }) => exp);
  }

  /**
   * 지혜 판단 — 현재 상황에 대한 종합 판단
   */
  judge(situation: string): WisdomJudgment {
    const relevantExps = this.findRelevantExperiences(situation, 5);
    const applicableHeuristics = this._findApplicableHeuristics(situation, 3);

    const reasoning: string[] = [];
    const caveats: string[] = [];
    const alternatives: string[] = [];

    // 관련 경험에서 추론
    const successExps = relevantExps.filter(e => e.success);
    const failExps = relevantExps.filter(e => !e.success);

    if (successExps.length > 0) {
      reasoning.push(`유사한 성공 경험 ${successExps.length}건 발견: ${successExps.map(e => e.lesson).join('; ')}`);
    }
    if (failExps.length > 0) {
      reasoning.push(`유사한 실패 경험 ${failExps.length}건 발견: ${failExps.map(e => e.lesson).join('; ')}`);
      caveats.push(`과거 실패 패턴 주의: ${failExps.map(e => e.action).join(', ')}`);
    }

    // 휴리스틱에서 추론
    for (const h of applicableHeuristics) {
      reasoning.push(`적용 가능한 규칙(신뢰도 ${(h.confidence * 100).toFixed(0)}%): ${h.rule}`);
      if (h.confidence < 0.6) {
        caveats.push(`휴리스틱 '${h.rule.slice(0, 40)}...'의 신뢰도가 낮음 (${(h.confidence * 100).toFixed(0)}%)`);
      }
    }

    // 권고사항 생성
    let recommendation: string;
    let confidence: number;

    if (relevantExps.length === 0 && applicableHeuristics.length === 0) {
      recommendation = '관련 경험이 부족합니다. 신중하게 접근하고 결과를 기록하여 지혜를 축적하세요.';
      confidence = 0.2;
      caveats.push('경험이 부족한 영역입니다');
      alternatives.push('소규모 실험으로 시작하여 경험을 쌓을 것');
      alternatives.push('유사 분야 전문가의 의견 참고');
    } else {
      const successRate = relevantExps.length > 0
        ? successExps.length / relevantExps.length
        : 0.5;

      if (successRate >= 0.7) {
        const bestExp = successExps.sort((a, b) => b.importance - a.importance)[0];
        recommendation = bestExp
          ? `유사 성공 경험 기반: '${bestExp.action}' 접근법 권장. ${bestExp.lesson}`
          : '과거 성공 패턴을 따르는 것을 권장합니다.';
        confidence = Math.min(0.9, 0.5 + successRate * 0.4);
        alternatives.push('점진적 접근법으로 리스크 최소화');
      } else if (successRate >= 0.4) {
        recommendation = '혼합된 경험이 있습니다. 신중하게 접근하되, 성공 경험의 교훈을 적극 활용하세요.';
        confidence = 0.5 + successRate * 0.2;
        alternatives.push('실패 경험에서 피해야 할 패턴 식별');
        alternatives.push('단계별 검증을 통한 리스크 관리');
      } else {
        const worstExp = failExps.sort((a, b) => b.importance - a.importance)[0];
        recommendation = worstExp
          ? `유사 실패 경험 다수: '${worstExp.action}' 방식은 피할 것. 대신 다른 접근법 탐색 필요.`
          : '과거 실패 패턴이 많습니다. 다른 접근법을 모색하세요.';
        confidence = 0.4;
        caveats.push('이 방향의 과거 성공률이 낮습니다');
        alternatives.push('근본적으로 다른 접근법 고려');
        alternatives.push('실패 원인 분석 후 재설계');
      }
    }

    if (reasoning.length === 0) {
      reasoning.push('직접적으로 관련된 경험이나 규칙이 없습니다');
    }

    return {
      situation,
      recommendation,
      reasoning,
      relevantExperiences: relevantExps,
      applicableHeuristics,
      confidence,
      caveats,
      alternatives,
    };
  }

  /**
   * 적용 가능한 휴리스틱 찾기
   */
  private _findApplicableHeuristics(situation: string, limit: number = 3): Heuristic[] {
    return this.heuristics
      .map(h => ({
        h,
        score: textSimilarity(situation, h.rule) * h.confidence,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ h }) => h);
  }

  /**
   * 도메인별 요약
   */
  summarizeDomain(domain: string): {
    topLessons: string[];
    bestHeuristics: Heuristic[];
    successRate: number;
  } {
    const domainExps = this.experiences.filter(e => e.domain === domain);
    const domainHeuristics = this.heuristics.filter(h => h.domain === domain);

    const successCount = domainExps.filter(e => e.success).length;
    const successRate = domainExps.length > 0
      ? successCount / domainExps.length
      : 0;

    const topLessons = domainExps
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5)
      .map(e => e.lesson)
      .filter((lesson, idx, arr) => arr.indexOf(lesson) === idx); // 중복 제거

    const bestHeuristics = domainHeuristics
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    return { topLessons, bestHeuristics, successRate };
  }

  /**
   * 경험 유효성 검사 (최근 180일 이내 경험만 유효)
   */
  isStillValid(experience: Experience): boolean {
    const now = new Date();
    const ageMs = now.getTime() - experience.timestamp.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // 중요도가 높은 경험은 더 오래 유효
    const validDays = 180 + experience.importance * 180; // 180~360일
    return ageDays <= validDays;
  }

  /**
   * 지혜 점수 계산 (경험의 깊이 + 판단력)
   */
  wisdomScore(): number {
    if (this.experiences.length === 0) return 0;

    // 경험 다양성 (도메인 수)
    const domains = new Set(this.experiences.map(e => e.domain)).size;
    const diversityScore = Math.min(1, domains / 5) * 0.25;

    // 경험 깊이 (경험 수)
    const depthScore = Math.min(1, this.experiences.length / 20) * 0.25;

    // 성공률
    const successRate = this.experiences.filter(e => e.success).length / this.experiences.length;
    const successScore = successRate * 0.25;

    // 휴리스틱 품질 (평균 신뢰도)
    const avgConfidence = this.heuristics.length > 0
      ? this.heuristics.reduce((sum, h) => sum + h.confidence, 0) / this.heuristics.length
      : 0;
    const heuristicScore = avgConfidence * 0.25;

    return diversityScore + depthScore + successScore + heuristicScore;
  }

  /**
   * 교훈 목록 반환
   */
  getLessons(domain?: string): string[] {
    const exps = domain
      ? this.experiences.filter(e => e.domain === domain)
      : this.experiences;

    return exps
      .sort((a, b) => b.importance - a.importance)
      .map(e => e.lesson)
      .filter((lesson, idx, arr) => arr.indexOf(lesson) === idx); // 중복 제거
  }

  /**
   * 유사 상황 과거 사례 반환
   */
  findSimilarCases(situation: string): Experience[] {
    return this.findRelevantExperiences(situation, 10)
      .filter(exp => textSimilarity(situation, exp.situation) > 0.1);
  }

  /**
   * 전체 경험 목록 반환
   */
  getExperiences(): Experience[] {
    return [...this.experiences];
  }

  /**
   * 전체 휴리스틱 목록 반환
   */
  getHeuristics(): Heuristic[] {
    return [...this.heuristics];
  }
}

export const globalWisdom: WisdomEngine = new WisdomEngine();
