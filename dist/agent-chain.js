"use strict";
// agent-chain.ts — FreeLang v9 Phase 128: CHAIN-AGENTS 에이전트 체인 파이프라인
// 여러 에이전트를 순서대로 연결하여 출력이 다음 에이전트의 입력이 되는 파이프라인
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalAgentChain = exports.AgentChain = void 0;
class AgentChain {
    constructor() {
        this.agents = [];
    }
    /** 에이전트 추가 (순서대로) */
    add(agent) {
        this.agents.push(agent);
        return this;
    }
    /** 에이전트 목록 */
    list() {
        return this.agents.map(a => a.id);
    }
    /** 파이프라인 실행 */
    run(initialInput) {
        const start = Date.now();
        const steps = [];
        let current = initialInput;
        let success = true;
        for (const agent of this.agents) {
            const stepStart = Date.now();
            try {
                const output = agent.process(current);
                steps.push({ agentId: agent.id, input: current, output, duration: Date.now() - stepStart });
                current = output;
            }
            catch (e) {
                steps.push({ agentId: agent.id, input: current, output: null, duration: Date.now() - stepStart });
                success = false;
                break;
            }
        }
        return { finalOutput: current, steps, success, totalDuration: Date.now() - start };
    }
    /** 에이전트 수 */
    size() {
        return this.agents.length;
    }
    /** 체인 초기화 */
    clear() {
        this.agents = [];
    }
}
exports.AgentChain = AgentChain;
exports.globalAgentChain = new AgentChain();
//# sourceMappingURL=agent-chain.js.map