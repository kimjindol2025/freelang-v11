// eval-ai-handlers.ts — FreeLang v9 AI Block Handlers
// Phase 57 리팩토링: interpreter.ts의 Search/Learn/Reasoning 핸들러 분리
// handleSearchBlock, handleLearnBlock, handleReasoningBlock

import { Interpreter } from "./interpreter";
import { SearchBlock, LearnBlock, ReasoningBlock } from "./ast";

export function handleSearchBlock(interp: Interpreter, searchBlock: SearchBlock): any {
  const { query, source = "web", cache = true, limit = 10, name } = searchBlock;
  interp.logger.info(`🔎 SEARCH "${query}"`);
  try {
    const results = interp.searchAdapter.searchSync(query, { limit, cache });
    const searchResult = {
      kind: "search-result",
      query, source, cache, limit, name,
      status: "completed",
      results,
      count: results.length,
      timestamp: new Date().toISOString(),
    };
    if (!interp.context.cache) interp.context.cache = new Map();
    const cacheKey = name || `search_${Date.now()}`;
    interp.context.cache.set(cacheKey, searchResult);
    return searchResult;
  } catch (error) {
    interp.logger.error(`❌ Search failed: ${(error as Error).message}`);
    return { kind: "search-error", query, message: (error as Error).message, timestamp: new Date().toISOString() };
  }
}

export function handleLearnBlock(interp: Interpreter, learnBlock: LearnBlock): any {
  const { key, data, source = "search", confidence = 0.85, timestamp } = learnBlock;
  if (!interp.context.learned) interp.context.learned = new Map();
  try {
    if (data === null) {
      const loadedFact = interp.learnedFactsStore.load(key);
      if (loadedFact) {
        interp.logger.info(`📚 LEARN (recall) "${key}" (confidence: ${(loadedFact.confidence * 100).toFixed(0)}%)`);
        interp.context.learned.set(key, {
          data: loadedFact.data, source: loadedFact.source,
          confidence: loadedFact.confidence, timestamp: new Date(loadedFact.timestamp).toISOString(),
        });
        return {
          kind: "learn-result", operation: "recall", key,
          data: loadedFact.data, source: loadedFact.source,
          confidence: loadedFact.confidence, timestamp: new Date(loadedFact.timestamp).toISOString(),
          found: true, accessCount: loadedFact.accessCount,
        };
      } else {
        interp.logger.info(`📚 LEARN (recall) "${key}" - not found`);
        return { kind: "learn-result", operation: "recall", key, data: null, found: false };
      }
    }
    if (confidence < 0 || confidence > 1) throw new Error(`Invalid confidence: ${confidence}.`);
    interp.learnedFactsStore.save(key, data, { confidence, source, ttlDays: 30 });
    interp.context.learned.set(key, { data, source, confidence, timestamp: timestamp ?? new Date().toISOString() });
    interp.logger.info(`  ✓ Learned data stored in context (key: ${key})`);
    return {
      kind: "learn-result", operation: "learn", key, data, source, confidence,
      timestamp: timestamp ?? new Date().toISOString(), saved: "disk",
    };
  } catch (error) {
    interp.logger.error(`❌ Learn failed: ${(error as Error).message}`);
    return { kind: "learn-error", key, message: (error as Error).message, timestamp: new Date().toISOString() };
  }
}

export function handleReasoningBlock(interp: Interpreter, reasoningBlock: ReasoningBlock): any {
  const { stage, data, observations, analysis, decisions, actions, verifications, metadata, transitions } = reasoningBlock;
  if (!interp.context.reasoning) interp.context.reasoning = new Map();

  const reasoningState = {
    stage,
    data: Object.fromEntries(data),
    observations, analysis, decisions, actions, verifications,
    metadata: { ...metadata, completedAt: new Date().toISOString() },
    transitions: transitions || [],
  };

  const stateKey = `${stage}-${new Date().getTime()}`;
  interp.context.reasoning.set(stateKey, reasoningState);

  const stageEmoji: Record<string, string> = { observe: "👀", analyze: "🔍", decide: "🎯", act: "⚡", verify: "✅" };
  let logMessage = `${stageEmoji[stage] || "❓"} ${stage.toUpperCase()}`;

  switch (stage) {
    case "observe":
      if (observations && observations.length > 0) logMessage += `: ${observations.length} observations`;
      break;
    case "analyze": {
      const currentSearches = (interp.context as any).currentSearches;
      if (currentSearches && currentSearches.size > 0) logMessage += ` [using ${currentSearches.size} search result(s)]`;
      const angles = data.get("angles");
      if (angles instanceof Map) logMessage += `: ${angles.size} angles analyzed`;
      const selected = data.get("selected");
      if (selected) logMessage += `, selected: "${selected.value || selected}"`;
      break;
    }
    case "decide": {
      const currentLearned = (interp.context as any).currentLearned;
      if (currentLearned && currentLearned.size > 0) logMessage += ` [using ${currentLearned.size} learned fact(s)]`;
      const choice = data.get("choice");
      if (choice) logMessage += `: "${choice.value || choice}"`;
      const reason = data.get("reason");
      if (reason) logMessage += ` (${reason.value || reason})`;
      break;
    }
    case "act": {
      const action = data.get("action");
      if (action) logMessage += `: "${action.value || action}"`;
      break;
    }
    case "verify": {
      const result = data.get("result");
      if (result) logMessage += `: ${result.value || result}`;
      if (metadata?.confidence !== undefined) logMessage += ` (confidence: ${(metadata.confidence * 100).toFixed(0)}%)`;
      break;
    }
  }

  interp.logger.info(logMessage);

  return {
    kind: "reasoning-result",
    stage,
    data: Object.fromEntries(data),
    observations, analysis, decisions, actions, verifications,
    metadata: reasoningState.metadata,
    stateKey,
    completed: true,
  };
}
