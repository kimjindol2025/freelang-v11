// eval-phase150.ts — Phase 150: FreeLang v9 완전체 빌트인 함수
// 이 파일은 eval-builtins.ts에서 호출됩니다

import { freelangV9, FREELANG_V9_MANIFEST } from "./freelang-v9-complete";

const _fl9 = freelangV9;

export function evalPhase150Complete(op: string, args: any[]): any | null {
  // (fl-v9-process "문제" {:context "..."}) → FreeLangV9Response Map
  if (op === "fl-v9-process") {
    const inp = String(args[0] ?? "");
    const ctx: Record<string, unknown> = {};
    if (args[1] instanceof Map) args[1].forEach((v: any, k: any) => { ctx[String(k).replace(/^:/, "")] = v; });
    const r = _fl9.process(inp, ctx);
    return new Map<string, any>([
      ["input", r.input], ["output", r.output], ["reasoning", r.reasoning ?? []],
      ["confidence", r.confidence ?? 0],
      ["ethicsCheck", r.ethicsCheck ? new Map<string, any>([["passed", r.ethicsCheck.passed], ["score", r.ethicsCheck.score]]) : null],
      ["aligned", r.aligned ?? null], ["wisdom", r.wisdom ?? null], ["executionMs", r.executionMs],
    ]);
  }

  // (fl-v9-status) → FreeLangV9Status Map
  if (op === "fl-v9-status") {
    const s = _fl9.status();
    return new Map<string, any>([
      ["version", s.version], ["tiers", new Map(Object.entries(s.tiers))],
      ["phases", s.phases], ["features", s.features],
      ["uptime", s.uptime], ["memoryUsed", s.memoryUsed ?? null],
    ]);
  }

  // (fl-v9-think "문제" ["제약1"]) → FreeLangV9Response Map
  if (op === "fl-v9-think") {
    const prob = String(args[0] ?? "");
    const constr: string[] = Array.isArray(args[1]) ? args[1].map(String) : [];
    const r = _fl9.thinkCheckAlignRespond(prob, constr);
    return new Map<string, any>([
      ["input", r.input], ["output", r.output], ["reasoning", r.reasoning ?? []],
      ["confidence", r.confidence ?? 0],
      ["ethicsCheck", r.ethicsCheck ? new Map<string, any>([["passed", r.ethicsCheck.passed], ["score", r.ethicsCheck.score]]) : null],
      ["aligned", r.aligned ?? null], ["wisdom", r.wisdom ?? null], ["executionMs", r.executionMs],
    ]);
  }

  // (fl-v9-diagnose) → 자기 진단 Map
  if (op === "fl-v9-diagnose") {
    const d = _fl9.selfDiagnose();
    return new Map<string, any>([
      ["healthy", d.healthy], ["issues", d.issues],
      ["recommendations", d.recommendations], ["score", d.score],
    ]);
  }

  // (fl-v9-features) → string[]
  if (op === "fl-v9-features") return _fl9.getFeatures();

  // (fl-v9-version) → "9.0.0"
  if (op === "fl-v9-version") return _fl9.getVersion();

  // (fl-v9-enable "feature") → nil
  if (op === "fl-v9-enable") {
    _fl9.enable(String(args[0] ?? "").replace(/^:/, ""));
    return null;
  }

  // (fl-v9-disable "feature") → nil
  if (op === "fl-v9-disable") {
    _fl9.disable(String(args[0] ?? "").replace(/^:/, ""));
    return null;
  }

  // (fl-v9-manifest) → MANIFEST Map
  if (op === "fl-v9-manifest") {
    return new Map<string, any>([
      ["version", FREELANG_V9_MANIFEST.version],
      ["phases", FREELANG_V9_MANIFEST.phases],
      ["tiers", FREELANG_V9_MANIFEST.tiers],
      ["description", FREELANG_V9_MANIFEST.description],
      ["completedAt", FREELANG_V9_MANIFEST.completedAt],
      ["features", FREELANG_V9_MANIFEST.features],
      ["philosophy", FREELANG_V9_MANIFEST.philosophy],
    ]);
  }

  return null;
}
