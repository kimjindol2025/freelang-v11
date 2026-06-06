// Runtime Effect Enforcement — types only (C2)
// 설계: docs/DESIGN-EFFECT-ENFORCEMENT.md
// hook 미연결 단계. runtime semantics 변화 없음.

export type EffectTag =
  | "pure"
  | "io"
  | "net"
  | "process"
  | "time"
  | "random";

export const EFFECT_TAGS: readonly EffectTag[] = Object.freeze([
  "pure",
  "io",
  "net",
  "process",
  "time",
  "random",
] as const);

export type EffectSpan = {
  readonly file: string;
  readonly line: number;
  readonly col: number;
};

export type EffectFrame = {
  readonly fnName: string;
  readonly allowed: ReadonlySet<EffectTag> | null;
  readonly span?: EffectSpan;
};

export type EffectViolationArgs = {
  readonly fn: string;
  readonly target_effect: EffectTag;
  readonly allowed: readonly EffectTag[];
  readonly chain: readonly string[];
  readonly span?: EffectSpan;
};

export class EffectViolation extends Error {
  readonly fn: string;
  readonly target_effect: EffectTag;
  readonly allowed: readonly EffectTag[];
  readonly chain: readonly string[];
  readonly span?: EffectSpan;

  constructor(args: EffectViolationArgs) {
    super(EffectViolation.formatMessage(args));
    this.name = "EffectViolation";
    this.fn = args.fn;
    this.target_effect = args.target_effect;
    this.allowed = args.allowed;
    this.chain = args.chain;
    this.span = args.span;
  }

  static formatMessage(args: EffectViolationArgs): string {
    const ctxLabel =
      args.allowed.length === 0
        ? "pure"
        : `[:${args.allowed.join(" :")}]`;
    const spanStr = args.span
      ? `${args.span.file}:${args.span.line}:${args.span.col}`
      : "<unknown>";
    const chainLines =
      args.chain.length === 0
        ? ["    <empty>"]
        : args.chain.map((n) => `    → ${n}`);
    return [
      `EffectViolation:`,
      `  ${ctxLabel} context cannot call :${args.target_effect} function '${args.fn}'`,
      ``,
      `  effect-chain:`,
      ...chainLines,
      ``,
      `  allowed: [${args.allowed.map((e) => ":" + e).join(" ")}]`,
      `  required: :${args.target_effect}`,
      `  span: ${spanStr}`,
    ].join("\n");
  }
}
