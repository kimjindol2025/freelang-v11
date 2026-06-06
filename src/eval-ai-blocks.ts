// eval-ai-blocks.ts — FreeLang v9 AI Block Evaluation
// Phase 57 리팩토링: interpreter.ts의 AI 블록 처리를 분리
// search, fetch, learn, recall, remember, forget, observe, analyze, decide, act, verify, await

import { Interpreter } from "./interpreter";
import { SExpr, Keyword } from "./ast";
import { SearchBlock, LearnBlock, ReasoningBlock } from "./ast";
import { FreeLangPromise } from "./async-runtime";

export function evalAiBlock(interp: Interpreter, op: string, expr: SExpr): any {
  const ev = (node: any) => (interp as any).eval(node);

  // ── search / fetch ──────────────────────────────────────────────
  if (op === "search" || op === "fetch") {
    let query: string = "";
    let source: "web" | "api" | "kb" = "web";
    let cache: boolean = false;
    let limit: number = 10;
    let name: string | undefined;

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if (i === 0) {
        query = String(ev(arg));
        continue;
      }
      if ((arg as any).kind === "keyword") {
        const keywordName = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const value = ev(expr.args[i + 1]);
          switch (keywordName) {
            case "source":
              if (value === "web" || value === "api" || value === "kb") source = value;
              break;
            case "cache":
              cache = value === true || value === "true";
              break;
            case "limit":
              limit = Number(value) || 10;
              break;
            case "name":
              name = String(value);
              break;
          }
          i++;
        }
      }
    }

    if (op === "fetch") source = "api";

    const searchBlock: SearchBlock = { kind: "search-block", query, source, cache, limit, name };
    return (interp as any).handleSearchBlock(searchBlock);
  }

  // ── learn / recall / remember / forget ──────────────────────────
  if (op === "learn" || op === "recall" || op === "remember" || op === "forget") {
    let key: string = "";
    let data: any = null;
    let source: "search" | "feedback" | "analysis" = "search";
    let confidence: number | undefined;

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if (i === 0) {
        key = String(ev(arg));
        continue;
      }
      if (i === 1 && (op === "learn" || op === "remember")) {
        data = ev(arg);
        continue;
      }
      if ((arg as any).kind === "keyword") {
        const keywordName = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const value = ev(expr.args[i + 1]);
          switch (keywordName) {
            case "source":
              if (value === "search" || value === "feedback" || value === "analysis") source = value;
              break;
            case "confidence":
              confidence = Number(value) || undefined;
              break;
          }
          i++;
        }
      }
    }

    if (op === "forget") {
      if (!interp.context.learned) interp.context.learned = new Map();
      const found = interp.context.learned.has(key);
      if (found) interp.context.learned.delete(key);
      return { kind: "learn-result", operation: "forget", key, deleted: found };
    }

    if (op === "recall") data = null;

    const learnBlock: LearnBlock = {
      kind: "learn-block",
      key,
      data,
      source,
      confidence,
      timestamp: new Date().toISOString(),
    };
    return (interp as any).handleLearnBlock(learnBlock);
  }

  // ── observe / analyze / decide / act / verify ────────────────────
  if (op === "observe" || op === "analyze" || op === "decide" || op === "act" || op === "verify") {
    const stage = op as "observe" | "analyze" | "decide" | "act" | "verify";
    const data = new Map<string, any>();
    let observations: any[] | undefined;
    let analysis: any[] | undefined;
    let decisions: any[] | undefined;
    let actions: any[] | undefined;
    let verifications: any[] | undefined;
    let confidence: number | undefined;

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const keywordName = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const value = ev(expr.args[i + 1]);
          if (keywordName === "confidence") confidence = Number(value);
          else data.set(keywordName, value);
          i++;
        }
      } else if (i === 0) {
        const argValue = ev(arg);
        switch (stage) {
          case "observe":
            observations = [argValue];
            data.set("observation", argValue);
            break;
          case "analyze":
            data.set("firstArg", argValue);
            break;
          case "decide":
            data.set("firstArg", argValue);
            break;
          case "act":
            data.set("firstArg", argValue);
            break;
          case "verify":
            verifications = [argValue];
            data.set("result", argValue);
            break;
        }
      }
    }

    const reasoningBlock: ReasoningBlock = {
      kind: "reasoning-block",
      stage,
      data,
      observations,
      analysis,
      decisions,
      actions,
      verifications,
      metadata: { confidence, startTime: new Date().toISOString() },
    };
    return (interp as any).handleReasoningBlock(reasoningBlock);
  }

  // ── await ────────────────────────────────────────────────────────
  if (op === "await") {
    if (expr.args.length < 1) throw new Error(`await requires a Promise argument`);
    const promise = ev(expr.args[0]);
    if (promise instanceof FreeLangPromise) {
      if (promise.getState() === "resolved") return promise.getValue();
      if (promise.getState() === "rejected") throw promise.getError() || new Error("Promise rejected");
      throw new Error("Cannot await unresolved Promise in synchronous context");
    }
    throw new TypeError("await requires a Promise, got " + typeof promise);
  }

  throw new Error(`evalAiBlock: unknown op "${op}"`);
}
