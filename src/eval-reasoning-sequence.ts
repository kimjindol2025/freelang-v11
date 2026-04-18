// eval-reasoning-sequence.ts — FreeLang v9 Reasoning Sequence Evaluation
// Phase 57 리팩토링: interpreter.ts의 handleReasoningSequence 분리

import { Interpreter } from "./interpreter";
import { ReasoningSequence, ReasoningBlock, ASTNode } from "./ast";

export function handleReasoningSequence(interp: Interpreter, reasoningSeq: ReasoningSequence): any {
  const { stages, metadata, feedbackLoop } = reasoningSeq;
  const logger = (interp as any).logger;
  const ctx = interp.context;

  if (!ctx.reasoning) ctx.reasoning = new Map();

  const sequenceId = new Date().getTime();
  const executionPath: string[] = [];
  const sequenceResults: any[] = [];
  const iterationHistory: any[] = [];

  logger.info(
    `🔄 REASONING SEQUENCE START (${stages.length} stages, feedback: ${
      feedbackLoop?.enabled ? "enabled" : "disabled"
    })`
  );

  let currentStages = stages;
  let iteration = 0;
  const maxIterations = feedbackLoop?.maxIterations || 1;

  if (!reasoningSeq.context) reasoningSeq.context = {};
  if (!reasoningSeq.context.searches) reasoningSeq.context.searches = new Map();
  if (!reasoningSeq.context.learned) reasoningSeq.context.learned = new Map();

  ctx.currentSearches = reasoningSeq.context.searches;
  ctx.currentLearned = reasoningSeq.context.learned;

  while (iteration < maxIterations) {
    iteration++;

    if (iteration > 1) {
      logger.info(
        `🔄 FEEDBACK LOOP ITERATION ${iteration}/${maxIterations} (damping: ${(
          feedbackLoop?.confidenceDamping || 0.1
        ).toFixed(1)})`
      );
    }

    const iterationResults: any[] = [];
    let verifyResult: any = null;

    for (let i = 0; i < currentStages.length; i++) {
      const stage = currentStages[i];
      const stageNum = i + 1;

      if ((stage as any).kind === "search-block") {
        const searchBlock = stage as any;
        logger.info(`  [${stageNum}/${currentStages.length}] 🔎 SEARCH`);
        const searchResult = (interp as any).handleSearchBlock(searchBlock);
        if (!reasoningSeq.context) reasoningSeq.context = {};
        if (!reasoningSeq.context.searches) reasoningSeq.context.searches = new Map();
        reasoningSeq.context.searches.set(`search_${i}`, searchResult);
        iterationResults.push(searchResult);
        executionPath.push("search");
        logger.info(`  ✓ Search result stored in context`);
        continue;
      }

      if ((stage as any).kind === "learn-block") {
        const learnBlock = stage as any;
        logger.info(`  [${stageNum}/${currentStages.length}] 📚 LEARN`);
        const learnResult = (interp as any).handleLearnBlock(learnBlock);
        if (!reasoningSeq.context) reasoningSeq.context = {};
        if (!reasoningSeq.context.learned) reasoningSeq.context.learned = new Map();
        const learnKey = learnBlock.key || `learn_${i}`;
        reasoningSeq.context.learned.set(learnKey, learnResult);
        iterationResults.push(learnResult);
        executionPath.push("learn");
        logger.info(`  ✓ Learned data stored in context (key: ${learnKey})`);
        continue;
      }

      const reasoningBlock = stage as ReasoningBlock;
      if (reasoningBlock.kind !== "reasoning-block") {
        throw new Error(`Unexpected stage kind in reasoning sequence: ${(stage as any).kind}`);
      }

      const stageEmoji = { observe: "👀", analyze: "🔍", decide: "🎯", act: "⚡", verify: "✅" }[reasoningBlock.stage] || "❓";
      logger.info(`  [${stageNum}/${currentStages.length}] ${stageEmoji} ${reasoningBlock.stage.toUpperCase()}`);

      if (reasoningBlock.whenGuard) {
        const guardCondition = evalCondition(interp, reasoningBlock.whenGuard);
        if (!guardCondition) {
          logger.info(`  ⏭️  SKIPPED (when guard condition false)`);
          continue;
        }
      }

      let adjustedStage = reasoningBlock;
      if (iteration > 1 && reasoningBlock.metadata?.confidence !== undefined) {
        adjustedStage = {
          ...reasoningBlock,
          metadata: {
            ...reasoningBlock.metadata,
            confidence: Math.max(
              0,
              (reasoningBlock.metadata.confidence || 1) -
                (feedbackLoop?.confidenceDamping || 0.1) * (iteration - 1)
            ),
          },
        };
      }

      let blockToHandle = adjustedStage;
      if (reasoningBlock.conditional) {
        const conditionMet = evalCondition(interp, reasoningBlock.conditional.condition);
        const selectedBlock = conditionMet ? reasoningBlock.conditional.thenBlock : reasoningBlock.conditional.elseBlock;
        if (selectedBlock) {
          blockToHandle = selectedBlock;
          logger.info(`  ${conditionMet ? "✓" : "✗"} IF condition ${conditionMet ? "TRUE" : "FALSE"}`);
        } else if (!conditionMet && !reasoningBlock.conditional.elseBlock) {
          logger.info(`  ⏭️  SKIPPED (if condition false, no else block)`);
          continue;
        }
      }

      let stageResult: any;
      if (reasoningBlock.loopControl) {
        const { type, condition, maxIterations = 1000 } = reasoningBlock.loopControl;
        const loopMaxIter = Math.min(maxIterations, 1000);
        let loopIteration = 0;
        while (loopIteration < loopMaxIter) {
          loopIteration++;
          const conditionValue = evalCondition(interp, condition);
          const shouldContinue = type === "repeat-until" ? !conditionValue : conditionValue;
          if (!shouldContinue && loopIteration > 1) break;
          stageResult = (interp as any).handleReasoningBlock(blockToHandle as ReasoningBlock);
          logger.info(`  🔁 ${type.toUpperCase()} ITERATION ${loopIteration}/${loopMaxIter}`);
        }
      } else {
        stageResult = (interp as any).handleReasoningBlock(blockToHandle as ReasoningBlock);
      }

      iterationResults.push(stageResult);
      executionPath.push(reasoningBlock.stage);

      if (reasoningBlock.stage === "verify") verifyResult = stageResult;

      if (reasoningBlock.transitions && reasoningBlock.transitions.length > 0) {
        for (const transition of reasoningBlock.transitions) {
          if (transition.condition) {
            const conditionMet = interp.eval(transition.condition);
            if (conditionMet && transition.to) logger.info(`    ↓ Transition to: ${transition.to}`);
          }
        }
      }
    }

    sequenceResults.push(...iterationResults);
    iterationHistory.push({ iteration, results: iterationResults, verifyConfidence: verifyResult?.metadata?.confidence });

    const shouldContinueFeedback =
      feedbackLoop?.enabled &&
      iteration < maxIterations &&
      verifyResult &&
      evalFeedbackCondition(interp, verifyResult, feedbackLoop);

    if (shouldContinueFeedback) {
      logger.info(`↩️  FEEDBACK TRIGGERED: Returning to "${feedbackLoop.toStage}" stage`);
      const feedbackTargetIndex = currentStages.findIndex(
        (s) => (s as ReasoningBlock).stage === feedbackLoop.toStage
      );
      if (feedbackTargetIndex >= 0) currentStages = currentStages.slice(feedbackTargetIndex);
    } else {
      break;
    }
  }

  const sequenceResult = {
    kind: "reasoning-sequence-result",
    stages: sequenceResults,
    executionPath,
    iterations: iterationHistory.length,
    feedbackTriggered: iteration > 1,
    metadata: { ...metadata, sequenceId, completedAt: new Date().toISOString(), totalStages: stages.length, iterations: iteration },
    completed: true,
  };

  const sequenceKey = `sequence-${sequenceId}`;
  ctx.reasoning!.set(sequenceKey, sequenceResult);

  const totalConfidence = sequenceResults.reduce((sum, r) => sum + (r.metadata?.confidence || 0), 0) / Math.max(sequenceResults.length, 1);
  logger.info(`✅ REASONING SEQUENCE COMPLETE (${stages.length} stages, ${iteration} iterations, confidence: ${(totalConfidence * 100).toFixed(0)}%)`);

  return sequenceResult;
}

function evalFeedbackCondition(interp: Interpreter, verifyResult: any, feedbackLoop: any): boolean {
  const defaultThreshold = 0.8;
  const confidence = verifyResult?.metadata?.confidence || 0;
  if (feedbackLoop.condition) {
    try { return interp.eval(feedbackLoop.condition); }
    catch (e) { return confidence < defaultThreshold; }
  }
  return confidence < defaultThreshold;
}

function evalCondition(interp: Interpreter, conditionNode: ASTNode): boolean {
  if (!conditionNode) return false;
  try {
    const result = interp.eval(conditionNode);
    if (typeof result === "boolean") return result;
    if (typeof result === "number") return result !== 0;
    if (typeof result === "string") return result.length > 0;
    if (result === null || result === undefined) return false;
    return !!result;
  } catch (e) {
    return false;
  }
}
