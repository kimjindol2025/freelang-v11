var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ext-experiments.ts
var ext_experiments_exports = {};
__export(ext_experiments_exports, {
  AgentChain: () => AgentChain,
  defaultFinders: () => defaultFinders,
  globalAnalogy: () => globalAnalogy,
  globalBeliefs: () => globalBeliefs,
  globalCheckpoint: () => globalCheckpoint,
  globalCognition: () => globalCognition,
  globalCompetition: () => globalCompetition,
  globalComposer: () => globalComposer,
  globalConsensus: () => globalConsensus,
  globalCritique: () => globalCritique,
  globalDebater: () => globalDebater,
  globalDelegation: () => globalDelegation,
  globalHub: () => globalHub,
  globalMetaReasoner: () => globalMetaReasoner,
  globalNegotiator: () => globalNegotiator,
  globalOrchestrator: () => globalOrchestrator,
  globalPeerReview: () => globalPeerReview,
  globalSwarm: () => globalSwarm,
  globalVoting: () => globalVoting,
  severityWeight: () => severityWeight
});
module.exports = __toCommonJS(ext_experiments_exports);

// src/experiments/debate.ts
var Debater = class {
  debate(config) {
    const { proposition, pro, con, rounds = 3 } = config;
    const judge = config.judge ?? ((p, c) => p > c ? "pro" : c > p ? "con" : "tie");
    const debateRounds = [];
    const proArgs = [];
    const conArgs = [];
    for (let r = 1; r <= rounds; r++) {
      const proArg = pro(r, conArgs);
      proArgs.push(proArg);
      const conArg = con(r, proArgs);
      conArgs.push(conArg);
      debateRounds.push({ round: r, proArgument: proArg, conArgument: conArg });
    }
    const proScore = proArgs.reduce((s, a) => s + a.strength, 0) / proArgs.length;
    const conScore = conArgs.reduce((s, a) => s + a.strength, 0) / conArgs.length;
    const winner = judge(proScore, conScore);
    const conclusion = winner === "tie" ? `"${proposition}" \u2014 \uD33D\uD33D\uD55C \uB17C\uC7C1 (pro: ${proScore.toFixed(2)}, con: ${conScore.toFixed(2)})` : `"${proposition}" \u2014 ${winner === "pro" ? "\uCC44\uD0DD" : "\uAE30\uAC01"} (\uC2B9\uC790: ${winner})`;
    return { proposition, winner, proScore, conScore, rounds: debateRounds, conclusion };
  }
};
var globalDebater = new Debater();

// src/experiments/checkpoint.ts
var CheckpointManager = class {
  constructor() {
    this.checkpoints = /* @__PURE__ */ new Map();
    this.depth = 0;
  }
  /** 상태 저장 (깊은 복사) */
  save(name, state) {
    const cloned = typeof structuredClone === "function" ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    const entry = {
      name,
      state: cloned,
      timestamp: Date.now(),
      depth: this.depth
    };
    if (!this.checkpoints.has(name)) this.checkpoints.set(name, []);
    this.checkpoints.get(name).push(entry);
  }
  /** 최신 버전 복원 */
  restore(name) {
    const entries = this.checkpoints.get(name);
    if (!entries || entries.length === 0) return null;
    return entries[entries.length - 1].state;
  }
  /** 특정 인덱스 버전 복원 */
  restoreAt(name, index) {
    const entries = this.checkpoints.get(name);
    if (!entries || index < 0 || index >= entries.length) return null;
    return entries[index].state;
  }
  /** 전체 엔트리 조회 (timestamp 포함) */
  getEntries(name) {
    return this.checkpoints.get(name) ?? [];
  }
  /**
   * 분기 시도: fn 실패 시 자동 복원
   * 성공 → { success: true, result, restored: state }
   * 실패 → { success: false, restored: <saved state> }
   */
  branch(name, state, fn) {
    this.save(name, state);
    this.depth++;
    try {
      const result = fn(state);
      this.depth--;
      return { success: true, result, restored: state };
    } catch (_e) {
      this.depth--;
      const restored = this.restore(name);
      return { success: false, restored };
    }
  }
  /** 체크포인트 삭제 */
  drop(name) {
    return this.checkpoints.delete(name);
  }
  /** 저장된 이름 목록 */
  list() {
    return [...this.checkpoints.keys()];
  }
  /** 특정 이름의 버전 수 */
  versions(name) {
    return this.checkpoints.get(name)?.length ?? 0;
  }
  /** 현재 branch 깊이 */
  getDepth() {
    return this.depth;
  }
  /** 전체 초기화 */
  clear() {
    this.checkpoints.clear();
    this.depth = 0;
  }
};
var globalCheckpoint = new CheckpointManager();

