"use strict";
// FreeLang v9 Multi-Agent Communication
// Phase 103: 멀티 에이전트 통신 시스템
// (agent-send "agentId" message)
// (agent-recv "agentId")
// (agent-broadcast message)
// (agent-spawn "id" handlerFn)
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalBus = exports.MessageBus = void 0;
class MessageBus {
    constructor() {
        this.agents = new Map();
        this.log = [];
        this.msgCounter = 0;
    }
    // 에이전트 등록
    spawn(id, handler) {
        const handle = { id, handler, inbox: [], running: true };
        this.agents.set(id, handle);
        return handle;
    }
    // 단일 메시지 전송
    send(from, to, content) {
        const msg = {
            from, to, content,
            timestamp: Date.now(),
            id: `msg-${++this.msgCounter}`
        };
        const target = this.agents.get(to);
        if (target) {
            target.inbox.push(msg);
        }
        this.log.push(msg);
        return msg;
    }
    // 브로드캐스트
    broadcast(from, content) {
        return [...this.agents.keys()]
            .filter(id => id !== from)
            .map(to => this.send(from, to, content));
    }
    // 수신 (첫 메시지 꺼내기)
    recv(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent || agent.inbox.length === 0)
            return null;
        return agent.inbox.shift();
    }
    // 수신 대기 + 핸들러 실행
    process(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return [];
        const results = [];
        while (agent.inbox.length > 0) {
            const msg = agent.inbox.shift();
            results.push(agent.handler(msg, this));
        }
        return results;
    }
    // 에이전트 중지
    stop(agentId) {
        const agent = this.agents.get(agentId);
        if (agent)
            agent.running = false;
    }
    // 전체 메시지 로그
    history() { return [...this.log]; }
    // 에이전트 목록
    list() { return [...this.agents.keys()]; }
    // 인박스 크기
    inboxSize(agentId) {
        return this.agents.get(agentId)?.inbox.length ?? 0;
    }
    size() { return this.agents.size; }
    // 에이전트 가져오기
    get(agentId) {
        return this.agents.get(agentId);
    }
}
exports.MessageBus = MessageBus;
exports.globalBus = new MessageBus();
//# sourceMappingURL=multi-agent.js.map