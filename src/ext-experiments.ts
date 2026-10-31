// Phase 113-130: Experiments Bundle Entry Point
// stdlib-ext-experiments.js로 빌드됨 — eval-builtins.ts의 lazy accessor가 로드

export { globalDebater } from "./experiments/debate";
export { globalCheckpoint } from "./experiments/checkpoint";
export { globalMetaReasoner } from "./experiments/meta-reason";
export { globalBeliefs } from "./experiments/belief";
export { globalAnalogy } from "./experiments/analogy";
export { globalCritique, defaultFinders, severityWeight } from "./experiments/critique";
export { globalComposer } from "./experiments/compose-reason";
export { globalCognition } from "./experiments/cognitive";
export { globalConsensus } from "./experiments/consensus";
export { globalDelegation } from "./experiments/delegate";
export { globalNegotiator } from "./experiments/negotiate";
export { globalVoting } from "./experiments/vote";
export { globalSwarm } from "./experiments/swarm";
export { globalPeerReview } from "./experiments/peer-review";
export { globalCompetition } from "./experiments/compete";
export { AgentChain } from "./experiments/chain-agents";
export { globalHub } from "./experiments/multi-agent-hub";
export { globalOrchestrator } from "./experiments/orchestrate";
