// SelfImprove: AI 자기 수정 시스템
// [SELF-IMPROVE :target $code :evaluate fn :improve fn :iterations 3 :stop-when fn]

export interface SelfImproveState<T> {
  iteration: number;
  current: T;
  score: number;
  history: Array<{ iteration: number; value: T; score: number; improvement: string }>;
  done: boolean;
  reason: string;
}

export interface SelfImproveConfig<T> {
  target: T;                           // 개선 대상 (코드, 텍스트, 계획 등)
  evaluate: (v: T) => number;          // 평가 함수 (0.0~1.0)
  improve: (v: T, score: number, history: SelfImproveState<T>['history']) => { value: T; improvement: string }; // 개선 함수
  maxIterations?: number;              // 최대 반복 (default: 5)
  stopWhen?: (score: number, iteration: number) => boolean; // 조기 종료 조건
  minImprovement?: number;             // 최소 개선량 (없으면 중단)
}

export class SelfImprover<T> {
  private state: SelfImproveState<T>;
  private config: SelfImproveConfig<T>;

  constructor(config: SelfImproveConfig<T>) {
    this.config = { maxIterations: 5, minImprovement: 0.01, ...config };
    const initialScore = config.evaluate(config.target);
    this.state = {
      iteration: 0,
      current: config.target,
      score: initialScore,
      history: [{ iteration: 0, value: config.target, score: initialScore, improvement: 'initial' }],
      done: false,
      reason: 'not started'
    };
  }

  step(): SelfImproveState<T> {
    if (this.state.done) return this.state;

    this.state.iteration++;
    const { value: newValue, improvement } = this.config.improve(
      this.state.current, this.state.score, this.state.history
    );
    const newScore = this.config.evaluate(newValue);
    const delta = newScore - this.state.score;

    this.state.history.push({
      iteration: this.state.iteration,
      value: newValue,
      score: newScore,
      improvement
    });

    // 점수가 올랐으면 채택
    if (newScore >= this.state.score) {
      this.state.current = newValue;
      this.state.score = newScore;
    }

    // 종료 조건 체크
    if (this.config.stopWhen?.(this.state.score, this.state.iteration)) {
      this.state.done = true;
      this.state.reason = 'stop-when condition met';
    } else if (this.state.iteration >= (this.config.maxIterations ?? 5)) {
      this.state.done = true;
      this.state.reason = 'max iterations reached';
    } else {
      const minImp = this.config.minImprovement ?? 0.01;
      // delta가 minImprovement 미만이면 종료
      // minImprovement=0: delta < 0은 하락(채택 안됨, 이미 위에서 처리), delta === 0이면 종료
      // 즉 delta >= 0이고 minImp보다 엄격히 작으면 종료
      // 단, minImp=0이면 delta >= 0 && delta === 0이면 종료 → delta >= 0 && delta <= 0
      if (minImp === 0 ? delta <= 0 : (delta >= 0 && delta < minImp)) {
        this.state.done = true;
        this.state.reason = 'improvement below threshold';
      }
    }

    return this.state;
  }

  run(): SelfImproveState<T> {
    while (!this.state.done) {
      this.step();
    }
    return this.state;
  }

  getState(): SelfImproveState<T> { return this.state; }

  toMarkdown(): string {
    const lines = [`## SELF-IMPROVE (${this.state.reason})`, ''];
    this.state.history.forEach(h => {
      lines.push(`### Iteration ${h.iteration} (score=${h.score.toFixed(3)})`);
      lines.push(`- improvement: ${h.improvement}`);
    });
    lines.push('', `**Final score**: ${this.state.score.toFixed(3)}`);
    return lines.join('\n');
  }
}

// FL 내장 함수로 등록할 헬퍼
export function createSelfImprover<T>(config: SelfImproveConfig<T>): SelfImprover<T> {
  return new SelfImprover(config);
}