// src/experiments/meta-reason.ts
var ALL_STRATEGIES = ["COT", "TOT", "HYPOTHESIS", "DEBATE", "REFLECT", "DIRECT"];
function scoreStrategy(problem, strategy) {
  const p = problem.toLowerCase();
  let score = 0.5;
  let reason = "";
  switch (strategy) {
    case "COT":
      score = p.includes("step") || p.includes("\uB2E8\uACC4") || p.includes("\uC21C\uC11C") || p.includes("how") ? 0.9 : 0.5;
      reason = "\uC21C\uCC28\uC801 \uB2E8\uACC4 \uCD94\uB860";
      break;
    case "TOT":
      score = p.includes("option") || p.includes("\uBC29\uBC95") || p.includes("compare") || p.includes("which") ? 0.9 : 0.4;
      reason = "\uBD84\uAE30 \uD0D0\uC0C9 \uD544\uC694";
      break;
    case "HYPOTHESIS":
      score = p.includes("verify") || p.includes("\uB9DE") || p.includes("correct") || p.includes("true") ? 0.85 : 0.4;
      reason = "\uAC00\uC124 \uAC80\uC99D \uD544\uC694";
      break;
    case "DEBATE":
      score = p.includes("should") || p.includes("better") || p.includes("vs") || p.includes("\uACB0\uC815") ? 0.85 : 0.35;
      reason = "\uCC2C\uBC18 \uAD6C\uC870 \uBD84\uC11D";
      break;
    case "REFLECT":
      score = p.includes("quality") || p.includes("improve") || p.includes("review") || p.includes("\uD3C9\uAC00") ? 0.8 : 0.4;
      reason = "\uC790\uAE30 \uD3C9\uAC00 \uD544\uC694";
      break;
    case "DIRECT":
      score = p.length < 30 ? 0.8 : 0.3;
      reason = "\uB2E8\uC21C \uC9C1\uC811 \uC751\uB2F5";
      break;
  }
  score = Math.max(0, Math.min(1, score));
  return { strategy, score, reason };
}
var MetaReasoner = class {
  constructor(strategies = [...ALL_STRATEGIES]) {
    this.strategies = strategies;
  }
  analyze(problem) {
    const scores = this.strategies.map((s) => scoreStrategy(problem, s));
    scores.sort((a, b) => b.score - a.score);
    const selected = scores[0].strategy;
    const rationale = `"${problem.slice(0, 50)}" \u2192 ${selected} \uC120\uD0DD (\uC810\uC218: ${scores[0].score.toFixed(2)}, \uC774\uC720: ${scores[0].reason})`;
    return { problem, selected, scores, rationale };
  }
  // 커스텀 전략 추가
  addStrategy(strategy) {
    if (!this.strategies.includes(strategy)) this.strategies.push(strategy);
  }
  getStrategies() {
    return [...this.strategies];
  }
};
var globalMetaReasoner = new MetaReasoner();

// src/experiments/belief.ts
var BeliefSystem = class {
  constructor() {
    this.beliefs = /* @__PURE__ */ new Map();
  }
  // 신념 설정
  set(claim, confidence) {
    const clamped = Math.max(0, Math.min(1, confidence));
    const existing = this.beliefs.get(claim);
    if (existing) {
      const delta = clamped - existing.confidence;
      existing.confidence = clamped;
      existing.history.push({ event: "set", delta, timestamp: Date.now() });
    } else {
      this.beliefs.set(claim, {
        claim,
        confidence: clamped,
        history: [{ event: "initialized", delta: 0, timestamp: Date.now() }],
        createdAt: Date.now()
      });
    }
  }
  // 신념 조회
  get(claim) {
    return this.beliefs.get(claim)?.confidence ?? null;
  }
  // 베이즈식 업데이트: 새 증거로 확신 조정
  // evidence > 0.5: 긍정 증거 (확신 증가), < 0.5: 부정 증거 (확신 감소)
  update(claim, evidenceStrength, eventName = "evidence") {
    const belief = this.beliefs.get(claim);
    if (!belief) return 0;
    const prior = belief.confidence;
    const likelihood = evidenceStrength > 0.5 ? evidenceStrength : 1 - evidenceStrength;
    const direction = evidenceStrength > 0.5 ? 1 : -1;
    const delta = direction * likelihood * (1 - Math.abs(prior - 0.5)) * 0.3;
    const posterior = Math.max(0.01, Math.min(0.99, prior + delta));
    belief.history.push({ event: eventName, delta: posterior - prior, timestamp: Date.now() });
    belief.confidence = posterior;
    return posterior;
  }
  // 부정 (반대로 업데이트)
  negate(claim) {
    return this.update(claim, 0.1, "negation");
  }
  // 모든 신념 목록
  list() {
    return [...this.beliefs.values()];
  }
  // 가장 확신이 높은 신념
  strongest() {
    const all = this.list();
    if (all.length === 0) return null;
    return all.reduce((best, b) => b.confidence > best.confidence ? b : best);
  }
  // 특정 임계값 이상 신념들
  certain(threshold = 0.8) {
    return this.list().filter((b) => b.confidence >= threshold);
  }
  // 신념 삭제
  forget(claim) {
    return this.beliefs.delete(claim);
  }
  // 크기
  size() {
    return this.beliefs.size;
  }
};
var globalBeliefs = new BeliefSystem();

