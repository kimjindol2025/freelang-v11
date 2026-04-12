// FreeLang v9 AI Standard Library — Phase 100
// Integrates: maybe-type, cot, tot, reflect, context-window, result-type, error-system, tool-registry, agent, self-improve

import { Maybe, None, Uncertain, maybe, none, confident, mostLikely } from './maybe-type';
import { ChainOfThought, ThoughtStep, CoTResult } from './cot';
import { TreeOfThought, ThoughtBranch, ToTResult } from './tot';
import { Reflector, ReflectionCriteria, ReflectionResult, CRITERIA } from './reflect';
import { ContextManager, ContextEntry, ContextStrategy } from './context-window';
import { ok, err, isOk, isErr, unwrapOr, Result, Ok, Err, ErrorCategory } from './result-type';
import { AIErrorSystem, RecoveryStrategy } from './error-system';
import { ToolRegistry, ToolDefinition, ToolResult } from './tool-registry';
import { FLAgent, AgentOptions, AgentState, AgentAction } from './agent';
import { SelfImprover, SelfImproveConfig, SelfImproveState } from './self-improve';

// ── MaybeValue 타입 별칭 (외부 노출용) ────────────────────────────────────
export type MaybeValue<T> = Maybe<T> | None;

// ── defaultCriteria: CRITERIA 기반 기본 반영 기준 ─────────────────────────
export const defaultCriteria: ReflectionCriteria[] = Object.values(CRITERIA);

// ── AISession ─────────────────────────────────────────────────────────────
// AI 추론 세션: 하나의 세션에서 COT/TOT/REFLECT/CONTEXT를 함께 관리
export class AISession {
  public cot: ChainOfThought;
  public tot: TreeOfThought;
  public reflector: Reflector;
  public context: ContextManager;
  public tools: ToolRegistry;
  private results: Map<string, any> = new Map();

  constructor(options: {
    maxTokens?: number;
    goal?: string;
  } = {}) {
    this.cot = new ChainOfThought();
    this.tot = new TreeOfThought();
    this.reflector = new Reflector();
    // defaultCriteria 추가
    defaultCriteria.forEach(c => this.reflector.addCriteria(c));
    this.context = new ContextManager(options.maxTokens ?? 4096, 'sliding');
    this.tools = new ToolRegistry();
  }

  // 결과 저장/조회
  store(key: string, value: any): void { this.results.set(key, value); }
  recall(key: string): any { return this.results.get(key); }

  // 세션 요약 마크다운
  summary(): string {
    const stats = this.context.stats();
    return [
      '# AI Session Summary',
      '',
      this.cot.toMarkdown(),
      '',
      `**Context stats**: ${JSON.stringify(stats)}`,
      '',
      `**Stored results**: ${[...this.results.keys()].join(', ') || '(없음)'}`,
    ].join('\n');
  }
}

// ── AIWorkflow ────────────────────────────────────────────────────────────
// AI 워크플로우 빌더 (체이닝 API)
export class AIWorkflow {
  private steps: Array<() => any> = [];
  private results: any[] = [];

  step(fn: () => any): AIWorkflow {
    this.steps.push(fn);
    return this;
  }

  async run(): Promise<any[]> {
    this.results = [];
    for (const step of this.steps) {
      const result = await Promise.resolve(step());
      this.results.push(result);
    }
    return this.results;
  }

  last(): any { return this.results[this.results.length - 1]; }
}

// ── 빠른 유틸리티 함수들 ──────────────────────────────────────────────────

export function quickReason(goal: string, steps: string[]): string {
  const cot = new ChainOfThought();
  steps.forEach((s, i) => cot.step(`Step ${i + 1}`, () => s));
  return cot.toMarkdown();
}

export function quickReflect(
  output: any,
  threshold = 0.7
): { passed: boolean; score: number; feedback: string[] } {
  const reflector = new Reflector();
  defaultCriteria.forEach(c => reflector.addCriteria(c));
  const result = reflector.reflect(output, threshold);
  return {
    passed: result.passed,
    score: result.totalScore,
    feedback: result.feedback,
  };
}

export function quickMaybe<T>(value: T, confidence: number): MaybeValue<T> {
  return maybe(confidence, value);
}

// ── AIStdLib — FL 내장 함수로 노출할 API ──────────────────────────────────
export const AIStdLib = {
  // 세션
  session: (opts?: { maxTokens?: number; goal?: string }) => new AISession(opts),
  workflow: () => new AIWorkflow(),

  // 개별 AI 블록
  cot: (_goal?: string) => new ChainOfThought(),
  tot: (_goal?: string) => new TreeOfThought(),
  reflect: () => {
    const r = new Reflector();
    defaultCriteria.forEach(c => r.addCriteria(c));
    return r;
  },
  context: (maxTokens: number) => new ContextManager(maxTokens, 'sliding'),
  tools: () => new ToolRegistry(),
  agent: (goal: string, maxSteps: number) => new FLAgent({ goal, maxSteps }),
  improve: <T>(config: SelfImproveConfig<T>) => new SelfImprover<T>(config),

  // Result 타입
  ok,
  err,
  isOk,
  isErr,
  unwrapOr,

  // Maybe 타입
  maybe,
  none,
  confident,
  mostLikely,

  // 에러 처리
  errorSystem: () => new AIErrorSystem(),

  // 빠른 유틸
  quickReason,
  quickReflect,
  quickMaybe,
};

export default AIStdLib;

// 타입 재수출
export type {
  Maybe,
  None,
  Uncertain,
  ThoughtStep,
  CoTResult,
  ThoughtBranch,
  ToTResult,
  ReflectionCriteria,
  ReflectionResult,
  ContextEntry,
  ContextStrategy,
  Result,
  Ok,
  Err,
  ErrorCategory,
  RecoveryStrategy,
  ToolDefinition,
  ToolResult,
  AgentOptions,
  AgentState,
  AgentAction,
  SelfImproveConfig,
  SelfImproveState,
};
