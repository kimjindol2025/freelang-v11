// FreeLang v9 Compose-Reason — 추론 블록 조합기
// Phase 119: (compose-reason steps input) → 최종 결과
// COT, TOT, REFLECT, HYPOTHESIS 등 개별 추론 블록들을 파이프라인처럼 조합 실행

export type ReasonStep = {
  name: string;
  fn: (input: any, context: ReasonContext) => any;
  condition?: (input: any, context: ReasonContext) => boolean;  // 실행 조건
  onError?: (e: Error, input: any) => any;  // 에러 시 대체값
};

export interface ReasonContext {
  step: number;
  history: Array<{ name: string; input: any; output: any; duration: number }>;
  store: Map<string, any>;  // 단계 간 공유 저장소
}

export interface ComposeResult {
  output: any;
  steps: number;
  history: ReasonContext['history'];
  success: boolean;
  duration: number;
}

export class ReasonComposer {
  compose(steps: ReasonStep[], input: any): ComposeResult {
    const startTime = Date.now();
    const context: ReasonContext = { step: 0, history: [], store: new Map() };
    let current = input;
    let success = true;

    for (const step of steps) {
      // 조건 체크
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
          const fallback = step.onError(e as Error, current);
          context.history.push({
            name: `${step.name}(error→fallback)`,
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
  pipeline(): PipelineBuilder { return new PipelineBuilder(this); }
}

export class PipelineBuilder {
  private steps: ReasonStep[] = [];
  private composer: ReasonComposer;

  constructor(composer: ReasonComposer) { this.composer = composer; }

  step(
    name: string,
    fn: ReasonStep['fn'],
    options: {
      condition?: ReasonStep['condition'];
      onError?: ReasonStep['onError'];
    } = {}
  ): PipelineBuilder {
    this.steps.push({ name, fn, ...options });
    return this;
  }

  run(input: any): ComposeResult {
    return this.composer.compose(this.steps, input);
  }

  stepCount(): number { return this.steps.length; }
}

export const globalComposer = new ReasonComposer();