// src/experiments/analogy.ts
function similarity(a, b) {
  const tokA = new Set(a.toLowerCase().split(/\s+/));
  const tokB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...tokA].filter((t) => tokB.has(t)).length;
  if (intersection === 0) return 0;
  return intersection / Math.sqrt(tokA.size * tokB.size);
}
var AnalogyStore = class {
  constructor() {
    this.patterns = [];
    this.counter = 0;
  }
  // 패턴 저장
  store(description, solution, tags = []) {
    const p = {
      id: `pattern-${++this.counter}`,
      description,
      solution,
      tags,
      useCount: 0
    };
    this.patterns.push(p);
    return p;
  }
  // 유사 패턴 찾기
  find(problem, topK = 3) {
    return this.patterns.map((p) => ({
      ...p,
      similarity: similarity(problem, p.description) + p.tags.filter((t) => problem.toLowerCase().includes(t)).length * 0.1
    })).filter((p) => (p.similarity ?? 0) > 0).sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)).slice(0, topK);
  }
  // 가장 유사한 패턴 1개
  best(problem) {
    const results = this.find(problem, 1);
    if (results.length === 0) return null;
    const found = this.patterns.find((p) => p.id === results[0].id);
    if (found) found.useCount++;
    return results[0];
  }
  // 태그로 검색
  byTag(tag) {
    return this.patterns.filter((p) => p.tags.includes(tag));
  }
  // 자주 쓰인 패턴
  popular(n = 3) {
    return [...this.patterns].sort((a, b) => b.useCount - a.useCount).slice(0, n);
  }
  size() {
    return this.patterns.length;
  }
  all() {
    return [...this.patterns];
  }
};
var globalAnalogy = new AnalogyStore();

// src/experiments/critique.ts
function severityWeight(s) {
  return { critical: 1, major: 0.7, minor: 0.3, suggestion: 0.1 }[s];
}
var CritiqueAgent = class {
  run(output, config) {
    const { finders, riskThreshold = 0.5 } = config;
    const points = finders.flatMap((f) => {
      try {
        return f(output);
      } catch {
        return [];
      }
    });
    const totalRisk = points.length === 0 ? 0 : points.reduce((s, p) => s + severityWeight(p.severity), 0) / (points.length * 1);
    const overallRisk = Math.min(1, totalRisk);
    const approved = overallRisk < riskThreshold && !points.some((p) => p.severity === "critical");
    const criticals = points.filter((p) => p.severity === "critical").length;
    const majors = points.filter((p) => p.severity === "major").length;
    const summary = points.length === 0 ? "\uBE44\uD310\uD560 \uC810 \uC5C6\uC74C \u2014 \uD1B5\uACFC" : `${points.length}\uAC1C \uBB38\uC81C \uBC1C\uACAC (critical: ${criticals}, major: ${majors}), \uC704\uD5D8\uB3C4: ${(overallRisk * 100).toFixed(0)}%`;
    return { output, points, overallRisk, approved, summary };
  }
};
var defaultFinders = [
  // 빈 출력
  (output) => {
    if (output === null || output === void 0 || output === "") {
      return [{ type: "missing", description: "\uCD9C\uB825\uC774 \uBE44\uC5B4\uC788\uC74C", severity: "critical" }];
    }
    return [];
  },
  // 너무 짧은 출력
  (output) => {
    if (typeof output === "string" && output.length > 0 && output.length < 5) {
      return [{ type: "weakness", description: "\uCD9C\uB825\uC774 \uB108\uBB34 \uC9E7\uC74C", severity: "minor", suggestion: "\uB354 \uAD6C\uCCB4\uC801\uC73C\uB85C \uC11C\uC220" }];
    }
    return [];
  },
  // 에러 객체
  (output) => {
    if (output instanceof Error || typeof output === "object" && output !== null && output?._tag === "Err") {
      return [{ type: "weakness", description: "\uC5D0\uB7EC \uAC12\uC774 \uCD9C\uB825\uB428", severity: "major" }];
    }
    return [];
  }
];
var globalCritique = new CritiqueAgent();

// src/experiments/compose-reason.ts
var ReasonComposer = class {
  compose(steps, input) {
    const startTime = Date.now();
    const context = { step: 0, history: [], store: /* @__PURE__ */ new Map() };
    let current = input;
    let success = true;
    for (const step of steps) {
      if (step.condition && !step.condition(current, context)) {
        context.history.push({
          name: `${step.name}(skipped)`,
          input: current,
          output: current,
          duration: 0
        });
        context.step++;
        continue;
      }
      const stepStart = Date.now();
      try {
        const output = step.fn(current, context);
        context.history.push({
          name: step.name,
          input: current,
          output,
          duration: Date.now() - stepStart
        });
        current = output;
      } catch (e) {
        if (step.onError) {
          const fallback = step.onError(e, current);
          context.history.push({
            name: `${step.name}(error\u2192fallback)`,
            input: current,
            output: fallback,
            duration: Date.now() - stepStart
          });
          current = fallback;
        } else {
          success = false;
          context.history.push({
            name: `${step.name}(failed)`,
            input: current,
            output: null,
            duration: Date.now() - stepStart
          });
          break;
        }
      }
      context.step++;
    }
    return {
      output: current,
      steps: context.step,
      history: context.history,
      success,
      duration: Date.now() - startTime
    };
  }
  // 단계 빌더 (체이닝)
  pipeline() {
    return new PipelineBuilder(this);
  }
};
var PipelineBuilder = class {
  constructor(composer) {
    this.steps = [];
    this.composer = composer;
  }
  step(name, fn, options = {}) {
    this.steps.push({ name, fn, ...options });
    return this;
  }
  run(input) {
    return this.composer.compose(this.steps, input);
  }
  stepCount() {
    return this.steps.length;
  }
};
var globalComposer = new ReasonComposer();

