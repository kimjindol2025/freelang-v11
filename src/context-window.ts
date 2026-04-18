// context-window.ts — FreeLang v9 Phase 95
// AI 컨텍스트 윈도우 관리: 무엇을 기억하고, 무엇을 버리고, 어떻게 압축할지

export interface ContextEntry {
  id: string;
  content: any;
  tokens: number;        // 토큰 수 추정
  priority: number;      // 우선순위 (높을수록 보존, 0.0~1.0)
  timestamp: number;
  tags: string[];
}

export type ContextStrategy = "sliding" | "priority" | "summarize";

export interface ContextWindow {
  maxTokens: number;
  entries: ContextEntry[];
  usedTokens: number;
  strategy: ContextStrategy;
}

let _idCounter = 0;
function genId(): string {
  return `ctx-${Date.now()}-${++_idCounter}`;
}

export class ContextManager {
  private window: ContextWindow;

  constructor(maxTokens: number = 4096, strategy: ContextStrategy = "priority") {
    this.window = {
      maxTokens,
      entries: [],
      usedTokens: 0,
      strategy,
    };
  }

  // 토큰 추정: JSON.stringify 길이 / 4 (근사값)
  estimateTokens(content: any): number {
    try {
      const str = typeof content === "string" ? content : JSON.stringify(content);
      return Math.max(1, Math.ceil(str.length / 4));
    } catch {
      return 1;
    }
  }

  hasRoom(tokens: number): boolean {
    return this.window.usedTokens + tokens <= this.window.maxTokens;
  }

  add(
    content: any,
    opts?: { priority?: number; tags?: string[]; tokens?: number }
  ): string {
    const tokens = opts?.tokens ?? this.estimateTokens(content);
    const priority = opts?.priority ?? 0.5;
    const tags = opts?.tags ?? [];
    const id = genId();

    const entry: ContextEntry = {
      id,
      content,
      tokens,
      priority,
      timestamp: Date.now(),
      tags,
    };

    this.window.entries.push(entry);
    this.window.usedTokens += tokens;

    // 용량 초과 시 자동 trim
    if (this.window.usedTokens > this.window.maxTokens) {
      this.trim();
    }

    return id;
  }

  get(id: string): ContextEntry | undefined {
    return this.window.entries.find((e) => e.id === id);
  }

  remove(id: string): void {
    const idx = this.window.entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.window.usedTokens -= this.window.entries[idx].tokens;
      this.window.entries.splice(idx, 1);
      if (this.window.usedTokens < 0) this.window.usedTokens = 0;
    }
  }

  // 오래된/낮은 우선순위 항목 제거 — 용량이 확보될 때까지
  trim(): ContextEntry[] {
    const removed: ContextEntry[] = [];

    if (this.window.usedTokens <= this.window.maxTokens) {
      return removed;
    }

    // priority 낮은 순 → 오래된 순으로 정렬하여 제거
    const sorted = [...this.window.entries].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.timestamp - b.timestamp;
    });

    for (const candidate of sorted) {
      if (this.window.usedTokens <= this.window.maxTokens) break;
      const idx = this.window.entries.findIndex((e) => e.id === candidate.id);
      if (idx !== -1) {
        this.window.usedTokens -= this.window.entries[idx].tokens;
        removed.push(this.window.entries[idx]);
        this.window.entries.splice(idx, 1);
      }
    }

    if (this.window.usedTokens < 0) this.window.usedTokens = 0;
    return removed;
  }

  // 압축: fn이 entries를 받아 새 값 반환
  compress(fn: (entries: ContextEntry[]) => any): any {
    return fn(this.window.entries);
  }

  getAll(tag?: string): ContextEntry[] {
    if (!tag) return [...this.window.entries];
    return this.window.entries.filter((e) => e.tags.includes(tag));
  }

  stats(): { used: number; max: number; percent: number; count: number } {
    const used = this.window.usedTokens;
    const max = this.window.maxTokens;
    const percent = max > 0 ? Math.round((used / max) * 100) : 0;
    return { used, max, percent, count: this.window.entries.length };
  }
}
