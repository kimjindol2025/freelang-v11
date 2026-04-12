// FreeLang v9 Multi-Agent Communication
// Phase 103: 멀티 에이전트 통신 시스템
// (agent-send "agentId" message)
// (agent-recv "agentId")
// (agent-broadcast message)
// (agent-spawn "id" handlerFn)

export interface AgentMessage {
  from: string;
  to: string | 'broadcast';
  content: any;
  timestamp: number;
  id: string;
}

export interface AgentHandle {
  id: string;
  handler: (msg: AgentMessage, bus: MessageBus) => any;
  inbox: AgentMessage[];
  running: boolean;
}

export class MessageBus {
  private agents: Map<string, AgentHandle> = new Map();
  private log: AgentMessage[] = [];
  private msgCounter = 0;

  // 에이전트 등록
  spawn(id: string, handler: (msg: AgentMessage, bus: MessageBus) => any): AgentHandle {
    const handle: AgentHandle = { id, handler, inbox: [], running: true };
    this.agents.set(id, handle);
    return handle;
  }

  // 단일 메시지 전송
  send(from: string, to: string, content: any): AgentMessage {
    const msg: AgentMessage = {
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
  broadcast(from: string, content: any): AgentMessage[] {
    return [...this.agents.keys()]
      .filter(id => id !== from)
      .map(to => this.send(from, to, content));
  }

  // 수신 (첫 메시지 꺼내기)
  recv(agentId: string): AgentMessage | null {
    const agent = this.agents.get(agentId);
    if (!agent || agent.inbox.length === 0) return null;
    return agent.inbox.shift()!;
  }

  // 수신 대기 + 핸들러 실행
  process(agentId: string): any[] {
    const agent = this.agents.get(agentId);
    if (!agent) return [];
    const results: any[] = [];
    while (agent.inbox.length > 0) {
      const msg = agent.inbox.shift()!;
      results.push(agent.handler(msg, this));
    }
    return results;
  }

  // 에이전트 중지
  stop(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) agent.running = false;
  }

  // 전체 메시지 로그
  history(): AgentMessage[] { return [...this.log]; }

  // 에이전트 목록
  list(): string[] { return [...this.agents.keys()]; }

  // 인박스 크기
  inboxSize(agentId: string): number {
    return this.agents.get(agentId)?.inbox.length ?? 0;
  }

  size(): number { return this.agents.size; }

  // 에이전트 가져오기
  get(agentId: string): AgentHandle | undefined {
    return this.agents.get(agentId);
  }
}

export const globalBus = new MessageBus();