// src/hypothesis.ts
var HypothesisTester = class {
  test(config) {
    const {
      claim,
      test,
      evaluate,
      maxAttempts = 3,
      threshold = 0.7,
      conclude = (c) => c >= threshold ? "accepted" : c <= 1 - threshold ? "rejected" : "inconclusive"
    } = config;
    const evidence = [];
    let confidence = 0;
    let iterations = 0;
    for (let i = 0; i < maxAttempts; i++) {
      iterations++;
      const result = test(i);
      evidence.push(result);
      confidence = evaluate(evidence);
      if (confidence >= threshold || confidence <= 1 - threshold) break;
    }
    const verdict = conclude(confidence);
    const reasoning = `${iterations}\uD68C \uD14C\uC2A4\uD2B8, \uC2E0\uB8B0\uB3C4 ${(confidence * 100).toFixed(0)}% \u2192 ${verdict}`;
    return { claim, verdict, confidence, evidence, reasoning, iterations };
  }
  // 여러 가설 중 가장 신뢰도 높은 것 선택
  compete(hypotheses) {
    const results = hypotheses.map((h) => this.test(h));
    return results.reduce((best, curr) => curr.confidence > best.confidence ? curr : best);
  }
};
var globalTester = new HypothesisTester();

// src/experiments/cognitive.ts
var CognitiveArchitecture = class {
  constructor() {
    this.meta = new MetaReasoner();
    this.beliefs = new BeliefSystem();
    this.analogies = new AnalogyStore();
    this.hypothesis = new HypothesisTester();
    this.critique = new CritiqueAgent();
    this.composer = new ReasonComposer();
    this.debater = new Debater();
    this.checkpoints = new CheckpointManager();
  }
  // 문제 → 전략 선택 → 실행 → 비판 → 결과
  solve(problem, solver) {
    const meta = this.meta.analyze(problem);
    const strategy = meta.selected;
    this.checkpoints.save("pre-solve", { problem, strategy });
    const analogyResult = this.analogies.best(problem);
    const output = solver(strategy, problem);
    const critiqueResult = this.critique.run(output, { finders: defaultFinders });
    this.beliefs.set(`solved:${problem.slice(0, 20)}`, critiqueResult.approved ? 0.8 : 0.4);
    const state = {
      problem,
      strategy,
      beliefs: /* @__PURE__ */ new Map([[`solved`, critiqueResult.approved ? 0.8 : 0.4]]),
      analogies: analogyResult ? [analogyResult.description] : [],
      output,
      critique: { approved: critiqueResult.approved, risk: critiqueResult.overallRisk },
      iterations: 1
    };
    return { strategy, output, approved: critiqueResult.approved, risk: critiqueResult.overallRisk, state };
  }
  // 간단한 통계
  stats() {
    return {
      beliefs: this.beliefs.size(),
      analogies: this.analogies.size(),
      checkpoints: this.checkpoints.list().length
    };
  }
};
var globalCognition = new CognitiveArchitecture();

// src/experiments/consensus.ts
var ConsensusEngine = class {
  // 다수결 (가장 많이 나온 답)
  majority(votes) {
    if (!votes || votes.length === 0) {
      throw new Error("votes\uAC00 \uBE44\uC5B4\uC788\uC74C");
    }
    const counts = /* @__PURE__ */ new Map();
    for (const v of votes) {
      const key = JSON.stringify(v.answer);
      const existing = counts.get(key) ?? { answer: v.answer, count: 0, totalConf: 0 };
      existing.count++;
      existing.totalConf += v.confidence;
      counts.set(key, existing);
    }
    const sorted = [...counts.values()].sort((a, b) => b.count - a.count);
    const winner = sorted[0];
    const agreement = winner.count / votes.length;
    const winnerKey = JSON.stringify(winner.answer);
    return {
      answer: winner.answer,
      strategy: "majority",
      agreement,
      votes,
      dissent: votes.filter((v) => JSON.stringify(v.answer) !== winnerKey)
    };
  }
  // 가중 평균 (숫자형 답에 적합)
  weighted(votes) {
    if (!votes || votes.length === 0) {
      throw new Error("votes\uAC00 \uBE44\uC5B4\uC788\uC74C");
    }
    const totalWeight = votes.reduce((s, v) => s + v.confidence, 0);
    const answer = votes.reduce((s, v) => s + v.answer * v.confidence, 0) / totalWeight;
    const vals = votes.map((v) => v.answer);
    const range = Math.max(...vals) - Math.min(...vals);
    const variance = votes.reduce((s, v) => s + Math.abs(v.answer - answer) * v.confidence, 0) / totalWeight;
    const agreement = Math.max(0, 1 - variance / (range + 1));
    return { answer, strategy: "weighted", agreement, votes, dissent: [] };
  }
  // 임계값 (confidence 평균이 threshold 이상인 답)
  threshold(votes, threshold = 0.7) {
    if (!votes || votes.length === 0) return null;
    const groups = /* @__PURE__ */ new Map();
    for (const v of votes) {
      const key = JSON.stringify(v.answer);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(v);
    }
    for (const [key, group] of groups) {
      const avgConf = group.reduce((s, v) => s + v.confidence, 0) / group.length;
      if (avgConf >= threshold) {
        return {
          answer: group[0].answer,
          strategy: "threshold",
          agreement: avgConf,
          votes,
          dissent: votes.filter((v) => JSON.stringify(v.answer) !== key)
        };
      }
    }
    return null;
  }
  // 만장일치
  unanimous(votes) {
    if (!votes || votes.length === 0) return null;
    const first = JSON.stringify(votes[0].answer);
    if (votes.every((v) => JSON.stringify(v.answer) === first)) {
      return {
        answer: votes[0].answer,
        strategy: "unanimous",
        agreement: 1,
        votes,
        dissent: []
      };
    }
    return null;
  }
  // agreement 계산 (majority 기준)
  agreement(votes) {
    if (!votes || votes.length === 0) return 0;
    const result = this.majority(votes);
    return result.agreement;
  }
};
var globalConsensus = new ConsensusEngine();

