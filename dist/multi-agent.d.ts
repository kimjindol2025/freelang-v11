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
export declare class MessageBus {
    private agents;
    private log;
    private msgCounter;
    spawn(id: string, handler: (msg: AgentMessage, bus: MessageBus) => any): AgentHandle;
    send(from: string, to: string, content: any): AgentMessage;
    broadcast(from: string, content: any): AgentMessage[];
    recv(agentId: string): AgentMessage | null;
    process(agentId: string): any[];
    stop(agentId: string): void;
    history(): AgentMessage[];
    list(): string[];
    inboxSize(agentId: string): number;
    size(): number;
    get(agentId: string): AgentHandle | undefined;
}
export declare const globalBus: MessageBus;
//# sourceMappingURL=multi-agent.d.ts.map