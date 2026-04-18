// cot.ts — FreeLang v9 Phase 92: Chain-of-Thought 런타임
// AI 단계별 추론을 언어의 기본 블록으로 구현

export interface ThoughtStep {
  id: string;
  thought: string;        // 이 단계에서 한 생각
  result: any;            // 이 단계의 결과값
  confidence?: number;    // 이 단계의 확신도 (0.0~1.0)
  durationMs?: number;    // 실행 시간 (ms)
}

export interface CoTResult {
  steps: ThoughtStep[];
  conclusion: any;        // 최종 결론
  totalSteps: number;
  confidence?: number;    // 전체 평균 확신도
}

/**
 * ChainOfThought — AI 단계별 추론 런타임
 *
 * 사용 예:
 *   const cot = new ChainOfThought();
 *   cot.step("숫자 더하기", () => 2 + 3);
 *   cot.step("결과 두 배", () => 10);
 *   const result = cot.conclude(steps => steps[steps.length - 1].result);
 */
export class ChainOfThought {
  private steps: ThoughtStep[] = [];

  /**
   * 추론 단계 추가 + 즉시 실행
   * @param thought 이 단계에서 하는 생각 (설명)
   * @param fn      실행할 함수. prev는 이전 단계 결과.
   * @param confidence 선택적 확신도 (0.0~1.0)
   */
  step(thought: string, fn: (prev?: any) => any, confidence?: number): this {
    const id = `step-${this.steps.length + 1}`;
    const prev = this.steps.length > 0
      ? this.steps[this.steps.length - 1].result
      : undefined;

    const startMs = Date.now();
    let result: any;
    let error: any;
    try {
      result = fn(prev);
    } catch (e) {
      error = e;
      result = { kind: "cot-error", error: e instanceof Error ? e.message : String(e) };
    }
    const durationMs = Date.now() - startMs;

    const thoughtStep: ThoughtStep = { id, thought, result, durationMs };
    if (confidence !== undefined) thoughtStep.confidence = confidence;

    this.steps.push(thoughtStep);

    // 에러가 있으면 다시 throw (TC-19)
    if (error !== undefined) throw error;

    return this;
  }

  /**
   * 결론 도출 — 모든 단계 완료 후 최종 결론 계산
   * @param fn 모든 steps 배열을 받아 결론 반환
   */
  conclude(fn: (steps: ThoughtStep[]) => any): CoTResult {
    const conclusion = fn(this.steps);

    const confidenceValues = this.steps
      .filter(s => s.confidence !== undefined)
      .map(s => s.confidence as number);
    const avgConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
      : undefined;

    return {
      steps: [...this.steps],
      conclusion,
      totalSteps: this.steps.length,
      confidence: avgConfidence,
    };
  }

  /** 현재까지 쌓인 단계 배열 반환 */
  getSteps(): ThoughtStep[] {
    return [...this.steps];
  }

  /**
   * 추론 과정을 마크다운으로 시각화
   */
  toMarkdown(): string {
    const lines: string[] = ["# Chain-of-Thought 추론\n"];
    for (let i = 0; i < this.steps.length; i++) {
      const s = this.steps[i];
      lines.push(`## Step ${i + 1}: ${s.thought}`);
      lines.push(`- **결과**: ${JSON.stringify(s.result)}`);
      if (s.confidence !== undefined) {
        lines.push(`- **확신도**: ${(s.confidence * 100).toFixed(0)}%`);
      }
      if (s.durationMs !== undefined) {
        lines.push(`- **소요시간**: ${s.durationMs}ms`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  /** JSON 직렬화 */
  toJSON(): object {
    return {
      kind: "chain-of-thought",
      totalSteps: this.steps.length,
      steps: this.steps.map(s => ({
        id: s.id,
        thought: s.thought,
        result: s.result,
        confidence: s.confidence,
        durationMs: s.durationMs,
      })),
    };
  }

  /** 내부 steps 초기화 (재사용용) */
  reset(): this {
    this.steps = [];
    return this;
  }
}

/**
 * FL 인터프리터용 COT 폼 평가기
 *
 * FL 문법:
 *   (COT
 *     :step "질문 이해" (parse-question $input)
 *     :step "분석" (analyze $facts)
 *     :conclude (fn [$steps] (synthesize $steps)))
 *
 * - :step "설명" expr — 단계 추가 + 실행
 * - :conclude fn — 결론 도출 fn (steps 배열 받음)
 * - 각 step에서 $prev로 이전 단계 결과 참조 가능
 */
export function evalCotForm(
  args: any[],
  evalFn: (node: any) => any,
  setVar: (name: string, value: any) => void,
  getVar: (name: string) => any,
): CoTResult {
  const cot = new ChainOfThought();
  let concludeFn: any = null;

  // FL 파서에서 S-expression 내 :symbol은 두 가지 형태로 올 수 있음:
  // 1. {kind: "keyword", name: "step"} — T.Keyword 토큰
  // 2. {kind: "literal", type: "string", value: "step"} — T.Colon + T.Symbol → string literal
  function isKeyword(node: any, name: string): boolean {
    if (!node) return false;
    if (node.kind === "keyword" && node.name === name) return true;
    if (node.kind === "literal" && node.type === "string" && node.value === name) return true;
    return false;
  }

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    // :step 키워드
    if (isKeyword(arg, "step")) {
      i++;
      if (i >= args.length) throw new Error("COT :step requires a description string");

      // step 설명 (문자열 리터럴 또는 평가)
      const descNode = args[i];
      let desc: string;
      if (descNode?.kind === "literal" && typeof descNode.value === "string") {
        desc = descNode.value;
      } else {
        desc = String(evalFn(descNode));
      }
      i++;

      if (i >= args.length) throw new Error(`COT :step "${desc}" requires an expression`);

      // step 표현식 (평가를 fn으로 감싸서 $prev 주입)
      const stepExpr = args[i];
      i++;

      // 확신도 선택적 파싱: :confidence 0.9
      let confidence: number | undefined;
      if (i < args.length && isKeyword(args[i], "confidence")) {
        i++;
        if (i < args.length) {
          confidence = Number(evalFn(args[i]));
          i++;
        }
      }

      cot.step(desc, (prev: any) => {
        // $prev 주입
        setVar("$prev", prev !== undefined ? prev : null);
        return evalFn(stepExpr);
      }, confidence);

      continue;
    }

    // :conclude 키워드
    if (isKeyword(arg, "conclude")) {
      i++;
      if (i >= args.length) throw new Error("COT :conclude requires a function");
      concludeFn = evalFn(args[i]);
      i++;
      continue;
    }

    // 나머지는 건너뜀
    i++;
  }

  // conclude fn이 없으면 마지막 step 결과를 결론으로
  const concludeWrapper = (steps: ThoughtStep[]): any => {
    if (concludeFn === null) {
      return steps.length > 0 ? steps[steps.length - 1].result : null;
    }
    if (typeof concludeFn === "function") {
      return concludeFn(steps);
    }
    if (concludeFn?.kind === "function-value") {
      // FreeLang function value 호출 — callFunctionValue를 통해 처리
      // steps 배열을 인자로 전달하기 위해 setVar + 직접 실행
      setVar("$__cot_steps__", steps);
      return concludeFn;
    }
    return concludeFn;
  };

  return cot.conclude(concludeWrapper);
}