// src/experiments/delegate.ts
var DelegationManager = class {
  constructor() {
    this.agents = /* @__PURE__ */ new Map();
  }
  register(agent) {
    this.agents.set(agent.id, agent);
  }
  // 능력 기반 에이전트 찾기
  findCapable(capability) {
    return [...this.agents.values()].filter((a) => a.capabilities.includes(capability));
  }
  // 단일 태스크 위임
  delegate(task) {
    const candidates = task.requiredCapability ? this.findCapable(task.requiredCapability) : [...this.agents.values()];
    if (candidates.length === 0) {
      return { taskId: task.id, agentId: "none", output: null, success: false, duration: 0 };
    }
    const agent = candidates[0];
    const start = Date.now();
    try {
      const output = agent.execute(task);
      return { taskId: task.id, agentId: agent.id, output, success: true, duration: Date.now() - start };
    } catch (e) {
      return { taskId: task.id, agentId: agent.id, output: null, success: false, duration: Date.now() - start };
    }
  }
  // 여러 태스크 병렬 위임
  delegateAll(tasks) {
    const start = Date.now();
    const results = tasks.map((t) => this.delegate(t));
    return {
      results,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      totalDuration: Date.now() - start
    };
  }
  list() {
    return [...this.agents.keys()];
  }
  size() {
    return this.agents.size;
  }
};
var globalDelegation = new DelegationManager();

// src/experiments/negotiate.ts
var Negotiator = class {
  negotiate(positions, maxRounds = 5) {
    const rounds = [];
    let currentOffers = {};
    positions.forEach((p) => {
      currentOffers[p.agentId] = p.offer;
    });
    for (let r = 1; r <= maxRounds; r++) {
      const values = Object.values(currentOffers);
      const gap = Math.max(...values) - Math.min(...values);
      rounds.push({ round: r, offers: { ...currentOffers }, gap });
      const avgOffer = values.reduce((s, v) => s + v, 0) / values.length;
      const allAccept = positions.every((p) => avgOffer >= p.minAccept && avgOffer <= p.maxOffer);
      if (allAccept || gap < 0.01) {
        return { agreed: true, value: avgOffer, rounds, breakdown: `${r}\uB77C\uC6B4\uB4DC\uC5D0 \uD569\uC758 (\uAC12: ${avgOffer.toFixed(3)})` };
      }
      positions.forEach((p) => {
        const current = currentOffers[p.agentId];
        const delta = (avgOffer - current) * p.flexibility * 0.5;
        currentOffers[p.agentId] = Math.max(p.minAccept, Math.min(p.maxOffer, current + delta));
      });
    }
    return { agreed: false, rounds, breakdown: `${maxRounds}\uB77C\uC6B4\uB4DC \uD6C4 \uD611\uC0C1 \uACB0\uB82C` };
  }
};
var globalNegotiator = new Negotiator();

// src/experiments/vote.ts
var VotingSystem = class {
  // 단순 다수결 (가장 많은 1순위 표)
  plurality(ballots, candidates) {
    const tally = {};
    candidates.forEach((c) => tally[c] = 0);
    ballots.forEach((b) => {
      if (b.choices[0]) tally[b.choices[0]] = (tally[b.choices[0]] ?? 0) + 1;
    });
    const sorted = [...candidates].sort((a, b) => tally[b] - tally[a]);
    return {
      winner: sorted[0],
      method: "plurality",
      tally,
      totalVoters: ballots.length,
      margin: tally[sorted[0]] - (tally[sorted[1]] ?? 0)
    };
  }
  // 승인 투표 (가장 많이 승인된 것)
  approval(ballots, candidates) {
    const tally = {};
    candidates.forEach((c) => tally[c] = 0);
    ballots.forEach((b) => b.choices.forEach((c) => {
      if (tally.hasOwnProperty(c)) tally[c] = (tally[c] ?? 0) + 1;
    }));
    const sorted = [...candidates].sort((a, b) => tally[b] - tally[a]);
    return {
      winner: sorted[0],
      method: "approval",
      tally,
      totalVoters: ballots.length,
      margin: tally[sorted[0]] - (tally[sorted[1]] ?? 0)
    };
  }
  // 순위 투표 (IRV: 과반 없으면 최저 탈락 반복)
  ranked(ballots, candidates) {
    let remaining = [...candidates];
    let workingBallots = ballots.map((b) => ({ ...b, choices: [...b.choices] }));
    while (remaining.length > 1) {
      const tally = {};
      remaining.forEach((c) => tally[c] = 0);
      workingBallots.forEach((b) => {
        const top = b.choices.find((c) => remaining.includes(c));
        if (top) tally[top] = (tally[top] ?? 0) + 1;
      });
      const total = Object.values(tally).reduce((a, b) => a + b, 0);
      const sorted = [...remaining].sort((a, b) => tally[b] - tally[a]);
      if (tally[sorted[0]] > total / 2) {
        const finalTally2 = {};
        candidates.forEach((c) => finalTally2[c] = 0);
        remaining.forEach((c) => finalTally2[c] = tally[c]);
        return {
          winner: sorted[0],
          method: "ranked",
          tally: finalTally2,
          totalVoters: ballots.length,
          margin: tally[sorted[0]] - (tally[sorted[1]] ?? 0)
        };
      }
      remaining = remaining.filter((c) => c !== sorted[sorted.length - 1]);
    }
    const finalTally = {};
    candidates.forEach((c) => finalTally[c] = 0);
    if (remaining[0]) finalTally[remaining[0]] = ballots.length;
    return {
      winner: remaining[0] ?? candidates[0],
      method: "ranked",
      tally: finalTally,
      totalVoters: ballots.length,
      margin: 0
    };
  }
  // 점수 투표
  score(ballots, candidates) {
    const tally = {};
    candidates.forEach((c) => tally[c] = 0);
    ballots.forEach((b) => {
      if (b.scores) candidates.forEach((c) => {
        tally[c] += b.scores[c] ?? 0;
      });
    });
    const sorted = [...candidates].sort((a, b) => tally[b] - tally[a]);
    return {
      winner: sorted[0],
      method: "score",
      tally,
      totalVoters: ballots.length,
      margin: tally[sorted[0]] - (tally[sorted[1]] ?? 0)
    };
  }
  // tally만 반환 (vote-tally 내장함수용)
  tally(ballots, candidates) {
    const tally = {};
    candidates.forEach((c) => tally[c] = 0);
    ballots.forEach((b) => {
      if (b.choices[0]) tally[b.choices[0]] = (tally[b.choices[0]] ?? 0) + 1;
    });
    return tally;
  }
};
var globalVoting = new VotingSystem();

