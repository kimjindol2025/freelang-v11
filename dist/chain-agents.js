"use strict";
// chain-agents.ts — FreeLang v9 Phase 128: Agent Chain Pipeline
// [CHAIN-AGENTS] 에이전트 체인 파이프라인 블록
// 여러 에이전트를 순차 연결, 이전 출력이 다음 입력으로 흐름
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalChain = exports.AgentChain = void 0;
class AgentChain {
    constructor() {
        this.agents = [];
    }
    add(agent) {
        this.agents.push(agent);
        return this;
    }
    run(initialInput) {
        const links = [];
        let current = initialInput;
        let success = true;
        for (const agent of this.agents) {
            const start = Date.now();
            try {
                const output = agent.transform(current);
                const valid = agent.validate ? agent.validate(output) : true;
                links.push({
                    agentId: agent.id,
                    input: current,
                    output,
                    duration: Date.now() - start,
                    skipped: !valid,
                });
                if (valid)
                    current = output;
                // validate 실패 시 이전 값 유지하고 계속
            }
            catch {
                links.push({
                    agentId: agent.id,
                    input: current,
                    output: null,
                    duration: Date.now() - start,
                    skipped: true,
                });
                success = false;
                break;
            }
        }
        return {
            finalOutput: current,
            links,
            success,
            stepsCompleted: links.filter(l => !l.skipped).length,
        };
    }
    // 팩토리: 배열로 빠르게 체인 생성
    static from(agents) {
        const chain = new AgentChain();
        agents.forEach(a => chain.add(a));
        return chain;
    }
    length() {
        return this.agents.length;
    }
}
exports.AgentChain = AgentChain;
exports.globalChain = new AgentChain();
//# sourceMappingURL=chain-agents.js.map