// src/experiments/swarm.ts
var Swarm = class {
  optimize(config) {
    const {
      objective,
      particles: n = 10,
      iterations: maxIter = 50,
      bounds = [0, 1],
      tolerance = 1e-3
    } = config;
    const [min, max] = bounds;
    const range = max - min;
    const ps = Array.from({ length: n }, (_, i) => {
      const pos = min + Math.random() * range;
      const score = objective(pos);
      return {
        id: `p${i}`,
        position: pos,
        velocity: (Math.random() - 0.5) * range * 0.1,
        bestPosition: pos,
        bestScore: score
      };
    });
    let globalBest = ps.reduce((b, p) => p.bestScore > b.bestScore ? p : b);
    let prevBestScore = -Infinity;
    let iter = 0;
    let converged = false;
    for (iter = 0; iter < maxIter; iter++) {
      for (const p of ps) {
        const w = 0.7, c1 = 1.5, c2 = 1.5;
        p.velocity = w * p.velocity + c1 * Math.random() * (p.bestPosition - p.position) + c2 * Math.random() * (globalBest.bestPosition - p.position);
        p.position = Math.max(min, Math.min(max, p.position + p.velocity));
        const score = objective(p.position);
        if (score > p.bestScore) {
          p.bestScore = score;
          p.bestPosition = p.position;
        }
        if (score > globalBest.bestScore) globalBest = p;
      }
      if (Math.abs(globalBest.bestScore - prevBestScore) < tolerance) {
        converged = true;
        break;
      }
      prevBestScore = globalBest.bestScore;
    }
    return {
      bestPosition: globalBest.bestPosition,
      bestScore: globalBest.bestScore,
      iterations: iter + 1,
      particles: ps,
      converged
    };
  }
};
var globalSwarm = new Swarm();

// src/experiments/peer-review.ts
var PeerReviewSystem = class {
  constructor() {
    this.reviewers = /* @__PURE__ */ new Map();
  }
  addReviewer(reviewer) {
    this.reviewers.set(reviewer.id, reviewer);
  }
  review(targetId, output, reviewerIds, approvalThreshold = 0.7) {
    const selected = reviewerIds ? reviewerIds.map((id) => this.reviewers.get(id)).filter(Boolean) : [...this.reviewers.values()];
    const comments = selected.map((r) => r.review(output));
    const averageScore = comments.length > 0 ? comments.reduce((s, c) => s + c.score, 0) / comments.length : 0;
    const approved = averageScore >= approvalThreshold;
    const issues = comments.filter((c) => c.score < approvalThreshold);
    const summary = approved ? `\uC2B9\uC778 (\uD3C9\uADE0 \uC810\uC218: ${averageScore.toFixed(2)})` : `\uBC18\uB824 \u2014 ${issues.length}\uAC1C \uBB38\uC81C: ${issues.map((c) => c.aspect).join(", ")}`;
    return { targetId, output, comments, averageScore, approved, summary };
  }
  list() {
    return [...this.reviewers.keys()];
  }
  size() {
    return this.reviewers.size;
  }
};
var globalPeerReview = new PeerReviewSystem();

// src/experiments/compete.ts
var Competition = class {
  constructor() {
    this.competitors = /* @__PURE__ */ new Map();
  }
  register(competitor) {
    this.competitors.set(competitor.id, competitor);
  }
  run(problem, evaluate) {
    const results = [];
    for (const competitor of this.competitors.values()) {
      try {
        const output = competitor.solve(problem);
        results.push({ agentId: competitor.id, output, score: evaluate(output) });
      } catch {
        results.push({ agentId: competitor.id, output: null, score: -Infinity });
      }
    }
    results.sort((a, b) => b.score - a.score);
    const ranked = results.map((r, i) => ({ ...r, rank: i + 1 }));
    const margin = ranked.length >= 2 ? ranked[0].score - ranked[1].score : ranked[0]?.score ?? 0;
    return { winner: ranked[0], allResults: ranked, margin };
  }
  // 토너먼트: 1:1 매치로 최종 우승자 (단순화: 전체 점수 기반)
  tournament(problem, evaluate) {
    return this.run(problem, evaluate);
  }
  list() {
    return [...this.competitors.keys()];
  }
  size() {
    return this.competitors.size;
  }
};
var globalCompetition = new Competition();

// src/experiments/chain-agents.ts
var AgentChain = class _AgentChain {
  constructor() {
    this.agents = [];
  }
  add(agent) {
    this.agents.push(agent);
    return this;
  }
  run(initialInput) {
    const links = [];
    let current = initialInput;
    let success = true;
    for (const agent of this.agents) {
      const start = Date.now();
      try {
        const output = agent.transform(current);
        const valid = agent.validate ? agent.validate(output) : true;
        links.push({
          agentId: agent.id,
          input: current,
          output,
          duration: Date.now() - start,
          skipped: !valid
        });
        if (valid) current = output;
      } catch {
        links.push({
          agentId: agent.id,
          input: current,
          output: null,
          duration: Date.now() - start,
          skipped: true
        });
        success = false;
        break;
      }
    }
    return {
      finalOutput: current,
      links,
      success,
      stepsCompleted: links.filter((l) => !l.skipped).length
    };
  }
  // 팩토리: 배열로 빠르게 체인 생성
  static from(agents) {
    const chain = new _AgentChain();
    agents.forEach((a) => chain.add(a));
    return chain;
  }
  length() {
    return this.agents.length;
  }
};
var globalChain = new AgentChain();

// src/experiments/orchestrate.ts
var Orchestrator = class {
  constructor() {
    this.agents = /* @__PURE__ */ new Map();
  }
  /** 에이전트 등록 */
  register(agent) {
    this.agents.set(agent.id, agent);
  }
  /** 등록된 에이전트 ID 목록 */
  list() {
    return [...this.agents.keys()];
  }
  /**
   * 위상 정렬 — 의존성이 먼저 오도록 실행 순서 결정
   * 순환 의존성: visited Set으로 재방문 방지 (사이클 무시, 첫 방문 경로만 사용)
   */
  topSort(tasks) {
    const order = [];
    const visited = /* @__PURE__ */ new Set();
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      const task = taskMap.get(id);
      if (task?.dependsOn) {
        for (const dep of task.dependsOn) {
          visit(dep);
        }
      }
      order.push(id);
    };
    for (const t of tasks) {
      visit(t.id);
    }
    return order;
  }
  /**
   * 태스크 목록 실행 — 위상 정렬 후 순서대로 실행
   * 선행 태스크의 output을 다음 태스크 input의 deps 필드에 주입
   */
  run(tasks) {
    const start = Date.now();
    const outputs = {};
    const order = this.topSort(tasks);
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    if (tasks.length === 0) {
      return { outputs, order: [], duration: Date.now() - start, success: true };
    }
    try {
      for (const id of order) {
        const task = taskMap.get(id);
        if (!task) continue;
        const agent = this.agents.get(id) ?? this.agents.values().next().value;
        if (!agent) continue;
        const depOutputs = (task.dependsOn ?? []).map((d) => outputs[d]);
        const input = depOutputs.length > 0 ? { ...task.input, deps: depOutputs } : task.input;
        outputs[id] = agent.run(input);
      }
      return { outputs, order, duration: Date.now() - start, success: true };
    } catch (e) {
      return { outputs, order, duration: Date.now() - start, success: false };
    }
  }
  /** 실행 순서만 반환 (dry run) */
  getOrder(tasks) {
    return this.topSort(tasks);
  }
};
var globalOrchestrator = new Orchestrator();

// src/experiments/multi-agent-hub.ts
var MultiAgentHub = class {
  constructor() {
    this.consensus = new ConsensusEngine();
    this.delegation = new DelegationManager();
    this.voting = new VotingSystem();
    this.negotiator = new Negotiator();
    this.swarm = new Swarm();
    this.orchestrator = new Orchestrator();
    this.peerReview = new PeerReviewSystem();
    this.chain = new AgentChain();
    this.competition = new Competition();
  }
  /**
   * taskType에 따라 적절한 협업 시스템으로 라우팅
   * problem: 문제 데이터, agents: 에이전트 목록(선택적)
   */
  route(taskType, problem, agents = []) {
    const timestamp = Date.now();
    switch (taskType) {
      case "consensus": {
        const votes = Array.isArray(agents) ? agents.map((a, i) => ({
          agentId: a.id ?? `agent-${i}`,
          answer: typeof a.solve === "function" ? a.solve(problem) : a.answer ?? problem,
          confidence: a.confidence ?? 0.8
        })) : [{ agentId: "default", answer: problem, confidence: 1 }];
        const result = this.consensus.majority(votes.length > 0 ? votes : [{ agentId: "solo", answer: problem, confidence: 1 }]);
        return { taskType, result: result.answer, system: "ConsensusEngine", timestamp };
      }
      case "delegate": {
        if (agents.length === 0) {
          return { taskType, result: problem, system: "DelegationManager", timestamp };
        }
        const dm = new DelegationManager();
        agents.forEach((a) => {
          if (a.id && a.execute) dm.register(a);
          else dm.register({
            id: a.id ?? "default",
            capabilities: a.capabilities ?? ["general"],
            execute: typeof a.solve === "function" ? a.solve : () => problem
          });
        });
        const task = typeof problem === "object" && problem.id ? problem : { id: "task-0", description: String(problem), input: problem };
        const result = dm.delegate(task);
        return { taskType, result: result.output, system: "DelegationManager", timestamp };
      }
      case "vote": {
        if (!Array.isArray(problem?.ballots) || !Array.isArray(problem?.candidates)) {
          return { taskType, result: problem, system: "VotingSystem", timestamp };
        }
        const voteResult = this.voting.plurality(problem.ballots, problem.candidates);
        return { taskType, result: voteResult.winner, system: "VotingSystem", timestamp };
      }
      case "negotiate": {
        if (!Array.isArray(problem)) {
          return { taskType, result: null, system: "Negotiator", timestamp };
        }
        const result = this.negotiator.negotiate(problem);
        return { taskType, result: result.agreed ? result.value : null, system: "Negotiator", timestamp };
      }
      case "swarm": {
        const objective = typeof problem === "function" ? problem : (x) => -Math.abs(x - (problem ?? 0));
        const result = this.swarm.optimize({ objective });
        return { taskType, result: result.bestPosition, system: "Swarm", timestamp };
      }
      case "orchestrate": {
        const orch = new Orchestrator();
        agents.forEach((a) => {
          if (a.id && a.run) orch.register(a);
          else if (a.id) orch.register({ id: a.id, run: typeof a.solve === "function" ? a.solve : (x) => x });
        });
        const tasks = Array.isArray(problem) ? problem : [{ id: "task", input: problem }];
        const result = orch.run(tasks);
        return { taskType, result: result.outputs, system: "Orchestrator", timestamp };
      }
      case "peer-review": {
        const prs = new PeerReviewSystem();
        agents.forEach((a, i) => {
          prs.addReviewer({
            id: a.id ?? `reviewer-${i}`,
            review: (output) => ({
              reviewerId: a.id ?? `reviewer-${i}`,
              aspect: "quality",
              score: typeof a.score === "function" ? a.score(output) : a.score ?? 0.8,
              comment: a.comment ?? "OK"
            })
          });
        });
        if (prs.size() === 0) {
          prs.addReviewer({
            id: "default-reviewer",
            review: (_output) => ({ reviewerId: "default-reviewer", aspect: "quality", score: 0.8, comment: "OK" })
          });
        }
        const result = prs.review("target", problem);
        return { taskType, result: result.approved, system: "PeerReviewSystem", timestamp };
      }
      case "chain": {
        const ch = new AgentChain();
        agents.forEach((a, i) => {
          ch.add({
            id: a.id ?? `chain-${i}`,
            transform: typeof a.transform === "function" ? a.transform : typeof a.process === "function" ? a.process : typeof a.solve === "function" ? a.solve : (x) => x
          });
        });
        if (ch.length() === 0) {
          return { taskType, result: problem, system: "AgentChain", timestamp };
        }
        const result = ch.run(problem);
        return { taskType, result: result.finalOutput, system: "AgentChain", timestamp };
      }
      case "compete": {
        if (agents.length === 0) {
          return { taskType, result: problem, system: "Competition", timestamp };
        }
        const comp = new Competition();
        agents.forEach((a, i) => {
          comp.register({
            id: a.id ?? `competitor-${i}`,
            solve: typeof a.solve === "function" ? a.solve : () => problem
          });
        });
        const evaluate = typeof problem?.evaluate === "function" ? problem.evaluate : (x) => typeof x === "number" ? x : 1;
        const prob = problem?.task ?? problem;
        const result = comp.run(prob, evaluate);
        return { taskType, result: result.winner.output, system: "Competition", timestamp };
      }
      default:
        return { taskType, result: problem, system: "passthrough", timestamp };
    }
  }
  /** 허브 통계 */
  stats() {
    return {
      systems: 9,
      ready: 9,
      phases: 9,
      // Phase 121~129
      tier: 8
    };
  }
  /** 사용 가능한 시스템 목록 */
  systems() {
    return [
      "ConsensusEngine",
      // Phase 121
      "DelegationManager",
      // Phase 122
      "VotingSystem",
      // Phase 123
      "Negotiator",
      // Phase 124
      "Swarm",
      // Phase 125
      "Orchestrator",
      // Phase 126
      "PeerReviewSystem",
      // Phase 127
      "AgentChain",
      // Phase 128
      "Competition"
      // Phase 129
    ];
  }
  /** 태스크 타입 목록 */
  taskTypes() {
    return ["consensus", "delegate", "vote", "negotiate", "swarm", "orchestrate", "peer-review", "chain", "compete"];
  }
};
var globalHub = new MultiAgentHub();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentChain,
  defaultFinders,
  globalAnalogy,
  globalBeliefs,
  globalCheckpoint,
  globalCognition,
  globalCompetition,
  globalComposer,
  globalConsensus,
  globalCritique,
  globalDebater,
  globalDelegation,
  globalHub,
  globalMetaReasoner,
  globalNegotiator,
  globalOrchestrator,
  globalPeerReview,
  globalSwarm,
  globalVoting,
  severityWeight
});
